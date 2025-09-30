# Vaultfire Security & Telemetry Policy

## Defense-in-Depth Controls
- **HTTP hardening:** Every Express entry point loads Helmet to enforce modern security headers and disables the `x-powered-by` fingerprint.
- **Network boundaries:** Socket and webhook consumers require explicit allow-lists. Default CORS origins are scoped to Vaultfire domains and localhost development targets.
- **SSRF prevention:** Partner webhook registration rejects loopback, RFC1918, and `.local` targets and only permits HTTPS/HTTP schemes.
- **Authentication rigor:** Bearer token middleware validates role scopes and rate limits requests. Regression tests cover invalid JWT and malformed wallet payload rejection.

## Telemetry Consent Model
- **Opt-in only:** Telemetry is disabled until a wallet explicitly enables consent either through the dashboard toggle or CLI flag. No data is transmitted without consent.
- **Wallet-scoped storage:** Consent is persisted per wallet (localStorage in the dashboard, encrypted JSON store for CLI flows) and can be revoked at any time.
- **Event boundaries:** With consent, the system records three events to Sentry—wallet login success/failure, dashboard render, and belief vote casts. No payload metadata or signatures are persisted.
- **Auditability:** Telemetry consent files live at `~/.vaultfire/telemetry-consent.json` (overridable via `VAULTFIRE_TELEMETRY_STORE`) for partner audits and can be removed to revoke consent.

## Reporting Issues
- Responsible disclosures are welcomed via security@vaultfire.org.
- Include reproduction steps, environment details, and potential impact. GPG key: `B7F5 F0CC 9D62 73F8 214A  792F 1A63 5ED4 7C3B 9F3E`.
- Critical issues receive acknowledgement within 24 hours and coordinated disclosure is preferred.

## Dependency Compensating Controls
- **GHSA-pxg6-pf52-xh8x (`cookie` <0.7.0 via `hardhat` → `@sentry/node@5.30.0`):**
  - `infra/hardhat-sandbox.js` now short-circuits Hardhat's internal Sentry bootstrap with a no-op stub that never instantiates
    the vulnerable `cookie` parser, while still allowing first-party code to load the modern `@sentry/node@10.x` dependency.
  - The sandbox also enforces loopback-only RPC URLs and disables remote telemetry to prevent any Hardhat-managed process from
    accepting untrusted cookie headers.
  - **Future remediation:** Track Hardhat releases monthly and upgrade once a version bundles a patched Sentry stack (or removes
    the dependency entirely). Remove the stub once the upstream chain ships a fixed `cookie` >=0.7.0.
- **GHSA-52f5-9888-hmc6 (`tmp` <=0.2.3 via `solc`):**
  - The sandbox wraps the `tmp` module whenever it is required from `solc`/Hardhat, forcing all temporary directories into
    `.vaultfire_tmp/hardhat/sandbox-tmp` with `0o700` ownership and ignoring caller-provided `dir` hints that could point to
    symlink traps.
  - `TMPDIR`, `TMP`, and `TEMP` environment variables are pinned to the sandbox directory before Hardhat executes, closing the
    symbolic link escalation vector documented in the advisory.
  - **Future remediation:** Monitor the `solc` and `tmp` release streams during the first week of each month. Once a patched
    `tmp` (>0.2.3) is published and consumed by `solc`, drop the wrapper and lock to the remediated version in `package-lock.json`.

## Governance Cadence
- Run `npm run security:watch` at least once per week (automated via CI cron) to capture an `npm audit --json` snapshot in
  `logs/security-watch.log` along with exit codes for traceability.
- During the monthly dependency review, compare the latest log entries with upstream advisories and document remediation status
  in the CHANGELOG or release notes.
