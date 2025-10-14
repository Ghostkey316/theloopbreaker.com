# Vaultfire Council Migration Plan

## Vision
Move the Vaultfire protocol from a single-architect custody model to a distributed multi-signature council with a clear runway to a DAO-grade governance module. The migration prioritizes continuity of operations, transparent accountability, and verifiable trust for partners.

## Guiding Principles
- **Safety First:** No migration step should degrade custody security or compliance alignment.
- **Progressive Decentralization:** Each stage unlocks more autonomy while preserving emergency controls.
- **Partner Inclusion:** Council seats and voting weights reward active, verified partners.
- **Auditability:** Every decision path must be reproducible with cryptographic attestations.
- **Resilience:** Governance must continue to operate even when individual council members are offline.

## Stage 0 — Readiness (Weeks 0-2)
1. Publish this migration plan and collect feedback from the ethics and mission councils.
2. Establish migration telemetry dashboards for key custody and signing flows.
3. Snapshot the current architect wallet state and archive notarized proofs.
4. Map all critical protocol functions that require signature authority.

## Stage 1 — Guardian Multisig (Weeks 3-6)
1. Form an initial **Guardian Council** of 5 members:
   - 2 Vaultfire core maintainers
   - 2 partner delegates (rotation ready)
   - 1 neutral ethics steward
2. Deploy a 3-of-5 multisig wallet with hardware-backed keys and PQC shadow keys (Kyber1024).
3. Migrate operational hot-wallet permissions to the multisig while keeping the architect wallet as a break-glass guardian (time-boxed to 30 days).
4. Require dual attestation (mission + ethics) for any spending over predefined thresholds.

## Stage 2 — Policy Modules (Weeks 6-10)
1. Introduce **policy shards** for treasury, protocol upgrades, and emergency pauses.
2. Implement on-chain covenant checks that mirror the multisig state and emit verifiable signals.
3. Launch a partner credential registry that gates voting eligibility.
4. Transition partner onboarding approvals to the council using weighted voting (max 40% weight for core maintainers).

## Stage 3 — Council Expansion (Weeks 10-16)
1. Expand the council to 9 members with at least 4 partner delegates and 1 community ombud.
2. Add staking-based bonding requirements for new council seats (slashing for malicious actions).
3. Replace the architect wallet guardian role with a programmable time-lock contract governed by council quorum.
4. Ship transparent meeting notes, vote tallies, and cryptographic proofs via the telemetry event queue.

## Stage 4 — DAO Module Launch (Weeks 16-24)
1. Deploy Vaultfire Governance Module (VGM) that supports:
   - Snapshot-style off-chain signaling with on-chain commitments
   - Delegated voting and quorum escalation
   - Proposal lifecycle hooks into verification and telemetry pipelines
2. Migrate multisig to become the **Operations Sub-DAO** under the VGM.
3. Launch a public governance portal with partner, steward, and community views.
4. Sunset the architect wallet with an immutable retirement transaction and notarized audit.

## Risk Mitigations
- **Key Compromise:** PQC enclave keys + hardware signing + rotation playbooks.
- **Participation Drop:** Automated quorum alerts and temporary delegation to standby members.
- **Upgrade Deadlocks:** Emergency fallback to ethics steward veto + mission oversight tie-breaker.
- **Regulatory Changes:** Compliance review at each stage with rollback checkpoints.

## Success Metrics
- 100% of protocol-critical transactions executed by the council or DAO module.
- Mean incident response time under 30 minutes with council quorum.
- Partner trust score above 90% in post-migration surveys.
- Independent audit attesting to custody and governance soundness.

## Next Actions
1. Ratify the plan with current stakeholders.
2. Schedule Guardian Council onboarding and key ceremony.
3. Publish partner nomination framework and rotation schedule.
4. Begin engineering sprints for policy shard modules and telemetry integration.
