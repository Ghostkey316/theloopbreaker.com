<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Pilot Success Metrics Toolkit

This toolkit equips mid-market innovators and Fortune 100 partners with belief-driven metrics, ethics-first guardrails, and sandbox-to-production scaffolding.

## Metric Tracking Framework

| Metric Category | Definition | Data Source | Cadence | Owner |
| --- | --- | --- | --- | --- |
| Adoption % | Active wallets ÷ invited wallets | Signal Compass dashboard | Weekly | Partner Ops |
| Engagement Rate | Qualified interactions ÷ active wallets | NS3 simulation logs + production telemetry | Twice weekly | AI Steward |
| Retention Curve | Wallet cohort retention at D7/D14/D30/D60 | Consent ledger + vault analytics | Weekly | Data Trust Lead |
| Wallet Activity | Transactions per wallet (avg/median) | On-chain indexers + partner reports | Daily | Treasury Ops |
| Governance Confidence | Approved proposals ÷ proposals rehearsed | Governance Mirror logs | Bi-weekly | Governance Coach |
| Compliance Health | Controls passed ÷ controls evaluated | SOC/ISO readiness workspace | Monthly | Compliance Liaison |

## Metric Capture Templates

### Adoption & Engagement Sheet (CSV Headers)
```
week_start,segment,total_invited,active_wallets,adoption_pct,qualified_interactions,engagement_rate,retention_d7,retention_d30
```

### Retention Curve Dashboard Notes
- Plot retention cohorts using rolling 4-week view.
- Flag dips greater than 5% for ethics review.
- Annotate interventions (quests, AI prompt adjustments, sandbox drills).

### Wallet Activity Log Schema
```
{
  "wallet_address": "0x...",
  "segment": "mid-market" | "fortune-100",
  "consent_status": "verified" | "pending" | "revoked",
  "daily_transactions": number,
  "sandbox_flag": boolean,
  "notes": "behavioral insights"
}
```

## Sandbox-to-Production Scaling Checklist
- [ ] Confirm consent ledger synchronization and opt-in audit trail.
- [ ] Review Guardian Loop incident playbooks with partner teams.
- [ ] Validate SLA-backed monitoring thresholds (latency, uptime, anomaly detection).
- [ ] Lock deployment windows and rollback criteria with governance councils.
- [ ] Run final NS3 simulation suite and document alignment scores.
- [ ] Publish compliance evidence packet (SOC 2, ISO 27001 readiness snapshots).
- [ ] Issue "Sandbox Active" badge and schedule enterprise readiness briefing.

## Adoption Trajectory Graphs

### Scenario 1: Mid-Market Innovator (50K end users)
```
Users
100K |                             ╭──────────────╮
 90K |                           ╭╯              │
 80K |                         ╭╯               │
 70K |                      ╭──╯                │
 60K |                   ╭──╯                   │
 50K |──────────────╮╭──╯                       │
      Month 1   Month 2   Month 3   Month 4   Month 5
```
- Month 1: Sandbox activation with 50K invited, 32K active (64% adoption)
- Month 2: Governance Mirror rehearsal unlock boosts to 44K active (88%)
- Month 3: Ethics-first loyalty campaign raises to 52K active (pilot cap reached)
- Months 4-5: Stabilization at 90%+ adoption with retention-focused quests

### Scenario 2: Fortune 100 Rollout (100K end users)
```
Users
100K |──────────────╮
 90K |              │╭───────╮
 80K |              ││       │
 70K |              ││       │╭──────╮
 60K |              ││       ││      │
 50K |              ││       ││      ││
      Month 1   Month 2   Month 3   Month 4   Month 5
```
- Month 1: Controlled sandbox entry (20K active, 20% adoption)
- Month 2: Compliance attestation milestone drives 48K active (48%)
- Month 3: Full production unlock hits 72K active (72%)
- Month 4: SLA-backed governance incentives reach 88K active (88%)
- Month 5: Continuous AI alignment reporting sustains 94K active (94%)

## Ethics-First Metric Narratives
- Emphasize opt-in consent as the baseline for counting any engagement.
- Frame adoption gains as belief alignment wins rather than raw growth.
- Use retention improvements to showcase responsible loyalty economics.
- Share wallet activity trends to prove stable, inclusive mainnet participation.

