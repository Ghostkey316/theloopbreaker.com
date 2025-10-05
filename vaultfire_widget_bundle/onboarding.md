# GhostkeyVaultfireAgent Secure Onboarding

The GhostkeyVaultfireAgent bundle is designed for DevDay-ready deployments in
OpenAI's Agent Builder. Follow the protocol below to bootstrap a new pilot or
partner node safely.

## 1. Identity Verification
- Require partner submissions to provide an API key hash and a Vaultfire
  contributor tag before uploading this bundle.
- Confirm the partner wallet against the Vaultfire ledger snapshot distributed
  with the release package or the most recent governance digest.
- Reject any onboarding request that lacks a DevDay mission commitment badge.

## 2. Key Exchange
1. Generate a temporary protocol key via `ProtocolKeyManager`.
2. Encrypt the key with the partner's public curve25519 key.
3. Deliver the encrypted payload through the Vaultfire secure courier or
   equivalent SFTP channel.
4. Record the exchange in the PilotPrivacyLedger using the
   `MissionControlHooks` helper to guarantee traceability.

## 3. Stealth Pilot Activation
- Toggle **Stealth Pilot Detection** to `active` in the widget UI when running in
  production publish mode.
- Confirm that `allow_confidential_sessions` is set to `True` for any pilot that
  accesses belief-loop analytics.
- Use the Gradient Resonance panel to ensure resonance score deltas remain
  within the expected corridor (`±0.15` per 10 minutes).

## 4. Compliance & Audit
- Schedule an automatic belief-loop export weekly; the widget's telemetry
  bindings persist gradient snapshots in JSONL format for audit readiness.
- Mission Control references must be reviewed manually after every major pilot
  milestone; escalate anomalies to the Ghostkey stewardship council.

## 5. Offboarding
- Revoke protocol keys immediately once a partner completes their pilot cycle.
- Archive resonance and yield logs for 90 days, then purge according to the
  Vaultfire retention policy.
- Submit a final mission digest via the MCP Signal Responder to confirm the
  offboarding handshake.

This onboarding sequence keeps the Vaultfire mission and contributors safe while
providing the Agent Builder team a turnkey DevDay deployment path.
