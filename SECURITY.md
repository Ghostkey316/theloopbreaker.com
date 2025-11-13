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
- **Schema enforcement:** Runtime guards follow [`docs/telemetry-schema.md`](./docs/telemetry-schema.md). Events outside the schema are rejected and logged for investigation.

## Secrets Handling & Storage
- **Never commit secrets:** `.env`, `.env.local`, and other credential files are ignored via `.gitignore`. Keep them out of git history.
- **Use real secret managers:** For production, load keys from AWS KMS, Google Secret Manager, Azure Key Vault, or HashiCorp Vault instead of exporting raw values in shells.
- **Ephemeral rehearsal keys only:** Follow the README guidance—commands use placeholders such as `TEST_ONLY_DO_NOT_USE_REAL_KEYS`. Replace them with throwaway credentials during simulations and rotate immediately afterwards.
- **Shell hygiene:** Prefer `direnv`, `pass`, or encrypted keychains over storing secrets in shell history. Run `history -c` after rehearsals when using shared environments.

## Reporting Issues
- Responsible disclosures are welcomed via security@vaultfire.org.
- Include reproduction steps, environment details, and potential impact. GPG key: `B7F5 F0CC 9D62 73F8 214A  792F 1A63 5ED4 7C3B 9F3E`.
- Critical issues receive acknowledgement within 24 hours and coordinated disclosure is preferred.

## Dependency Remediation Log
- **2025-09-30 · Vaultfire `1.2.0-rc` · GHSA-pxg6-pf52-xh8x (`cookie` <0.7.0 via `hardhat` → `@sentry/node@5.30.0`):**
  - Hardhat's transitive `@sentry/node` dependency is now forced to consume `cookie@1.0.2` through `package.json` overrides, eliminating the out-of-bounds cookie parsing vector without relying on sandbox stubs.
  - The repository-wide override also dedupes all other `cookie` consumers (Express, Socket.IO) on the same patched release to guarantee uniform behaviour.
- **2025-09-30 · Vaultfire `1.2.0-rc` · GHSA-52f5-9888-hmc6 (`tmp` <=0.2.3 via `solc`):**
  - `package.json` overrides pin `solc` to `tmp@0.2.5`, which contains the upstream directory traversal mitigation, removing the need for temporary directory guardrails.
  - The standalone `tmp` override ensures any future consumer inherits the same patched baseline so symbolic link exploits remain blocked.

- **2025-10-07 · Vaultfire `1.2.0-rc` · GHSA-pxg6-pf52-xh8x / GHSA-52f5-9888-hmc6:**
  - Verified `npm audit --json` returns zero vulnerabilities with the existing overrides and captured the report in CI for traceability.
  - Left the overrides in place so downstream consumers inherit the hardened `cookie@1.0.2` and `tmp@0.2.5` baselines.

Both advisories now resolve cleanly via `npm audit`, and the previous Hardhat sandbox remains available but is no longer required for mitigation.

## Governance Cadence
- Run `npm run security:watch` at least once per week (automated via CI cron) to capture an `npm audit --json` snapshot in
  `logs/security-watch.log` along with exit codes for traceability.
- During the monthly dependency review, compare the latest log entries with upstream advisories and document remediation status
  in the CHANGELOG or release notes.

---

Additional context: consult [`docs/threat-model.md`](./docs/threat-model.md) for a living list of high-impact risks and [`README.md`](./README.md) for component maturity notes before onboarding new collaborators.
