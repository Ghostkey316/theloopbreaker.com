# Operational Observability

Vaultfire services expose production-aligned telemetry through both structured logs and Prometheus metrics. This document outlines the default metrics, how to ingest them, and guidance for partner visibility.

## Metrics Endpoints

| Service | Endpoint | Notes |
|---------|----------|-------|
| `auth/expressExample.js` | `GET /metrics/ops` | Returns Prometheus text format metrics for queue depth, retries, posture changes, and default Node process series. |
| `partnerSync.js` | `GET /metrics/ops` | Mirrors the API sample endpoint and includes the same operational gauges and counters. |

All endpoints return `text/plain` content using the Prometheus exposition format. Scrape intervals of 15–30 seconds work well in test environments; production partners typically scrape every 5 seconds during launch windows and back off to 30 seconds during steady state.

## Metric Catalogue

| Metric | Type | Description |
|--------|------|-------------|
| `vaultfire_webhook_delivery_queue_depth{state="queued"}` | Gauge | Pending webhook deliveries waiting to be processed. |
| `vaultfire_webhook_delivery_queue_depth{state="in_flight"}` | Gauge | Deliveries actively being attempted. |
| `vaultfire_webhook_delivery_retries_total{reason="retryable"}` | Counter | Number of retry attempts triggered by transient errors. The `reason` label captures HTTP or network error categories when available. |
| `vaultfire_webhook_delivery_outcomes_total{status="delivered"}` | Counter | Terminal delivery outcomes grouped by status (e.g. `delivered`, `error:500`, `failed:network-error`). |
| `vaultfire_security_posture_changes_total{status="rotating"}` | Counter | Count of security posture transitions observed across governance refreshes. A `legacy` status indicates handshake secrets are optional. |

Metrics originate from the shared `OpsMetrics` registry (`services/opsMetrics.js`). Each service reuses the registry so partners can plug the same exporter into internal observability stacks.

## Structured Telemetry Extensions

Telemetry events recorded via `MultiTierTelemetryLedger` now include:

- `ops.webhookQueue.depth` – emitted whenever the combined queue and in-flight depth changes.
- `ops.webhookQueue.retry` – emitted for each retry attempt with the latest attempt count and last error.
- `ops.webhookQueue.delivery` – emitted when a delivery completes with final status and attempts.
- `security.posture.changed` – emitted when handshake posture changes from legacy to rotating (or vice versa).

Events surface in partner, ethics, and audit logs according to the configured visibility settings. Partners can stream these logs into SIEM tooling or leverage the bundled `partnerHooks` service for webhook-based notifications.

## Alerting Suggestions

1. **Queue Backlog:** Alert when `vaultfire_webhook_delivery_queue_depth{state="queued"}` exceeds 50 for more than 5 minutes.
2. **Retry Storm:** Alert when the 5-minute rate of `vaultfire_webhook_delivery_retries_total` jumps above 10 per minute.
3. **Posture Drift:** Alert when `vaultfire_security_posture_changes_total` increments unexpectedly outside scheduled rotations.
4. **Delivery Failures:** Track ratios of `vaultfire_webhook_delivery_outcomes_total{status!~"delivered"}` to successful deliveries.

## Exporting to Partner Systems

- **Prometheus / Thanos:** Add scrape configs pointing at the `/metrics/ops` endpoints. TLS termination can be provided via API Gateway or Ingress controllers.
- **Datadog:** Use the Prometheus integration or an OpenMetrics check with the same endpoints.
- **Grafana Cloud:** Configure Grafana Agent/Alloy to scrape and forward metrics, then build dashboards highlighting queue pressure, retry ratios, and governance posture transitions.

For more detail on compliance visibility, see `docs/compliance-review.md` and `governance/runbooks.md`.
