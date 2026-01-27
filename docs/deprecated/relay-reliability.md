# Relay Reliability Guide

Vaultfire partner relays deliver encrypted belief signals to downstream webhooks and
partner-operated nodes. The delivery system now combines synchronous retry logic
with a durable on-disk schedule so transient network issues or regional outages do
not drop critical payloads.

## Delivery Flow
- The primary relay issues an HTTPS POST to the partner endpoint with an encrypted
  payload when a belief event is emitted.
- Failures record an immediate telemetry event (`signal.relay.failed`) and enqueue
  the job in `logs/partner_relays/retry-schedule.json` for durable replay.
- Fallback records are also written to `logs/partner_relays/<partner>.jsonl` so
  operators can manually inspect or replay historical deliveries.

## Resilience Strategies
- **Immediate retry handler:** `SignalRelay.dispatch()` uses the `RetryRelayHandler`
  to perform a burst of exponential-backoff retries without blocking the belief
  engine. The handler honours HTTP semantics: 5xx responses and network errors are
  retried, while 4xx responses are soft-failed for operator review.
- **Durable schedule:** The retry queue stores the next attempt timestamp,
  attempts counter, circuit snapshot, and last error. `BeliefSyncEngine.processRetryQueue()`
  drains due jobs and honours circuit-breaker cooldowns so partner nodes are not
  overwhelmed when they come back online.
- **Circuit breaker:** Consecutive failures open the breaker for a node and delay
  further attempts until the cooldown expires. Successful deliveries automatically
  reset the breaker state.
- **Telemetry coverage:** The relay emits `signal.relay.scheduled`,
  `signal.relay.delivered`, and `signal.relay.failed` events so operations teams can
  track queue depth and resolution timelines in real time.

## Operational Runbook
1. Inspect `logs/partner_relays/retry-schedule.json` to confirm queued jobs and
   their `nextAttemptAt` timestamp.
2. Call `BeliefSyncEngine.processRetryQueue({ now: Date.now() })` (or run
   `npm run signal-retry` if scripted) after restoring partner connectivity.
3. Review the partner-specific JSONL fallback file for encrypted copies of each
   payload when manual replay is required.
4. Monitor the telemetry channel for `signal.relay.*` events to confirm delivery
   health during incident response.

## Configuration Notes
- Adjust retry timing via `RetryRelayHandler` options when instantiating
  `SignalRelay` (e.g., base delay, jitter, and maximum attempts).
- `trustSync.telemetry` controls where telemetry events are mirrored; combine with
  the durable schedule to build partner-facing reliability dashboards.
- The circuit breaker defaults to three failures with a 60-second cooldown and can
  be tuned per deployment using the `circuitBreaker` options passed to
  `createSignalRelay()`.
