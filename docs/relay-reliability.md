# Relay Reliability Roadmap

## Current Fallback Queue Strategy
- Primary relay channel streams encrypted payloads directly to partner webhooks.
- On transient failures, the payload is mirrored into the existing fallback queue for manual replay by the ops team.
- Operators monitor the fallback queue using the telemetry ledger and re-dispatch items during scheduled reliability sweeps.

## Identified Gaps
- The fallback queue does not currently support automated retries for encrypted relay jobs.
- Messages remain in the queue until an operator intervenes, delaying downstream reconciliation windows.
- There is no telemetry annotation linking fallback events to the originating relay span.

## Proposal: Redis-Powered Retry Layer
- Introduce a dedicated Redis stream that tracks retry attempts alongside payload metadata.
- Apply exponential backoff beginning at 2 seconds and capping at 5 minutes to avoid saturation of partner endpoints.
- Encrypt payloads at rest in Redis using envelope encryption to preserve existing security guarantees.
- Emit structured telemetry (`relay.retry.enqueued`, `relay.retry.success`, `relay.retry.exhausted`) for observability and SLA reporting.
- Auto-evict jobs that exceed the maximum retry threshold, notifying the ops channel for manual investigation.
