# Operational Metrics Snapshot

## Simulated Uptime Trend
The following data simulates the last five weekly uptime checkpoints with a 99.95% target. Use the JSON as an input to dashboards or partner status pages.

- Data source: [`uptime.json`](./uptime.json)
- Target: **99.95%** rolling uptime
- Visual recommendation: Render as a line graph with target band shading for quick variance spotting.

| Week of | Uptime % |
| --- | --- |
| 2024-05-01 | 99.94 |
| 2024-05-08 | 99.96 |
| 2024-05-15 | 99.97 |
| 2024-05-22 | 99.95 |
| 2024-05-29 | 99.96 |

## Additional Signals
- Mirror node replication latency stays under 250ms in staging bursts.
- Governance event relays average < 50ms between Vaultfire and partner mirrors.
