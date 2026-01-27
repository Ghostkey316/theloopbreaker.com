# Partner handshake hardening

Vaultfire partner sync now exposes a modular handshake surface so security
reviews can reason about each trust boundary independently.

## Components

- **JWT authority** – `services/handshake/jwtAuthority.js` issues and verifies
  tokens using the unified secrets manager. Rotate
  `VAULTFIRE_HANDSHAKE_ACCESS_SECRET` via the secrets manager to refresh socket
  credentials without redeploying the service.
- **API key gate** – `services/handshake/apiKeyGate.js` centralises API key
  validation across HTTP and Socket.IO entry points. Keys are loaded from the
  secrets manager and compared with timing-safe equality.
- **Socket relay** – `services/handshake/socketRelay.js` now records telemetry
  for every connection and enforces authentication before joining the relay bus.
- **Governance enforcer** – `services/handshake/governanceEnforcer.js` evaluates
  multiplier floors and belief drift thresholds before broadcasting partner
  updates. Alerts are mirrored to telemetry, webhooks and the socket relay so
  partner operations receive consistent guidance.

## Auditing & monitoring

1. Enable telemetry persistence (Postgres or Supabase) so handshake events are
   mirrored to a durable store for compliance review.
2. Subscribe to the `handshake.socket.*` events in telemetry to detect unusual
   connection churn or replay attempts.
3. Monitor `governance.alert` entries emitted by the enforcer; they include the
   computed severity and will be forwarded to partner webhooks.
4. Record API key provisioning in your secrets manager audit trail. The default
   environment provider can be replaced with Vault or HSM-backed providers as
   soon as partner deployments require hardware-backed rotation.
