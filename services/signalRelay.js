const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

class SignalRelay {
  constructor({
    fetchImpl,
    queueFilePath = null,
    storage = null,
    fallbackWriter = null,
    telemetry = null,
    randomFn = Math.random,
    maxAttempts = 5,
    baseDelayMs = 60 * 1000,
    backoffFactor = 2,
    maxDelayMs = 6 * 60 * 60 * 1000,
    jitter = 0.25,
    nowFn = () => Date.now(),
    circuitBreaker = {},
  } = {}) {
    this.fetch =
      typeof fetchImpl === 'function'
        ? fetchImpl
        : typeof fetch === 'function'
        ? fetch
        : require('node-fetch');
    this.telemetry = telemetry || null;
    this.randomFn = typeof randomFn === 'function' ? randomFn : Math.random;
    this.maxAttempts = Math.max(1, maxAttempts || 1);
    this.baseDelayMs = Math.max(10, baseDelayMs || 10);
    this.backoffFactor = Math.max(1, backoffFactor || 1);
    this.maxDelayMs = Math.max(this.baseDelayMs, maxDelayMs || this.baseDelayMs);
    this.jitter = Math.max(0, jitter || 0);
    this.now = typeof nowFn === 'function' ? nowFn : () => Date.now();
    this.fallbackWriter = typeof fallbackWriter === 'function' ? fallbackWriter : null;
    this.queueFilePath = queueFilePath;
    this.memoryQueue = [];
    this.storage = storage || this.#createStorage(queueFilePath);
    this.circuitBreaker = {
      failureThreshold: Math.max(1, circuitBreaker.failureThreshold || 3),
      cooldownMs: Math.max(1000, circuitBreaker.cooldownMs || 60 * 1000),
    };
    this.circuitState = new Map();
  }

  #createStorage(queueFilePath) {
    if (!queueFilePath) {
      return {
        read: () => this.memoryQueue.slice(),
        write: (entries) => {
          this.memoryQueue = Array.isArray(entries) ? entries.slice() : [];
        },
      };
    }
    return {
      read: () => {
        if (!fs.existsSync(queueFilePath)) {
          return [];
        }
        try {
          const raw = fs.readFileSync(queueFilePath, 'utf8');
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      },
      write: (entries) => {
        ensureDir(path.dirname(queueFilePath));
        fs.writeFileSync(queueFilePath, JSON.stringify(entries, null, 2));
      },
    };
  }

