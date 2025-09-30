const { RetryRelayHandler, RetryRelayError } = require('../services/retryRelayHandler');

describe('RetryRelayHandler', () => {
  test('retries retryable errors until success', async () => {
    const delays = [];
    const scheduler = (cb, delay) => {
      delays.push(delay);
      cb();
    };
    const handler = new RetryRelayHandler({
      maxAttempts: 3,
      baseDelayMs: 10,
      scheduler,
      randomFn: () => 0,
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    let attempts = 0;
    const result = await handler.run(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new RetryRelayError('boom');
      }
      return { attempts };
    });

    expect(result.status).toBe('success');
    expect(result.attempts).toBe(3);
    expect(delays.length).toBe(2); // two backoff waits
    expect(Math.max(...delays)).toBeGreaterThanOrEqual(10);
  });

  test('invokes soft-fail fallback when attempts exhausted', async () => {
    const scheduled = [];
    const handler = new RetryRelayHandler({
      maxAttempts: 1,
      scheduler: (cb, delay) => scheduled.push({ cb, delay }),
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    const fallback = jest.fn(async ({ scheduleRetry }) => {
      scheduleRetry(1234);
    });

    const result = await handler.run(async () => {
      throw new RetryRelayError('nope', { retryable: true });
    }, { softFailFallback: fallback, context: { id: 'sig-1' } });

    expect(result.status).toBe('soft-fail');
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBe(1234);
  });

  test('propagates invalid task errors', async () => {
    const handler = new RetryRelayHandler();
    await expect(handler.run(null)).rejects.toThrow(/Task function required/);
  });

  test('stops when error is marked non-retryable', async () => {
    const handler = new RetryRelayHandler({ logger: { warn: jest.fn(), error: jest.fn() } });
    const result = await handler.run(async () => {
      throw new RetryRelayError('fatal', { retryable: false });
    });
    expect(result.status).toBe('failed');
    expect(result.error.message).toBe('fatal');
  });

  test('logs when fallback throws an error', async () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    const handler = new RetryRelayHandler({ maxAttempts: 1, logger });
    const fallback = jest.fn(() => {
      throw new Error('fallback failure');
    });

    const result = await handler.run(async () => {
      throw new RetryRelayError('oops');
    }, { softFailFallback: fallback });

    expect(result.status).toBe('soft-fail');
    expect(logger.error).toHaveBeenCalledWith('[retry-relay] soft-fail fallback error', expect.any(Error));
  });
});
