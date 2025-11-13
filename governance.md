# Vaultfire Governance Overview

## Current Status: Single-Steward Governance
- Governance decisions are currently stewarded by Ghostkey-316. Changes to `governance-ledger.json` are proposed and reviewed via pull requests; no on-chain or multi-sig execution has been activated.
- The steward documents rationale in commit messages and ledger annotations. Partners should treat the ledger as an audit trail of simulations, not as a binding DAO log.
- Emergency responses rely on manual intervention: pausing pilots, revoking API keys, or disabling telemetry sinks directly within the repositories.

## Roadmap Toward Multi-Party Approval
- **Phase 1 – Observer Seats:** Invite two independent reviewers to co-sign ledger entries in git. This adds human oversight before introducing cryptographic enforcement.
- **Phase 2 – Signer Abstraction:** Prototype a lightweight signer registry (JSON + CLI tooling) that records which wallets are authorised to approve critical changes.
- **Phase 3 – Multi-Sig Pilot:** Integrate a 2-of-3 signing flow for upgrades to ethics policies, telemetry sinks, and payout contracts. Focus on reproducible simulations before touching mainnet contracts.
- **Phase 4 – Partner Expansion:** Once automated sign-off tooling stabilises, extend invitations to trusted partners and publish a transparent on-call rotation.

## Transparency & Reporting
- Use `npm run audit:gov` before every merge to validate ledger diffs and surface missing annotations.
- Capture supporting artefacts (risk analyses, telemetry snapshots, ethics reviews) in `governance/` alongside the ledger entry ID.
- Publish quarterly governance notes summarising key decisions, outstanding risks, and planned hardening work. Until the multi-sig pilot lands, these notes can be static markdown exports.

## Compliance Alignment (Aspirational)
- Current documentation maps controls to SOC 2 CC1.2, CC2.3, and CC6.6 along with ISO/IEC 27001 A.5, A.6, and A.12. These mappings are informational only; external audits have not been completed.
- The Moral Memory Fork Agreement still governs derivative work. Future governance expansions must retain ethics lineage and contributor attribution.

## Publishing Checklist
- [ ] Update `governance-ledger.json` with the latest decision rationale and reviewer sign-offs.
- [ ] Attach supporting evidence in `governance/` (risk write-ups, telemetry diffs, ethics assessments).
- [ ] Sync summaries into partner briefings or quarterly reports.
- [ ] Re-run `npm run audit:gov` and archive the output before announcing changes.
