const { RetryRelayHandler, RetryRelayError } = require('./services/retryRelayHandler');

const globalFetch = typeof fetch === 'function' ? fetch : require('node-fetch');

class SignalRouter {
  constructor({
    endpoints = {},
    relayHandler = null,
    fetchImpl = globalFetch,
    logger = console,
    softFailDelayMs = 45_000,
  } = {}) {
    this.endpoints = { ...endpoints };
    this.logger = logger || console;
    this.fetch = typeof fetchImpl === 'function' ? fetchImpl : globalFetch;
    this.softFailDelayMs = softFailDelayMs;
    this.retryHandler =
      relayHandler && typeof relayHandler.run === 'function'
        ? relayHandler
        : new RetryRelayHandler({ logger: this.logger, softFailDelayMs });
    this.softFailLedger = new Map();
  }

  registerEndpoint(key, url) {
    if (typeof key !== 'string' || !key) {
      throw new Error('Endpoint key must be a non-empty string');
    }
    if (typeof url !== 'string' || !url) {
      throw new Error('Endpoint url must be a non-empty string');
    }
    this.endpoints[key] = url;
  }

  #resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'string' && this.endpoints[target]) {
      return this.endpoints[target];
    }
    if (typeof target === 'string' && target.startsWith('http')) {
      return target;
    }
    if (target?.url) {
      return target.url;
    }
    return null;
  }

  #recordSoftFail(key, payload) {
    const current = this.softFailLedger.get(key) || [];
    current.push({
      timestamp: Date.now(),
      payload,
    });
    this.softFailLedger.set(key, current.slice(-25));
  }

  async route(signal, { softFailDelayMs = this.softFailDelayMs } = {}) {
    const { id = null, target = null, payload = {} } = signal || {};
    const endpoint = this.#resolveTarget(target);
    const context = { id, target: endpoint };

    const task = async () => {
      if (!endpoint) {
        throw new RetryRelayError('Missing endpoint for signal', {
          code: 'missing-endpoint',
          retryable: false,
        });
      }

      const response = await this.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vaultfire-Signal': id || 'vaultfire-signal',
        },
        body: JSON.stringify(payload ?? {}),
      });

      if (response.ok) {
        this.logger.debug?.('[signal-router] delivered', { endpoint, id });
        return { endpoint, status: response.status };
      }

      const retryable = response.status >= 500 || response.status === 429;
      throw new RetryRelayError(`Remote status ${response.status}`, {
        code: `http-${response.status}`,
        retryable,
      });
    };

    const fallback = async ({ scheduleRetry, error }) => {
      this.#recordSoftFail(endpoint || 'unknown', { id, error: error?.message || String(error) });
      this.logger.warn('[signal-router] soft-fail scheduling background retry', {
        endpoint,
        id,
        error: error?.message || error,
      });
      if (endpoint) {
        scheduleRetry(softFailDelayMs);
      }
    };

    return this.retryHandler.run(task, { context, softFailFallback: fallback });
  }

  inspectSoftFails(endpointKey = null) {
    if (endpointKey) {
      return this.softFailLedger.get(endpointKey) || [];
    }
    return Array.from(this.softFailLedger.entries()).map(([key, entries]) => ({ key, entries }));
  }
}

module.exports = SignalRouter;
