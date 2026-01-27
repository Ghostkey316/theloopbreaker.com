# Partner Compliance Review Guide

This guide aligns Vaultfire controls with partner audit expectations and the new governance audit trail.

## Preparation Checklist

1. **Telemetry Verification**
   - Confirm `/metrics/ops` is exposed from both the Trust Sync API (`auth/expressExample.js`) and Partner Sync service (`partnerSync.js`).
   - Validate `security.posture.changed` entries are present in the telemetry logs after rotating handshake secrets.
2. **Governance Configuration**
   - Run `npm run audit:gov` (or `node governance/governance-core.js --audit`) to produce the latest governance assessment.
   - Review the generated entry in `governance/auditLog.json` for the `governance.audit.summary` decision type.
3. **Webhook Assurance**
   - Inspect `vaultfire_webhook_delivery_queue_depth` and retry counters to confirm queue stability.
   - Trigger a simulated webhook delivery failure and verify `ops.webhookQueue.retry` events.
4. **Documentation Package**
   - Collect the latest `docs/observability.md`, this guide, and `governance/runbooks.md` for partner distribution.

## Review Flow

| Stage | Owner | Evidence |
|-------|-------|----------|
| Kick-off | Partner Success | Observability documentation and audit log snapshot |
| Technical Validation | Partner Engineering | Metrics scrape reports + webhook retry drill output |
| Governance Sign-off | Compliance Lead | `governance/auditLog.json` entries + `npm run audit:gov` output |

## Audit Log Expectations

All governance events append to `governance/auditLog.json` using the schema:

```json
{
  "timestamp": "<ISO-8601>",
  "decisionType": "<event>",
  "actorWallet": "<wallet or null>",
  "policyChange": "<status>",
  "notes": "<context>"
}
```

Partners should archive this log per engagement or configure automated exports via GitOps or S3 replication.

## Escalation Paths

- **Telemetry anomalies:** Notify Reliability Engineering; include queue depth graphs and retry counts.
- **Governance failures:** Escalate to Compliance Lead with the associated audit log entry IDs.
- **Posture mismatches:** Coordinate with Security Operations to validate secret rotation sources.

For day-of-review coordination, pair this guide with `governance/runbooks.md`.
