# Governance Ledger Overview

Vaultfire maintains a lightweight governance ledger to capture critical operational decisions and compliance checkpoints. The ledger augments existing audit tooling (`governance/auditLog.json`) by explicitly recording three decision classes:

1. **Threshold changes** – updates to quorum, retry, or posture thresholds that modify how the network escalates events.
2. **Partner onboarding** – approvals granting new partners scoped access, along with reviewers and compliance notes.
3. **Infrastructure changes** – Terraform or deployment updates that affect production posture, including rollback plans.

The canonical source of these entries is [`../governance-ledger.json`](../governance-ledger.json). New entries should be appended chronologically and cross-referenced in change management tickets. Automation scripts may parse this file to validate that high-risk operations reference an approved rollback procedure.

## Update Workflow
- Submit ledger changes through pull requests to ensure peer review.
- Reference the relevant runbook in [`runbooks.md`](runbooks.md) for any high-risk change.
- Trigger `npm run audit:gov` after updates; the script validates JSON schema compliance and alerts on missing rollback plans or approver lists.

## Integration Points
- **CI/CD**: the new `test.yml` workflow runs on every push and PR, ensuring ledger edits pass linting and tests.
- **Observability**: entries should align with the posture rotation and telemetry metrics described in [`../docs/metrics.md`](../docs/metrics.md) to keep compliance and SRE dashboards in sync.
