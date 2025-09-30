# Vaultfire Load Test Results

> Placeholder report. Replace with k6 or Artillery output when available.

| Scenario | Tool | Virtual Users | Duration | Requests/s | Error Rate | Notes |
|----------|------|----------------|----------|------------|------------|-------|
| Partner handshake auth | k6 (planned) | 250 | 10m | _pending_ | _pending_ | Configure once staging endpoint is deployed. |
| Sync belief throughput | Artillery (planned) | 150 | 8m | _pending_ | _pending_ | Focus on signed handshake reuse and caching. |

## Next Steps
- [ ] Capture real load metrics from staging.
- [ ] Validate signature verification impact on latency.
- [ ] Share report with ops@vaultfire partners.