  #computeDelay(attempts) {
    const exponent = Math.max(0, attempts - 1);
    const base = Math.min(this.maxDelayMs, this.baseDelayMs * this.backoffFactor ** exponent);
    const jitterValue = base * this.jitter * this.randomFn();
    return Math.min(this.maxDelayMs, base + jitterValue);
  }

  #loadQueue() {
    return this.storage.read();
  }

  #writeQueue(entries) {
    this.storage.write(entries);
  }

  #getCircuit(nodeId) {
    return (
      this.circuitState.get(nodeId) || {
        state: 'closed',
        failures: 0,
        openedAt: null,
      }
    );
  }

  #snapshotCircuit(nodeId) {
    const { state, failures, openedAt } = this.#getCircuit(nodeId);
    return {
      state,
      failures,
      openedAt,
    };
  }

  #allowAttempt(nodeId, nowTs) {
    const state = this.#getCircuit(nodeId);
    if (state.state === 'open') {
      if (state.openedAt && nowTs - state.openedAt >= this.circuitBreaker.cooldownMs) {
        state.state = 'half-open';
        this.circuitState.set(nodeId, state);
        return { allow: true, state: state.state };
      }
      const retryAt = (state.openedAt || nowTs) + this.circuitBreaker.cooldownMs;
      return { allow: false, state: state.state, retryAt };
    }
    return { allow: true, state: state.state };
  }

  #registerSuccess(nodeId) {
    this.circuitState.set(nodeId, {
      state: 'closed',
      failures: 0,
      openedAt: null,
    });
  }

  #registerFailure(nodeId, nowTs) {
    const state = this.#getCircuit(nodeId);
    if (state.state === 'half-open') {
      state.state = 'open';
      state.openedAt = nowTs;
      state.failures = this.circuitBreaker.failureThreshold;
    } else {
      state.failures = (state.failures || 0) + 1;
      if (state.failures >= this.circuitBreaker.failureThreshold) {
        state.state = 'open';
        state.openedAt = nowTs;
      }
    }
    this.circuitState.set(nodeId, state);
    return state;
  }

  #applyCircuitDelay(nodeId, targetTs, nowTs) {
    const state = this.#getCircuit(nodeId);
    if (state.state !== 'open') {
      return targetTs;
    }
    const reopenAt = (state.openedAt || nowTs) + this.circuitBreaker.cooldownMs;
    return Math.max(targetTs, reopenAt);
  }

  async #send(endpoint, payload) {
    if (!endpoint) {
      return { ok: false, status: 0, error: 'missing-endpoint' };
    }
    try {
      const response = await this.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vaultfire-Signal': 'belief-sync',
        },
        body: JSON.stringify(payload),
      });
      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, status: 0, error: error?.message || 'network-error' };
    }
  }

  #record(event, payload) {
    if (this.telemetry && typeof this.telemetry.record === 'function') {
      this.telemetry.record(event, payload, {
        tags: ['signal', 'relay'],
        visibility: { partner: true, ethics: true, audit: true },
      });
    }
  }

  async dispatch(node, payload, { telemetryId = null } = {}) {
    const nodeId = node?.id || node?.partnerId || 'unknown';
    const nowTs = this.now();
    const result = await this.#send(node?.endpoint, payload);
    if (result.ok) {
      this.#registerSuccess(nodeId);
      this.#record('signal.relay.delivered', {
        nodeId,
        endpoint: node?.endpoint || null,
        telemetryId,
        attempts: 0,
        dispatchedAt: new Date(nowTs).toISOString(),
      });
      return { status: 'delivered', attempts: 0 };
    }

    this.#registerFailure(nodeId, nowTs);

    const delay = this.#computeDelay(1);
    const nextAttemptTs = this.#applyCircuitDelay(nodeId, nowTs + delay, nowTs);

    const queue = this.#loadQueue();
    const job = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      nodeId,
      endpoint: node?.endpoint || null,
      payload,
      attempts: 0,
      telemetryId,
      nextAttemptAt: new Date(nextAttemptTs).toISOString(),
      createdAt: new Date(nowTs).toISOString(),
      lastError: result.error || `status:${result.status}`,
      circuitState: this.#snapshotCircuit(nodeId),
    };
    queue.push(job);
    this.#writeQueue(queue);

    if (this.fallbackWriter) {
      try {
        this.fallbackWriter(node || { id: nodeId }, payload, { status: 'queued' });
      } catch (error) {
        // Ignore fallback errors to keep relay flow resilient
      }
    }

    this.#record('signal.relay.scheduled', {
      nodeId,
      endpoint: node?.endpoint || null,
      telemetryId,
      attempts: 0,
      nextAttemptAt: job.nextAttemptAt,
      error: job.lastError,
      circuit: job.circuitState,
    });

    return { status: 'scheduled', attempts: 0, job };
  }

  async retry({ now = this.now(), maxAttempts = this.maxAttempts } = {}) {
    const nowTs = typeof now === 'number' ? now : new Date(now).getTime();
    const queue = this.#loadQueue();
    if (!queue.length) {
      return { attempted: 0, delivered: 0, remaining: 0 };
    }

    const keep = [];
    let attempted = 0;
    let delivered = 0;

    for (const job of queue) {
      const dueTs = new Date(job.nextAttemptAt).getTime();
      if (Number.isNaN(dueTs) || dueTs > nowTs) {
        keep.push(job);
        continue;
      }

      const nodeId = job.nodeId || 'unknown';
      const circuit = this.#allowAttempt(nodeId, nowTs);
      if (!circuit.allow) {
        const retryAt = circuit.retryAt || nowTs + this.circuitBreaker.cooldownMs;
        keep.push({
          ...job,
          nextAttemptAt: new Date(retryAt).toISOString(),
          circuitState: this.#snapshotCircuit(nodeId),
        });
        continue;
      }

      attempted += 1;
      const result = await this.#send(job.endpoint, job.payload);
      if (result.ok) {
        delivered += 1;
        this.#registerSuccess(nodeId);
        this.#record('signal.relay.delivered', {
          nodeId,
          endpoint: job.endpoint,
          telemetryId: job.telemetryId || null,
          attempts: job.attempts + 1,
          dispatchedAt: new Date(this.now()).toISOString(),
        });
        continue;
      }

      const attempts = (job.attempts || 0) + 1;
      const failureTime = this.now();
      this.#registerFailure(nodeId, failureTime);
      const errorCode = result.error || `status:${result.status}`;

      if (attempts >= maxAttempts) {
        if (this.fallbackWriter) {
          try {
            this.fallbackWriter(
              { id: nodeId, endpoint: job.endpoint },
              job.payload,
              { status: 'exhausted', error: errorCode }
            );
          } catch (error) {
            // ignore fallback failure
          }
        }
        this.#record('signal.relay.failed', {
          nodeId,
          endpoint: job.endpoint,
          telemetryId: job.telemetryId || null,
          attempts,
          error: errorCode,
        });
        continue;
      }

      const delay = this.#computeDelay(attempts + 1);
      const nextAttempt = this.#applyCircuitDelay(nodeId, failureTime + delay, failureTime);
      keep.push({
        ...job,
        attempts,
        nextAttemptAt: new Date(nextAttempt).toISOString(),
        lastError: errorCode,
        circuitState: this.#snapshotCircuit(nodeId),
      });
    }

    this.#writeQueue(keep);
    return { attempted, delivered, remaining: keep.length };
  }
}

function createSignalRelay(options) {
  return new SignalRelay(options);
}

module.exports = {
  SignalRelay,
  createSignalRelay,
};
