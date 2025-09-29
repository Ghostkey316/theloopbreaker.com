# Vaultfire Partner API Reference

Welcome to the Vaultfire Protocol partner API. These endpoints empower integration teams to activate users, surface rewards, and align belief profiles securely. All requests must be authenticated and made over HTTPS.

## Authentication

- **Scheme:** Bearer token (JWT signed by Vaultfire). Include in the `Authorization` header as `Bearer <token>`.
- **Scopes:** `activation:trigger`, `rewards:read`, `belief:sync` as relevant to each endpoint.
- **Replay Protection:** Include an `X-Vaultfire-Nonce` header with a unique UUID per request and `X-Vaultfire-Timestamp` in ISO-8601 UTC.

## Rate Limiting

- Default limit: **600 requests per minute** per partner tenant.
- Burst limit: Up to **60 requests** within a 5-second window.
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Exceeding limits returns HTTP `429 Too Many Requests` with a retry window.

---

## POST `/vaultfire/activate`

Trigger activation for a user wallet and associated modules.

- **Required Scope:** `activation:trigger`
- **Idempotency:** Provide `Idempotency-Key` header to avoid duplicate activations.

### Request Body

```json
{
  "walletId": "0x8f1a...f93b",
  "ens": "partneruser.eth",
  "activationChannel": "guardian_link",
  "metadata": {
    "campaignId": "spring-ignite",
    "tierOverride": "flame"
  }
}
```

### Response

`201 Created`

```json
{
  "status": "activated",
  "walletId": "0x8f1a...f93b",
  "tierLevel": "flame",
  "activatedAt": "2024-05-28T14:37:12Z",
  "modules": [
    {
      "moduleId": "belief-alignment",
      "state": "initialized"
    },
    {
      "moduleId": "loyalty-yield",
      "state": "queued"
    }
  ]
}
```

### Error Responses

| Status | Code | Description |
| --- | --- | --- |
| 400 | `activation.invalid_payload` | Malformed request body or missing fields. |
| 401 | `auth.unauthorized` | Missing or invalid token. |
| 409 | `activation.conflict` | Wallet already activated. |
| 503 | `activation.temporarily_unavailable` | Maintenance window active. |

---

## GET `/vaultfire/rewards/:walletId`

Retrieve the latest loyalty yield metrics for the specified wallet.

- **Required Scope:** `rewards:read`
- **Caching:** Responses may be cached for up to 60 seconds.

### Path Parameters

- `walletId` *(string, required)* — Target wallet address.

### Sample Request

```
GET /vaultfire/rewards/0x8f1a...f93b HTTP/1.1
Host: api.vaultfire.network
Authorization: Bearer <token>
X-Vaultfire-Nonce: 0a4d8fe0-483f-4b2c-91c5-a0f1786bcb5f
X-Vaultfire-Timestamp: 2024-05-28T14:40:00Z
```

### Response

`200 OK`

```json
{
  "walletId": "0x8f1a...f93b",
  "currentYield": {
    "apr": 6.4,
    "multiplier": 1.15,
    "tierLevel": "flame"
  },
  "pendingEvents": [
    {
      "eventId": "yield-44302",
      "amount": "42.5000",
      "multiplier": 1.1,
      "sourceProtocol": "AuroraPool",
      "timestamp": "2024-05-27T23:11:45Z"
    }
  ]
}
```

### Error Responses

| Status | Code | Description |
| --- | --- | --- |
| 400 | `rewards.invalid_wallet` | Wallet format invalid. |
| 401 | `auth.unauthorized` | Missing or invalid token. |
| 404 | `rewards.not_found` | Wallet has no rewards profile. |
| 429 | `rate_limit.exceeded` | Rate limit reached; respect `Retry-After`. |

---

## POST `/vaultfire/mirror`

Synchronize a partner-derived belief profile with the Vaultfire protocol to maintain ethical alignment.

- **Required Scope:** `belief:sync`
- **Schema Validation:** Request payload validated against Vaultfire belief schema.

### Request Body

```json
{
  "walletId": "0x8f1a...f93b",
  "beliefScore": 0.87,
  "sourceProtocol": "PartnerVerse",
  "mirroredAt": "2024-05-28T14:43:18Z",
  "signals": [
    {
      "signalId": "sig-9923",
      "weight": 0.62,
      "confidence": 0.94
    }
  ],
  "consent": {
    "tag": "ethics-first",
    "version": "1.2.0",
    "attestedAt": "2024-05-28T14:42:57Z"
  }
}
```

### Response

`202 Accepted`

```json
{
  "status": "mirroring",
  "walletId": "0x8f1a...f93b",
  "beliefScore": 0.87,
  "alignmentState": "under_review",
  "nextReviewAt": "2024-05-28T15:43:18Z"
}
```

### Error Responses

| Status | Code | Description |
| --- | --- | --- |
| 400 | `mirror.validation_failed` | Payload failed schema or ethics validation. |
| 401 | `auth.unauthorized` | Missing or invalid token. |
| 409 | `mirror.version_conflict` | Incoming consent tag version outdated. |
| 422 | `mirror.alignment_breach` | Signals conflict with ethics-first framework. |

---

## Common Error Envelope

All error responses follow this structure:

```json
{
  "error": {
    "code": "string",
    "message": "Human-readable explanation",
    "correlationId": "uuid",
    "retryAfter": "optional ISO-8601 timestamp"
  }
}
```

Include the `correlationId` when contacting support to accelerate troubleshooting.

## Support

- **Status Page:** [status.vaultfire.network](https://status.vaultfire.network)
- **Support Email:** partners@vaultfire.network
- **Pager Channel:** 24/7 on-call via partner portal escalation workflow.

Integration teams should subscribe to release notes to stay aligned with evolving schemas and rate limits.
