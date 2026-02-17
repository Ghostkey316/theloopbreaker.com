/**
 * Tests for the Vaultfire Agent Retry Utility
 */

import { withRetry, sleep } from './retry';
import { Logger } from './logger';

// Suppress log output during tests
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('sleep', () => {
  it('should resolve after the specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('withRetry', () => {
  const log = new Logger('RetryTest');

  it('should return result on first successful call', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 3, 10, log, 'testOp');
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 3, 10, log, 'testOp');
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting all retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(withRetry(fn, 2, 10, log, 'testOp')).rejects.toThrow('persistent failure');
    // 1 initial + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should handle non-Error rejections', async () => {
    const fn = jest.fn().mockRejectedValue('string error');

    await expect(withRetry(fn, 0, 10, log, 'testOp')).rejects.toThrow('string error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, 1, 50, log, 'testOp');
    const elapsed = Date.now() - start;

    // First retry delay should be 50ms (baseDelay * 2^0)
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
