# Jittered Webhook Delivery Queue

Vaultfire partners receive signed webhook callbacks via a jittered retry queue.
The queue spreads retries with exponential backoff and configurable jitter so
partner infrastructure can absorb bursts during campaign launches.

## Runtime tuning

| Option | Description | Sandbox default |
| --- | --- | --- |
| `maxRetries` | Maximum delivery attempts before giving up. | `3` |
| `baseDelayMs` | Initial delay for retry backoff. Doubled on each attempt. | `250` |
| `maxDelayMs` | Upper bound for delay growth. | `10000` |
| `jitter` | Randomisation factor applied to each delay. | `0.25` |
| `randomFn` | Optional deterministic RNG for tests. | `Math.random` |

Use the new `sampleDelays(attempt, samples)` helper to inspect jitter
distribution during load tests:

```js
const queue = new WebhookDeliveryQueue({ baseDelayMs: 500, jitter: 0.35 });
const values = queue.sampleDelays(3, 25);
console.log('Median retry delay', values.sort()[12]);
```

## Queue inspection

Call `queue.inspectConfig()` to surface the effective runtime configuration for
observability dashboards or diagnostics.

## Partner guidance

- Sandbox environments can use higher jitter (0.35–0.5) to surface worst-case
  retries. Production clusters typically run between 0.2 and 0.3.
- Monitor telemetry channel `webhook.delivery` for `error:` statuses. Combine
  with the deployment YAML in `configs/deployment/relay.yaml` to keep SLOs in
  sync with Vaultfire expectations.
- Queue flushes (`queue.flush()`) now await all pending promises so CI
  environments can assert delivery outcomes before exiting.
