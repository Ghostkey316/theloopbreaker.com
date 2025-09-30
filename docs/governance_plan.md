# Vaultfire Governance Plan

## CLI Configuration Access Policies
- **Wallet-Gated Access:** All CLI configuration commands require wallet signatures tied to approved partner ENS records. Attempts without a verified wallet are rejected and logged to `logs/ethics_log.json`.
- **Environment Scoping:** `vaultfire config pull` and `vaultfire config push` commands are limited to sandbox manifests unless the caller holds the `admin` or `architect` scope embedded in the JWT claims.
- **Change Windows:** Configuration changes are only permitted during scheduled maintenance windows (UTC 18:00–22:00). Out-of-window attempts trigger advisory warnings and require ethics steward approval via `/security/handshake`.

## Voting Structure
- **Council Composition:** The Vaultfire Governance Council includes 3 ethics stewards, 2 partner delegates, and 1 rotating contributor advocate. Each member holds one vote.
- **Proposal Lifecycle:** Governance proposals are initiated through the BeliefVote CLI, posted to `votes.json`, and remain open for 72 hours. A supermajority of 4/6 votes is required to pass measures affecting residency or multiplier thresholds.
- **Transparency:** Voting outcomes are mirrored to `logs/belief-sandbox.json` in sandbox mode and summarized in `CHANGELOG.md` entries for partner review.

## Compliance Override Framework
- **Trigger Conditions:** Overrides can be invoked when regulatory requirements conflict with baseline policies (e.g., jurisdictional residency mandates or emergency data retention holds).
- **Authorization Path:** Overrides require dual approval—one ethics steward and one partner delegate—documented via signed payloads archived in SecureStore with webhook confirmations.
- **Duration & Review:** Overrides expire after 30 days unless renewed by another council vote. Post-expiry audits reconcile telemetry, webhook fallbacks, and any temporary config drift.
