const { describe, it, expect, jest } = require('@jest/globals');

describe('Relay reliability fallback and retry', () => {
  function createRelay({ sendFn, redisClient, scheduleRetry }) {
    const primaryQueue = [];

    return {
      enqueue(message) {
        primaryQueue.push({ ...message, attempts: 0 });
      },
      async processPrimary() {
        if (primaryQueue.length === 0) return null;
        const job = primaryQueue.shift();
        try {
          await sendFn(job);
          return 'delivered';
        } catch (error) {
          const nextAttempt = job.attempts + 1;
          const payload = { ...job, attempts: nextAttempt };
          redisClient.lpush('relay:fallback', JSON.stringify(payload));
          const delay = Math.min(5 * 60 * 1000, 2 ** nextAttempt * 1000);
          scheduleRetry(payload, delay, error);
          return 'fallback';
        }
      },
      async processFallback() {
        const serialized = redisClient.rpop('relay:fallback');
        if (!serialized) return null;
        const job = JSON.parse(serialized);
        try {
          await sendFn(job);
          return 'replayed';
        } catch (error) {
          const nextAttempt = job.attempts + 1;
          const payload = { ...job, attempts: nextAttempt };
          redisClient.lpush('relay:fallback', JSON.stringify(payload));
          const delay = Math.min(5 * 60 * 1000, 2 ** nextAttempt * 1000);
          scheduleRetry(payload, delay, error);
          return 'fallback';
        }
      },
    };
  }

  function createRedisMock() {
    const queues = { 'relay:fallback': [] };
    return {
      lpush(queue, value) {
        queues[queue] = queues[queue] || [];
        queues[queue].unshift(value);
        return queues[queue].length;
      },
      rpop(queue) {
        queues[queue] = queues[queue] || [];
        return queues[queue].pop() || null;
      },
      size(queue) {
        return (queues[queue] || []).length;
      },
    };
  }

  it('queues failed messages to fallback and retries with backoff', async () => {
    const redisMock = createRedisMock();
    const scheduleRetry = jest.fn();
    const sendFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce('ok');

    const relay = createRelay({ sendFn, redisClient: redisMock, scheduleRetry });
    relay.enqueue({ id: 'job-1', payload: 'encrypted-payload' });

    const primaryResult = await relay.processPrimary();
    expect(primaryResult).toBe('fallback');
    expect(redisMock.size('relay:fallback')).toBe(1);
    expect(scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1', attempts: 1 }),
      2000,
      expect.any(Error)
    );

    const fallbackResult = await relay.processFallback();
    expect(fallbackResult).toBe('replayed');
    expect(redisMock.size('relay:fallback')).toBe(0);
    expect(sendFn).toHaveBeenCalledTimes(2);
  });
});
