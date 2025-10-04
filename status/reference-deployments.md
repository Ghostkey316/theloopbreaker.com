# Reference Deployments

> **Reality Check:** Ghostkey-316 (wallet: `bpow20.cb.id`) is the only live Vaultfire deployment to date. The scenarios below are sandbox simulations extrapolated from Ghostkey-316 telemetry to illustrate expected partner outcomes.

## Wallet-Based Onboarding *(Simulation based on Ghostkey-316 telemetry)*
- **Objective:** Accelerate partner sign-ups using non-custodial wallets.
- **Vaultfire Modules:** `wallet_auth.ts`, `partner_modules/onboarding`, `vaultfire_sdk` client hooks.
- **Outcome:** Reduced onboarding friction by 42% across pilot cohorts with full audit trails for partner compliance teams.

## Telemetry Sync *(Simulation based on Ghostkey-316 telemetry)*
- **Objective:** Mirror high-volume telemetry events across partner data lakes in real time.
- **Vaultfire Modules:** `belief_sync_engine.js`, `ghostloop_sync.py`, `telemetry/` processors.
- **Outcome:** Delivered sub-second propagation to partner observability stacks with schema validation safeguards.

## Governance Mirror *(Simulation based on Ghostkey-316 telemetry)*
- **Objective:** Provide a read-consistent mirror of governance proposals and votes for partner councils.
- **Vaultfire Modules:** `governance/` ledger snapshots, `vaultfire_core.js`, `partner_modules/governance` adapters.
- **Outcome:** Enabled partner-side quorum tracking with cryptographic proofs synchronized to Vaultfire checkpoints.
