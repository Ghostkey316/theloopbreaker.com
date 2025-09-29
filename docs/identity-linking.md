# Vaultfire Belief Identity Linker

The Trust Sync phase introduces a persistent anchor between a partner user and
an onchain wallet. Anchors are encrypted before being written to storage so
partners can maintain a verifiable link without exposing belief data in plain
text.

## API Overview

`POST /link-identity`
: Upserts the anchor for a `wallet` + `partnerUserId` pair. Payload
  requirements:

  ```json
  {
    "wallet": "0x1234...",
    "partnerUserId": "partner-42",
    "beliefScore": 0.82,
    "metadata": {
      "intents": ["loyalty"],
      "ethicsFlags": ["consent:verified"]
    }
  }
  ```

  Responses include both the decrypted anchor and the latest Signal Compass
  snapshot so a caller immediately sees the effect of the update.

`GET /link-identity`
: Fetches the decrypted anchor. Both `wallet` and `partnerUserId` query
  parameters are required.

All identity routes require an authenticated partner or admin access token and
pass through the ethics guard middleware. Belief scores must be between `0` and
`1`. Scores below the configured breach threshold automatically fire the
`onBeliefBreach` webhook event.

## Storage Backends

The default store is in-memory for local development. Production deployments
should choose Postgres or MongoDB by updating `vaultfirerc.json` or the
`VAULTFIRE_IDENTITY_PROVIDER` environment variable. Anchors are encrypted with
AES-256-GCM using the key supplied via `VAULTFIRE_ENCRYPTION_KEY`.

| Provider  | Configuration Notes |
|-----------|--------------------|
| `postgres` | Set `trustSync.identityStore.postgres.connection` to a valid `pg` connection configuration. The table `belief_identity_anchors` is created if missing. |
| `mongo`    | Provide a connection URI and optional database/collection overrides in `trustSync.identityStore.mongo`. Indexes for anchor and wallet hashes are maintained. |

## Breach Detection

Set `trustSync.identityStore.breachThreshold` to customise the score that
should trigger `onBeliefBreach`. The default is `0.35`. Breaches are recorded in
all telemetry channels and propagated to any registered partner hooks.
