# Vaultfire Production Readiness Playbook

This document captures the upgrades that bring the Vaultfire protocol to launch readiness. It complements the existing identity and observability guides by describing how to deploy the new resolver service, consume durable logs, and integrate failure surfacing hooks.

## Real-time Identity Resolution Service

The `identity-resolver` microservice exposes `GET /resolve/:walletId` for partners that need the latest belief score metadata without cloning repository JSON snapshots.

```http
GET /resolve/bpow20.cb.id
200 OK
Content-Type: application/json

{
  "wallet": "bpow20.cb.id",
  "score": 92,
  "lastSeen": "2025-09-30T18:44Z",
  "updatedAt": "2025-09-30T19:02:11Z"
}
```

### Configuration

| Environment Variable | Purpose | Default |
|----------------------|---------|---------|
| `VAULTFIRE_IDENTITY_MONGO_URI` | MongoDB connection string. | `mongodb://localhost:27017/vaultfire` |
| `VAULTFIRE_IDENTITY_DB` | Database containing live wallet records. | `vaultfire` |
| `VAULTFIRE_IDENTITY_COLLECTION` | Collection used for resolver reads. | `identity_wallets` |

The service streams operational events through the shared alert broker. When a lookup fails the broker emits the structured payload returned by `utils/notifyPartner()`, making the incident visible to `/status` and any registered webhooks.

A fallback resolver can be injected at bootstrap when the real-time store is empty. The default returns:

```json
{
  "wallet": "<query>",
  "score": 0,
  "lastSeen": null,
  "status": "not_found",
  "source": "fallback"
}
```

See `services/identity-resolver/index.js` for bootstrapping helpers and `services/identity-resolver/store.js` for the Mongo-backed implementation.

## Durable Logging With Daily Rotation

The shared logger (`services/logging/index.js`) now wraps Winston with `winston-daily-rotate-file`. Two rotation streams are configured:

- `logs/vaultfire-%DATE%.log` for application telemetry.
- `logs/audit/vaultfire-audit-%DATE%.log` for compliance trails.

Both rotate every 24 hours, retain 30 days, and compress older files. A `CloudTransport` ships every entry to S3, GCS, or IPFS depending on the `VAULTFIRE_LOG_CLOUD_PROVIDER` variable. When a provider is not configured the transport buffers entries inside `logs/cloud-buffer.log` so operators can replay them later.

### Cloud Forwarding Options

| Provider | Required Variables | Behaviour |
|----------|-------------------|-----------|
| `s3` / `gcs` | `VAULTFIRE_LOG_ENDPOINT`, `VAULTFIRE_LOG_BUCKET` | Sends JSON payloads to an HTTPS endpoint backed by cloud storage. |
| `ipfs` | `VAULTFIRE_LOG_IPFS_ENDPOINT` | Posts encoded logs to a pinning gateway. |
| `buffer` | none | Default development mode that persists to disk until a provider is enabled. |

Refer to `docs/observability.md` for exporter setup and align the retention policy with partner compliance rules.

## Failure Surfacing & Partner Alerting

Critical modules dispatch alerts through `utils/notifyPartner()` (Node.js) or `utils/notify_partner.py` (Python). Each alert is written to `status/alerts.jsonl`, streamed to any registered webhook, and exposed via the identity resolver's `GET /status` endpoint.

### Registration Flow

```http
POST /webhooks
Content-Type: application/json

{
  "partnerId": "demo-co",
  "url": "https://alerts.demo-co/vaultfire",
  "headers": {
    "Authorization": "Bearer <token>"
  }
}
```

### Example Alert

```json
{
  "type": "error",
  "module": "token",
  "message": "Issuance failed",
  "timestamp": "2025-09-30T19:00:00Z",
  "details": {
    "wallet": "0xabc...",
    "reason": "token_not_supported"
  }
}
```

Token issuance (`engine/token_ops.py` and `engine/proof_of_loyalty.py`) and IPFS pinning (`vaultfire_webhook.py`) publish errors automatically. Python modules fall back to appending the alert locally when the resolver service is offline. Partners can poll `/status` or subscribe to their webhook for live updates during launch rehearsals.

## Deployment Checklist

1. Deploy MongoDB (or compatible store) and seed live wallet rows.
2. Launch the identity resolver via `startIdentityResolver()` or the CLI and verify `/resolve/:walletId` and `/status` succeed.
3. Confirm log rotation produces `logs/audit/<date>.log` files and that the configured cloud transport is receiving entries.
4. Trigger a synthetic token issuance failure and watch the alert propagate to `/status` and any registered webhook.
5. Validate front-end staging builds pick up the environment using `import.meta.env.MODE` to toggle partner sign-off checklists.

Once all checks succeed, mark the partner sign-off checklist complete and proceed with production cutover.
