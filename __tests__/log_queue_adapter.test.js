const { LogQueueAdapter } = require('../vaultfire/storage/log_queue_adapter');

describe('LogQueueAdapter', () => {
  const createBackend = () => ({
    id: 'test-backend',
    append: jest.fn(async (records) => records.length),
  });

  it('flushes automatically when max batch size is reached', async () => {
    const backend = createBackend();
    const adapter = new LogQueueAdapter({
      backend,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      defaults: {
        flushIntervalMs: 0,
        maxBatchSize: 2,
        maxQueueSize: 10,
      },
    });

    const firstResult = await adapter.enqueue({ message: 'alpha' });
    expect(firstResult.appended).toBe(0);
    expect(backend.append).not.toHaveBeenCalled();

    const secondResult = await adapter.enqueue({ message: 'beta' });
    expect(secondResult.appended).toBe(2);
    expect(backend.append).toHaveBeenCalledTimes(1);

    const [records, context] = backend.append.mock.calls[0];
    expect(records).toHaveLength(2);
    expect(typeof records[0].payload).toBe('string');
    expect(context.reason).toBe('maxBatch');
    expect(context.config.maxBatchSize).toBe(2);

    await adapter.shutdown();
  });

  it('merges runtime config overrides with defaults', async () => {
    const backend = createBackend();
    const adapter = new LogQueueAdapter({
      backend,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      defaults: {
        flushIntervalMs: 0,
        maxBatchSize: 4,
        maxQueueSize: 25,
        metadata: { region: 'primary' },
        backendOptions: { stream: 'telemetry' },
      },
      configOverrides: {
        maxBatchSize: 3,
        metadata: { shard: 'edge' },
        backendOptions: { compression: 'gzip' },
      },
    });

    expect(adapter.config.maxBatchSize).toBe(3);
    expect(adapter.config.metadata).toEqual({ region: 'primary', shard: 'edge' });
    expect(adapter.config.backendOptions).toEqual({ stream: 'telemetry', compression: 'gzip' });

    adapter.updateConfig({ maxQueueSize: 200 });
    expect(adapter.config.maxQueueSize).toBe(200);

    adapter.updateConfig({ metadata: { schema: 'v2' } });
    expect(adapter.config.metadata).toEqual({ region: 'primary', shard: 'edge', schema: 'v2' });

    await adapter.shutdown();
  });

  it('requeues entries when the backend append fails', async () => {
    const backend = createBackend();
    backend.append
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockImplementationOnce(async (records) => records.length);

    const adapter = new LogQueueAdapter({
      backend,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      defaults: {
        flushIntervalMs: 0,
        maxBatchSize: 5,
        maxQueueSize: 10,
      },
    });

    await adapter.enqueue({ level: 'warn', message: 'first' });
    await expect(adapter.flush()).rejects.toThrow('boom');
    expect(adapter.size).toBe(1);

    const result = await adapter.flush();
    expect(result.appended).toBe(1);
    expect(adapter.size).toBe(0);
    expect(backend.append).toHaveBeenCalledTimes(2);

    await adapter.shutdown();
  });
});
