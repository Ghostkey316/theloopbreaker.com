<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# CLI Runbook

## Setup Checklist
- Install dependencies with `npm install` and ensure Node.js 18.18+ is available.
- Configure `vaultfire.partner.config.json` using `vaultfire init` or the onboarding CLI wizard.
- Export any required environment variables (e.g., `VAULTFIRE_SANDBOX_MODE`) before invoking CLI actions.
- Confirm network access to the Partner Sync API endpoints used during tests.

## Integration Risk Factors
- Missing or stale partner configuration files can cause deployments to reuse sandbox credentials.
- Wallet addresses supplied via flags are case-sensitive; mismatched casing will fail signature verification.
- Rate limits on partner APIs can throttle automated sync or deployment commands if invoked rapidly.

## Recovery Steps
- Regenerate the partner config with `vaultfire init --overwrite` and reapply wallet + ENS values.
- Retry failed commands with `--verbose` to capture request/response metadata for audit logs.
- Rotate API tokens and re-run `node cli/deployVaultfire.js --env <target>` after resolving upstream downtime.
