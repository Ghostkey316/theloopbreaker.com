# Vaultfire DAO Continuity Pathway

Vaultfire's DAO pathway ensures mission continuity if the core operator network is unavailable, while maintaining ethics-first guardrails.

## 1. Organizational Roles
- **Guardian Council (5 members)**: Custodians of the multisig (see `governance/multisig_template.yaml`). Each guardian holds a weighted vote of 18%.
- **Mission Stewards (9 members)**: Subject matter experts for loyalty, compliance, community, and resilience. Each steward holds a 4% vote.
- **Ecosystem Delegates (Open Set)**: Verified partners staking VFIRE to participate in governance; collectively hold 30% weighted by stake and trust score.
- **Community Assembly**: Opt-in contributors with verified belief alignment; collectively hold 16% with quadratic weighting.

## 2. Voting Weights & Quorum
| Voting Block           | Weight | Minimum Participation |
|------------------------|--------|-----------------------|
| Guardian Council       | 90% quorum across 5 seats | 3 Guardians must vote |
| Mission Stewards       | 70% quorum | 7 of 9 stewards |
| Ecosystem Delegates    | Weighted 30% | ≥ 1.5M VFIRE staked |
| Community Assembly     | Weighted 16% | ≥ 120 verified voters |

A proposal passes when:
1. Aggregate weighted support ≥ 66%, and
2. Guardian Council majority (≥3) affirms, and
3. At least one Mission Steward from compliance or security affirms for risk-related proposals.

## 3. Proposal Lifecycle
1. **Signal Phase (24h)**: Proposal posted to `governance/proposals.json` with telemetry references and ROI summary.
2. **Review Phase (72h)**: Guardians assign Mission Stewards; telemetry attestation required.
3. **Vote Phase (120h)**: Weighted on Snapshot-compatible interface; on-chain hash recorded in `governance-ledger.json`.
4. **Execution Phase (12h)**: Multisig executes if quorum reached; fallback automation in `governance/governance-core.js` ensures compliance logging.
5. **Post-Mortem (7 days)**: Publish summary to `/governance` landing page and archive in `docs/governance.md`.

## 4. Escalation Rules
- **Incident Response**: If Guardian quorum not met within 6 hours for severity-1 incidents, Mission Stewards invoke fast-track policy (see `multisig_template.yaml`).
- **Ethics Violations**: Immediate suspension of associated rewards; Guardian - Ethics must convene emergency session with compliance steward.
- **Telemetry Integrity**: If attestation hash mismatch occurs, freeze loyalty engine payouts and activate `system_integrity_check.py`.

## 5. Continuity Triggers
- **Operator Downtime > 12h**: Community Assembly can initiate continuity proposal with 55% support; requires Guardian confirmation.
- **Guardian Resignation**: Replacement nominated by Mission Stewards; background review logged in `governance/flags.json`.
- **Fork Consideration**: Requires 80% weighted support plus adherence to Moral Memory Fork Agreement (MMFA).

## 6. Reporting & Transparency
- Publish quarterly governance reports summarizing proposal throughput, ROI impacts, and attestation updates.
- `/governance` landing page auto-refreshes data from `dashboards/adoption_mission_dashboard.json` and `governance/auditLog.json`.
- Provide PDF exports using `pandoc governance/dao_pathway.md -o governance/dao_pathway.pdf` for procurement teams.

## 7. Compliance Mapping
- SOC 2 CC1.2 Governance & Responsibility
- SOC 2 CC2.3 Commitment to Ethical Values
- ISO/IEC 27001 A.5 Leadership and Commitment
- ISO/IEC 27001 A.6 Organization of Information Security

## 8. Revision Control
- Version 1.0 – Published 2024-06-01 by Vaultfire Trust Office.
- All revisions require Guardian Council approval and publishing to `governance.md` summary.
