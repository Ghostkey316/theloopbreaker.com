# Vaultfire Live Pilot Scaffold (Staging / Simulated / Pre-Production Only)

## Overview
This staging-only pilot scaffold transitions Vaultfire's belief missions from closed simulations into a controlled field trial. The CLI logger ships with lightweight wallet telemetry (Ethereum Sepolia testnet by default) and routes earned belief XP into an auditable JSON log. The scope is intentionally narrow so partners can vet risk controls before graduating to production infrastructure.

## Scope
- Targeted for 1–3 trusted contributors operating under supervised access.
- Requires opt-in acknowledgement of ethics and telemetry disclosures.
- Designed for wallets that can sign on Sepolia, Holesky, or another low-stakes network.

## Limitations
- Not a production deployment. Latency, RPC quotas, and signing UX are not hardened.
- SQLite-backed persistence is local to the pilot host; high-availability replicas are out of scope.
- ENS lookups rely on community RPC endpoints and may throttle or drift.
- XP multipliers mirror the belief engine but do not mint on-chain incentives.

## Target Metrics
| Metric | Description |
| --- | --- |
| XP tracking fidelity | Confirm per-mission XP stored in [`telemetry-log.json`](./telemetry-log.json) within 5 seconds of CLI submission. |
| Retention events | Observe at least two consecutive mission logs per wallet over a 7-day observation window. |
| Identity resolution drift | Alert if ENS/CB.ID resolution changes from roster data during refresh cycles. |

## How to Use the CLI Logger
1. Export an RPC endpoint if you prefer a custom provider:
   ```bash
   export VAULTFIRE_PILOT_RPC_URL="https://sepolia.infura.io/v3/<key>"
   ```
2. Run the logger to record a mission:
   ```bash
   node live-pilot/missionLogger.js --wallet ghostkey316.eth --mission alpha-run --xp 40
   ```
3. Inspect the appended entry in `telemetry-log.json` and the structured console output for XP and wallet state.

> **Ethics-first note:** Each mission record discloses wallet usage and XP computation. Do not use the scaffold for irreversible token flows or unsanctioned partner experimentation.
