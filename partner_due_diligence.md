# Partner Due Diligence Checklist

Vaultfire provides ethics-first telemetry, hardened SecureStore mechanics, and governance transparency. Use this guide to fast-track reviewer onboarding.

## Quickstart (3 Steps)
1. **Review Documentation Pack:** Read `README.md`, `VERSION.md`, `CHANGELOG.md`, and `docs/governance_plan.md` to understand the latest release posture, governance model, and deployment timelines.
2. **Validate Sandboxed Telemetry:** Run `npm test` to generate `/logs/test-report.json`, then call `GET /debug/belief-sandbox` against the sample API to confirm belief, loyalty, and multiplier sandboxes are emitting consistent JSON entries.
3. **Confirm Deployment Readiness:** Inspect `configs/deployment/*.yaml` for `pilot_ready: true`, review `data_residency.yaml`, and execute the SecureStore webhook rehearsal (see `SecureStore.py` notes) to verify fallback caps.

## Reviewer Notes
- Integrity tests are enforced via the Git pre-push hook; request the latest `/logs/test-report.json` artifact as part of evidence collection.
- Manifest metadata (`manifest.json`) links the semantic version and git commit hash for immutable audit trails.
- Data residency controls are documented in `data_residency.yaml` with roadmap milestones for future partner regions.

## Partner Risk Matrix

| Risk Area | Reviewer Question | Vaultfire Mitigation |
| --- | --- | --- |
| Module complexity | How do pilots avoid loading the entire module stack? | Set `VAULTFIRE_MODULE_SCOPE=pilot` (or `pilot_mode=true`) and execute `node pilot-loader.js` to load only CLI, Dashboard, and Belief Engine surfaces. |
| Governance tuning | What ensures thresholds are pilot-ready? | Configure `.govrc` or `--config-path=` overrides, then run `npm run audit:gov` to validate thresholds and log `config.auditPassed` for audit trails. Flag anything requiring multi-sig sign-off before a production launch. |
| Telemetry residency | How are rejected partner sinks handled? | Enable `telemetry.fallback.enabled` so failed remote writes fall back to JSON logs and extend pipelines via `telemetry/adapters/partner_hook_adapter.js`. |
