<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Governance Runbook

## Setup Checklist
- Ensure `.govrc` or `VAULTFIRE_GOV_CONFIG` is populated with partner-specific thresholds.
- Verify governance data files (`stewards.json`, `steward_votes.json`, `proposals.json`) are up to date.
- Run `node governance/governance-core.js --audit` prior to partner onboarding to confirm compliance settings.
- Capture the latest audit log output for reference in stewardship briefings.

## Integration Risk Factors
- Thresholds falling back to defaults reduce early-warning visibility for partners.
- Missing compliance contacts delay incident escalation and break dual-approval enforcement.
- Invalid YAML/JSON structures in governance config files can silently revert to defaults.

## Recovery Steps
- Re-parse configuration files with `node governance/governance-core.js --audit --config-path=<file>` after corrections.
- Notify stewards of restored quorum or multiplier thresholds via governance communication channels.
- Archive the regenerated audit summary and circulate to compliance stakeholders for confirmation.
