# Technical Due Diligence

## Code Walkthrough Summary
- **Core Orchestration:** [`vaultfire_core.js`](../vaultfire_core.js) exposes the main event loop and routing primitives used by partners to plug into belief synchronization and telemetry overlays.
- **Belief Sync Services:** [`belief_sync_engine.js`](../belief_sync_engine.js) coordinates inbound partner signals and leverages [`beliefSyncService.js`](../beliefSyncService.js) for cross-network propagation safeguards.
- **Wallet Authentication:** [`wallet_auth.ts`](../wallet_auth.ts) provides the secure wallet handshake used across onboarding flows, backed by shared utilities in [`SecureStore.py`](../SecureStore.py).
- **Partner Integrations:** [`partner_modules/`](../partner_modules) and [`vaultfire_sdk/`](../vaultfire_sdk) supply reference adapters and SDK helpers for embedding Vaultfire services into partner stacks.

## Threat Modeling Outline
### Belief Syncing
- **Attack Surface:** Partner signal ingestion endpoints, replay resistance within `belief_sync_engine.js`, and state propagation logic.
- **Key Threats:** Replay or spoofed belief updates, cascading desync from malformed partner payloads, and privilege escalation via mis-tagged partner identity claims.
- **Mitigations:**
  - Enforce signed payloads and nonce verification at the ingestion layer.
  - Apply schema validation with fail-closed defaults before committing updates.
  - Continuously monitor anomaly scores in `ghostloop_sync.py` to detect out-of-band partner activity.

### Wallet Authentication
- **Attack Surface:** Wallet session initialization in `wallet_auth.ts`, credential storage in `SecureStore.py`, and downstream partner callbacks.
- **Key Threats:** Session hijacking via stolen challenge responses, leakage of cached wallet secrets, and downgrade attacks on supported signature algorithms.
- **Mitigations:**
  - Rotate challenge salts per session and expire unused handshakes within 60 seconds.
  - Store only encrypted wallet metadata using the `SecureStore` abstraction with hardware-backed secrets where available.
  - Enforce allow-listed signature algorithms and reject fallback requests without explicit partner approval.

## Dependency Audit Snapshot
The latest `npm audit` execution produced the following summary:

```
Info: 0 | Low: 0 | Moderate: 2 | High: 0 | Critical: 0 | Total: 2
```

Moderate advisories GHSA-pxg6-pf52-xh8x (`cookie` <0.7.0 via Hardhat Sentry) and GHSA-52f5-9888-hmc6 (`tmp` <=0.2.3 via `solc`) persist upstream. Vaultfire applies sandbox guards (`infra/hardhat-sandbox.js`) to neutralize the attack surface and records weekly `npm audit` output through `npm run security:watch`. Maintain the controls until patched releases land, then update `package-lock.json` and retire the wrappers.
