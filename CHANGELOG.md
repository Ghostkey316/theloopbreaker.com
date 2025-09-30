# Vaultfire Partner Changelog

## 2025-02-20 — Pilot Upgrade Readiness
- Enabled belief sandbox observability with `/debug/belief-sandbox` and JSON logging for belief mechanics, loyalty engine, and multiplier core sandboxes.
- Automated manifest version stamping (commit hash + semantic version) during `npm run build` so partners can verify build provenance.
- Captured Jest summaries in `/logs/test-report.json`, refreshed the test status badge, and enforced the integrity suite inside the pre-push hook.
- Published governance, data residency, and onboarding quickstart docs to streamline partner due diligence reviews.
