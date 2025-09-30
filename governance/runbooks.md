# Governance Runbooks Overview

Use these runbooks alongside `docs/compliance-review.md` to satisfy partner audit checkpoints.

## Daily Governance Checklist

1. Run `npm run audit:gov` and review console output for warnings.
2. Confirm a new entry exists in `governance/auditLog.json` with `decisionType` `governance.audit.summary`.
3. Distribute the audit summary to compliance distribution lists.

## Emergency Policy Override

1. Document the request details in your internal ticketing system.
2. Update the relevant policy file or `.govrc` override.
3. Execute `node governance/governance-core.js --audit --config-path=<override>`.
4. Review `governance/auditLog.json` for the appended decision entry.
5. Notify partners by linking the audit log entry and `/metrics/ops` snapshots from both core services.

## Posture Rotation Validation

1. Rotate handshake secrets via your chosen secret manager.
2. Call `/vaultfire/handshake` on `partnerSync.js` to confirm the new posture.
3. Check telemetry for `security.posture.changed` events and verify `vaultfire_security_posture_changes_total` increased.
4. Capture the audit log reference and circulate to compliance leads.

Refer back to `docs/observability.md` for metric names and `docs/compliance-review.md` for review-day sequencing.
