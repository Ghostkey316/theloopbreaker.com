const DEFAULT_LOGGER = {
  debug: () => {},
  info: () => {},
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

function sleep(ms, scheduler = setTimeout) {
  return new Promise((resolve) => scheduler(resolve, ms));
}

class RetryRelayError extends Error {
  constructor(message, { code = 'relay-error', retryable = true, cause = null } = {}) {
    super(message);
    this.name = 'RetryRelayError';
    this.code = code;
    this.retryable = retryable;
    if (cause) {
      this.cause = cause;
    }
  }
}

class RetryRelayHandler {
  constructor({
    maxAttempts = 5,
    baseDelayMs = 250,
    maxDelayMs = 30_000,
    jitter = 0.2,
    backoffFactor = 2,
    scheduler = setTimeout,
    randomFn = Math.random,
    logger = DEFAULT_LOGGER,
    softFailDelayMs = 60_000,
  } = {}) {
    this.maxAttempts = Math.max(1, maxAttempts);
    this.baseDelayMs = Math.max(1, baseDelayMs);
    this.maxDelayMs = Math.max(this.baseDelayMs, maxDelayMs);
    this.jitter = Math.max(0, jitter);
    this.backoffFactor = Math.max(1, backoffFactor);
    this.scheduler = typeof scheduler === 'function' ? scheduler : setTimeout;
    this.randomFn = typeof randomFn === 'function' ? randomFn : Math.random;
    this.logger = logger || DEFAULT_LOGGER;
    this.softFailDelayMs = Math.max(1000, softFailDelayMs);
  }

  #computeDelay(attempt) {
    const exponent = Math.max(0, attempt - 1);
    const base = Math.min(this.maxDelayMs, this.baseDelayMs * this.backoffFactor ** exponent);
    const jitterAmount = base * this.jitter * this.randomFn();
    return Math.min(this.maxDelayMs, base + jitterAmount);
  }

  async #scheduleRetry(task, options, delayMs) {
    this.scheduler(() => {
      task(options).catch((error) => {
        this.logger.warn('[retry-relay] background retry failed', error);
      });
    }, delayMs);
  }

  async run(task, {
    context = {},
    softFailFallback = null,
  } = {}) {
    if (typeof task !== 'function') {
      throw new RetryRelayError('Task function required', { retryable: false, code: 'invalid-task' });
    }

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxAttempts) {
      attempt += 1;
      try {
        const result = await task({ attempt, context });
        return {
          status: 'success',
          attempts: attempt,
          result,
        };
      } catch (error) {
        const retryable = error?.retryable !== false;
        lastError = error;
        this.logger.warn('[retry-relay] attempt failed', {
          attempt,
          error: error?.message || error,
          retryable,
          context,
        });

        if (!retryable) {
          return {
            status: 'failed',
            attempts: attempt,
            error,
          };
        }

        if (attempt >= this.maxAttempts) {
          break;
        }

        const delay = this.#computeDelay(attempt);
        await sleep(delay, this.scheduler);
      }
    }

    if (typeof softFailFallback === 'function') {
      try {
        await softFailFallback({
          error: lastError,
          attempts: attempt,
          context,
          scheduleRetry: (delayMs = this.softFailDelayMs) =>
            this.#scheduleRetry(async (opts) => this.run(task, opts), { context, softFailFallback }, delayMs),
        });
      } catch (fallbackError) {
        this.logger.error('[retry-relay] soft-fail fallback error', fallbackError);
      }
    }

    return {
      status: 'soft-fail',
      attempts: attempt,
      error: lastError,
    };
  }
}

module.exports = {
  RetryRelayError,
  RetryRelayHandler,
};
