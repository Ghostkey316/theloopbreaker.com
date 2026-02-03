<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Governance Configuration

Vaultfire governance defaults are production-safe but partners should supply their own `.govrc` file or pass `--config-path=`
when running `governance/governance-core.js`. The module merges any overrides with the defaults below and surfaces warnings if
pilot-safe thresholds are left unchanged.

## Recommended Thresholds

| Parameter | Recommended Value | Purpose |
| --- | --- | --- |
| `thresholds.multiplierCritical` | `0.95` | Blocks handshake sessions when multipliers drop below partner trust floors. |
| `thresholds.summaryWarning` | `1.05` | Issues governance alerts before multipliers threaten partner eligibility. |
| `thresholds.quorum` | `0.66` | Ensures two-thirds steward participation for governance overrides. |
| `thresholds.escalationWarning` | `0.85` | Triggers compliance escalation before hitting critical shutdown levels. |

Tune values inside `.govrc` or a JSON/YAML file referenced with `--config-path=/path/to/config.json`.

## Compliance Team Integration Checklist

1. **Name a dual-approval pair** for overrides and add them to the `compliance.contacts` array.
2. **Map escalation targets** in your internal tooling so Vaultfire telemetry alerts feed into the correct runbooks.
3. **Verify residency alignment** by confirming the same contacts exist in partner data residency matrices.
4. **Schedule quarterly audits** using `npm run audit:gov` and file the JSON log output alongside stewardship reports.
5. **Confirm governance telemetry sinks** receive `config.auditPassed` so partners can prove due diligence downstream.

## Self-Audit CLI

Run the governance self-audit from the repository root:

```bash
npm run audit:gov
```

The command loads `.govrc` or a file provided via `--config-path=` and exits with a non-zero code if thresholds are unsafe. Runtime logs embed `config.auditPassed` to signal the current compliance posture.
