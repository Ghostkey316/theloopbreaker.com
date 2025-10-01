# Signal Relay Overview

Vaultfire propagates belief updates to partner systems through the signal relay
module. Relays sign and encrypt outbound payloads, honour residency policies, and
mirror every attempt into telemetry so incidents can be audited after the fact.

## Resilience strategies
- **Inline retries:** The relay invokes the shared `RetryRelayHandler` to retry
  network and 5xx failures with exponential backoff before a job is queued. This
  keeps hot-path deliveries responsive during transient incidents.
- **Durable queues:** Every failed delivery is stored in
  `logs/partner_relays/retry-schedule.json` with the next attempt timestamp,
  attempt count, and circuit state. Operators can drain the queue via
  `BeliefSyncEngine.processRetryQueue()` or scripted automation.
- **Circuit breaker:** Nodes that repeatedly fail enter an open state, delaying
  further attempts until the cooldown window expires. Successful deliveries reset
  the breaker so healthy partners resume normal cadence.
- **Telemetry hooks:** The relay records `signal.relay.scheduled`,
  `signal.relay.delivered`, `signal.relay.failed`, and preview events so
  dashboards and on-call runbooks can track queue depth, failure reasons, and
  resolution times.

See [`docs/relay-reliability.md`](./relay-reliability.md) for a detailed runbook
covering queue inspection, replay commands, and configuration knobs.
