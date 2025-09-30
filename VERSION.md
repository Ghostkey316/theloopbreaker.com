# Vaultfire Protocol Version History

## v1.4.0 — 2024-09-12
- Added sandbox-mode toggles for belief and loyalty engines with JSON telemetry in `/tmp/belief-metrics.log`.
- Surfaced manifest metadata (ethics + scope tags) in `GET /status` responses and dashboard services.
- Hardened SecureStore telemetry retries with max-attempt safeguards and privacy toggles for telemetry deployments.
- Marked deployment manifests as `pilot_ready: true` and documented partner pilot rollout steps.

## v1.3.3 — 2024-07-02
- Introduced governance telemetry hooks for webhook relay safeguards.
- Refined loyalty multiplier escalation thresholds and dashboard partner filters.
- Expanded ethics manifest build automation inside the Vite dashboard pipeline.

## v1.3.0 — 2024-05-18
- Unified Codex manifest export tooling and rolled out reward-stream sandboxes.
- Added Socket.IO governance alert fan-out and ENS resolution fallbacks in the dashboard.
- Documented ethics guardrails and partner onboarding flow across CLI + API layers.
