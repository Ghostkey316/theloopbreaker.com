# Telemetry Runbook

## Setup Checklist
- Configure telemetry sinks in `configs/deployment/telemetry.yaml` or environment overrides.
- Initialise partner hook adapters with correct HTTPS endpoints before enabling live fan-out.
- Confirm filesystem permissions on `logs/` directories for local fallback storage.
- Execute telemetry adapter tests via `node scripts/run-test-suite.js` to validate retry + fallback flows.

## Integration Risk Factors
- Uninitialised adapters will reject writes, causing belief sync telemetry to drop silently.
- Network partitions without fallback storage risk data loss for compliance-grade partners.
- Misconfigured relay keys can prevent encrypted payloads from being recovered by partner nodes.

## Recovery Steps
- Re-run adapter initialisation with updated URLs and perform a manual health ping.
- Flush retry queues using `BeliefSyncEngine.processRetryQueue` once connectivity is restored.
- Inspect `logs/telemetry/` for buffered payloads and replay them after verifying integrity.
