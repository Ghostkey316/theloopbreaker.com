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
