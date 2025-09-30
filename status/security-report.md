# Security Report

## Current Findings
- **Known CVEs:** None impacting Vaultfire-managed components or pinned dependencies as of the latest review.
- **Static Analysis & Linting:** Execute [`scripts/security-audit.sh`](../scripts/security-audit.sh) to run `npm audit fix`, Semgrep auto rules, and ESLint with zero-warning enforcement.
- **Dependency Audit:** `npm audit` continues to flag GHSA-pxg6-pf52-xh8x (`cookie`) and GHSA-52f5-9888-hmc6 (`tmp`). Hardhat is sandboxed via `infra/hardhat-sandbox.js` to disable internal Sentry telemetry and to confine all temp directories to `.vaultfire_tmp`. Weekly governance runs `npm run security:watch` to capture audit output.

## Next Actions
- **Scheduled Full Audit:** Placeholder – align with partner security council for the Q3 2024 engagement window.
- **Follow-up Tasks:** Track Semgrep findings in `AUDIT_RESULTS.md` and ensure remediation updates land within the subsequent sprint.
