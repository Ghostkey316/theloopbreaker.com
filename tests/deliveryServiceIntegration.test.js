const DeliveryService = require('../services/deliveryService');
const { RetryRelayError } = require('../services/retryRelayHandler');

describe('DeliveryService', () => {
  test('delivers payload via fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    const handler = {
      run: jest.fn(async (task, options) => ({
        status: 'success',
        result: await task({ attempt: 1, context: options.context }),
      })),
    };
    const service = new DeliveryService({
      fetchImpl: fetchMock,
      relayHandler: handler,
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    const result = await service.deliver({ url: 'https://hooks.test', payload: { ping: true } });

    expect(fetchMock).toHaveBeenCalledWith('https://hooks.test', expect.objectContaining({ method: 'POST' }));
    expect(result.result.status).toBe(204);
  });

  test('queues soft-fail retries without blocking', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const scheduleRetry = jest.fn();
    const handler = {
      run: jest.fn(async (task, options) => {
        try {
          const result = await task({ attempt: 1, context: options.context });
          return { status: 'success', result };
        } catch (error) {
          await options.softFailFallback({ scheduleRetry, error, context: options.context });
          return { status: 'soft-fail', error };
        }
      }),
    };
    const service = new DeliveryService({
      fetchImpl: fetchMock,
      relayHandler: handler,
      logger: { warn: jest.fn(), error: jest.fn() },
    });

    const result = await service.deliver({ url: 'https://hooks.test', payload: { ping: true } }, { softFailDelayMs: 2222 });
    expect(result.status).toBe('soft-fail');
    expect(scheduleRetry).toHaveBeenCalledWith(2222);
    const queue = service.drainSoftFailQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].url).toBe('https://hooks.test');
  });

  test('treats non-retryable errors as failures', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    const service = new DeliveryService({ fetchImpl: fetchMock, relayHandler: null, logger: { warn: jest.fn(), error: jest.fn() } });
    const result = await service.deliver({ url: 'https://hooks.test', payload: {} });
    expect(result.status).toBe('failed');
  });

  test('delivers batches and clears soft fail queue', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const scheduleRetry = jest.fn();
    const handler = {
      run: jest.fn(async (task, options) => {
        await options.softFailFallback({ scheduleRetry, error: new RetryRelayError('nope'), context: options.context });
        return { status: 'soft-fail' };
      }),
    };
    const service = new DeliveryService({ fetchImpl: fetchMock, relayHandler: handler, logger: { warn: jest.fn(), error: jest.fn() } });
    const results = await service.deliverBatch([
      { url: 'https://one.test', payload: { ok: false } },
      { url: 'https://two.test', payload: { ok: false } },
    ]);

    expect(results).toHaveLength(2);
    expect(service.drainSoftFailQueue()).toHaveLength(2);
    expect(service.drainSoftFailQueue()).toHaveLength(0);
  });
});
