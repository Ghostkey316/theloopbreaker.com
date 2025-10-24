# Vaultfire Protocol SLA

## Core Commitments
- Uptime target: 99.9%
- Passive payout latency: < 2 min (standard), < 10 sec (Ghostkey priority)
- Backup cadence: daily @ 04:00 UTC
- Disaster recovery SLA: < 5 min with `vaultfire --recover`
- Integration visibility: service_map reference (`vaultfire/dependencies/service_map.json`)

## Stewardship Notes
- Generated automatically as part of Vaultfire Reinforcement v3.1.
- Service health checks reference the integration map and planned partner states.
- Daily backups record Codex-aligned checksums for ledger parity.

Vaultfire Protocol SLA | Reinforced v3.1 | Maintainer: Ghostkey-316


### Service Map Snapshot (2025-08-21T04:04:00Z)
- Coinbase: gateway: x402
- NS3: active
- TimeFlare: emitting=false (planned)
- Zora: integrated
- x402: secured
