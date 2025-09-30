const { RetryRelayHandler, RetryRelayError } = require('./retryRelayHandler');

const globalFetch = typeof fetch === 'function' ? fetch : require('node-fetch');

class DeliveryService {
  constructor({
    relayHandler = null,
    fetchImpl = globalFetch,
    logger = console,
    softFailDelayMs = 60_000,
  } = {}) {
    this.logger = logger || console;
    this.fetch = typeof fetchImpl === 'function' ? fetchImpl : globalFetch;
    this.softFailDelayMs = softFailDelayMs;
    this.retryHandler =
      relayHandler && typeof relayHandler.run === 'function'
        ? relayHandler
        : new RetryRelayHandler({ logger: this.logger, softFailDelayMs });
    this.softFailQueue = [];
  }

  async #send(url, payload, headers = {}) {
    if (!url) {
      throw new RetryRelayError('Delivery url missing', { code: 'missing-url', retryable: false });
    }
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload ?? {}),
    });

    if (response.ok) {
      return { status: response.status };
    }

    const retryable = response.status >= 500 || response.status === 429;
    throw new RetryRelayError(`Delivery failed with status ${response.status}`, {
      code: `delivery-${response.status}`,
      retryable,
    });
  }

  async deliver({ url, payload, headers = {} }, { softFailDelayMs = this.softFailDelayMs } = {}) {
    const context = { url };
    const task = ({ attempt }) => this.#send(url, payload, headers, attempt);
    const fallback = async ({ scheduleRetry, error }) => {
      this.softFailQueue.push({
        url,
        error: error?.message || String(error),
        scheduledAt: Date.now(),
      });
      scheduleRetry(softFailDelayMs);
    };

    return this.retryHandler.run(task, { context, softFailFallback: fallback });
  }

  async deliverBatch(jobs = []) {
    return Promise.all(
      jobs.map((job) =>
        this.deliver(job).catch((error) => ({ status: 'failed', error }))
      )
    );
  }

  drainSoftFailQueue() {
    const queue = this.softFailQueue.slice();
    this.softFailQueue.length = 0;
    return queue;
  }
}

module.exports = DeliveryService;
