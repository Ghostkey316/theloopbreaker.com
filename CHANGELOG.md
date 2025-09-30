# Vaultfire Partner Changelog

## 2025-09-19 — v2.6.0-alpha Partner Readiness
- Added `signalRelay.retry()` with exponential backoff and a circuit-breaker
  guard to stabilise remote belief sync deliveries during partner outages.
- Hardened Trust Sync verification by enforcing timestamp windows, replay
  protection, and checksum fallbacks exposed via `trustSync.verify()`.
- Introduced the JavaScript loyalty engine with on-chain multiplier wiring,
  telemetry anchors, and the `calculateMultiplier()` interface for partner
  reward orchestration.
- Expanded Jest coverage with dedicated suites for the signal relay, Trust Sync
  verifier, and loyalty engine multiplier mapping.

## 2025-08-15 — v1.2.0-rc Partner Hardening
- Added `pilot-loader.js` with `VAULTFIRE_MODULE_SCOPE` controls so pilots boot only CLI, dashboard, and belief engines when `pilot_mode=true`.
- Introduced governance config loader supporting `.govrc`/`--config-path=` overrides, default-threshold warnings, and `npm run audit:gov` self-audits.
- Hardened telemetry fallbacks with JSON sink mirroring, partner hook adapters, and residency-aware docs for compliance teams.
- Refreshed partner documentation with a risk matrix, governance tuning playbook, and telemetry residency guidance.
- Expanded Vaultfire Core to support multi-wallet whitelists via `WALLET_WHITELIST` overrides while keeping single-wallet mode as the default.
- Added operational runbooks and onboarding coverage tooling so every module ships with setup, risk, and recovery guidance.

## 2025-02-20 — Pilot Upgrade Readiness
- Enabled belief sandbox observability with `/debug/belief-sandbox` and JSON logging for belief mechanics, loyalty engine, and multiplier core sandboxes.
- Automated manifest version stamping (commit hash + semantic version) during `npm run build` so partners can verify build provenance.
- Captured Jest summaries in `/logs/test-report.json`, refreshed the test status badge, and enforced the integrity suite inside the pre-push hook.
- Published governance, data residency, and onboarding quickstart docs to streamline partner due diligence reviews.
