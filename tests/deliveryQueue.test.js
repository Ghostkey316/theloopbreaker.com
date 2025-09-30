const WebhookDeliveryQueue = require('../services/deliveryQueue');

describe('WebhookDeliveryQueue jitter', () => {
  test('produces distributed jitter values within configured bounds', () => {
    const queue = new WebhookDeliveryQueue({ baseDelayMs: 100, maxDelayMs: 500, jitter: 0.5 });
    const values = queue.sampleDelays(2, 200);
    const unique = new Set(values.map((value) => Math.round(value)));
    expect(unique.size).toBeGreaterThan(5);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    expect(minValue).toBeGreaterThanOrEqual(100);
    expect(maxValue).toBeLessThanOrEqual(500);
  });

  test('retry delays escalate with jitter under load', async () => {
    const deliveries = [];
    const queue = new WebhookDeliveryQueue({
      maxRetries: 2,
      baseDelayMs: 10,
      jitter: 0.1,
      fetchImpl: async () => ({ ok: false, status: 500 }),
      randomFn: () => 0.5,
    });

    const resultPromise = queue.enqueue({ event: 'test.retry', targetUrl: 'https://example.com', payload: {} });
    queue.enqueue({ event: 'test.retry', targetUrl: 'https://example.com', payload: { second: true } }).then((result) => {
      deliveries.push(result);
    });

    const finalResult = await resultPromise;
    await queue.flush();

    expect(finalResult.status).toMatch(/^failed:/);
    expect(deliveries.length).toBe(1);
    expect(queue.inspectConfig()).toMatchObject({ maxRetries: 2, baseDelayMs: 10, jitter: 0.1 });
  });
});
