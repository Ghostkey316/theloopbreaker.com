const SignalRouter = require('../signalRouter');
const { RetryRelayError } = require('../services/retryRelayHandler');

describe('SignalRouter', () => {
  test('routes signal to resolved endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const handler = {
      run: jest.fn(async (task, options) => ({
        status: 'success',
        result: await task({ attempt: 1, context: options.context }),
      })),
    };
    const router = new SignalRouter({
      endpoints: { mirror: 'https://mirror.test/sync' },
      fetchImpl: fetchMock,
      relayHandler: handler,
      logger: { debug: jest.fn(), warn: jest.fn() },
    });

    const result = await router.route({ id: 'sync-1', target: 'mirror', payload: { value: 42 } });

    expect(fetchMock).toHaveBeenCalledWith('https://mirror.test/sync', expect.objectContaining({ method: 'POST' }));
    expect(result.result.status).toBe(200);
    expect(handler.run).toHaveBeenCalled();
  });

  test('records soft fail and schedules retry when remote errors persist', async () => {
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

    const router = new SignalRouter({
      fetchImpl: fetchMock,
      relayHandler: handler,
      logger: { warn: jest.fn(), debug: jest.fn() },
    });
    const result = await router.route({ id: 'sync-2', target: 'https://api.partner/sync', payload: { state: 'pending' } }, { softFailDelayMs: 9000 });

    expect(result.status).toBe('soft-fail');
    expect(scheduleRetry).toHaveBeenCalledWith(9000);
    const ledger = router.inspectSoftFails('https://api.partner/sync');
    expect(ledger).toHaveLength(1);
    expect(ledger[0].payload.id).toBe('sync-2');
  });

  test('fails fast for missing endpoints', async () => {
    const router = new SignalRouter({ logger: { warn: jest.fn(), debug: jest.fn() } });
    await expect(router.route({ id: 'missing', target: null })).resolves.toMatchObject({ status: 'failed' });
  });

  test('registerEndpoint validates inputs and exposes ledger summaries', () => {
    const router = new SignalRouter({ logger: { warn: jest.fn(), debug: jest.fn() } });
    expect(() => router.registerEndpoint('', 'https://example.com')).toThrow('Endpoint key must be a non-empty string');
    expect(() => router.registerEndpoint('api', '')).toThrow('Endpoint url must be a non-empty string');

    router.registerEndpoint('api', 'https://api.test');
    router.inspectSoftFails();
    router.softFailLedger.set('https://api.test', [{ timestamp: 1, payload: {} }]);
    expect(router.inspectSoftFails()).toEqual([
      { key: 'https://api.test', entries: [{ timestamp: 1, payload: {} }] },
    ]);
  });
});
