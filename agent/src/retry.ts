/**
 * Vaultfire Agent — Retry Utility
 *
 * Provides exponential-backoff retry logic for blockchain transactions
 * and RPC calls that may fail transiently.
 */

import { Logger } from './logger';

/**
 * Execute an async operation with exponential backoff retries.
 *
 * @param fn - The async function to execute
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelayMs - Base delay in milliseconds (doubles each retry)
 * @param log - Logger instance for status messages
 * @param operationName - Human-readable name for logging
 * @returns The result of the successful function call
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number,
  log: Logger,
  operationName: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  log.error(`${operationName} failed after ${maxRetries + 1} attempts`, {
    error: lastError?.message,
  });
  throw lastError;
}

/**
 * Sleep for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
