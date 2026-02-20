/**
 * In-memory sliding window rate limiter for Ember chat API endpoints.
 *
 * Usage:
 *   import { createRateLimiter, RateLimitError } from "./_core/rateLimit";
 *   const limiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });
 *   limiter.check(userId); // throws RateLimitError if exceeded
 */

export class RateLimitError extends Error {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Rate limit exceeded. Please try again later.");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
  /** How often to run cleanup of expired entries (ms). Default: 5 minutes. */
  cleanupIntervalMs?: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowMs, cleanupIntervalMs = 5 * 60 * 1000 } = options;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, cleanupIntervalMs);

  // Allow garbage collection if the module is unloaded
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return {
    /**
     * Check if the given key (userId, IP, etc.) is within rate limits.
     * Throws RateLimitError if the limit is exceeded.
     */
    check(key: string): void {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the current window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = windowMs - (now - oldestInWindow);
        throw new RateLimitError(retryAfterMs);
      }

      entry.timestamps.push(now);
    },

    /**
     * Get remaining requests for a key.
     */
    remaining(key: string): number {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry) return maxRequests;
      const active = entry.timestamps.filter((t) => now - t < windowMs);
      return Math.max(0, maxRequests - active.length);
    },

    /**
     * Reset limits for a specific key.
     */
    reset(key: string): void {
      store.delete(key);
    },
  };
}

// Pre-configured limiters for Ember endpoints
export const emberSendMessageLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
});

export const emberQuickSendLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000, // 1 minute
});
