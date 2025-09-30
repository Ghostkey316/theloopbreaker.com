# Security Report

## Current Findings
- **Known CVEs:** None impacting Vaultfire-managed components or pinned dependencies as of the latest review.
- **Static Analysis & Linting:** Execute [`scripts/security-audit.sh`](../scripts/security-audit.sh) to run `npm audit fix`, Semgrep auto rules, and ESLint with zero-warning enforcement.
- **Dependency Audit:** `npm audit` reports two outstanding moderate transitive issues with no available upstream patches. Compensating controls are documented in `docs/technical-due-diligence.md`.

## Next Actions
- **Scheduled Full Audit:** Placeholder – align with partner security council for the Q3 2024 engagement window.
- **Follow-up Tasks:** Track Semgrep findings in `AUDIT_RESULTS.md` and ensure remediation updates land within the subsequent sprint.
