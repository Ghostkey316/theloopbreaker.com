const crypto = require('crypto');
const fetch = require('node-fetch');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class WebhookDeliveryQueue {
  constructor({
    fetchImpl = fetch,
    maxRetries = 3,
    baseDelayMs = 250,
    maxDelayMs = 10000,
    jitter = 0.25,
  } = {}) {
    this.fetch = fetchImpl;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.jitter = jitter;
    this.queue = [];
    this.processingPromise = null;
    this.pending = new Set();
  }

  #computeDelay(attempt) {
    const base = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.max(0, attempt - 1));
    const jitterAmount = base * this.jitter * Math.random();
    return Math.min(this.maxDelayMs, base + jitterAmount);
  }

  #ensureProcessing() {
    if (!this.processingPromise) {
      this.processingPromise = this.#processQueue().finally(() => {
        this.processingPromise = null;
      });
    }
    return this.processingPromise;
  }

  #buildRequest(job) {
    const envelope = {
      event: job.event,
      payload: job.payload,
      partnerId: job.partnerId,
    };
    const body = JSON.stringify(envelope);
    const headers = {
      'Content-Type': 'application/json',
      'X-Vaultfire-Event': job.event,
      'X-Vaultfire-Delivery': job.id,
    };
    if (job.partnerId) {
      headers['X-Vaultfire-Partner'] = job.partnerId;
    }

    if (job.signingSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const digest = crypto
        .createHmac('sha256', job.signingSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      headers['X-Vaultfire-Signature'] = `t=${timestamp},v1=${digest}`;
      headers['X-Vaultfire-Timestamp'] = String(timestamp);
    }

    if (job.metadata?.headers) {
      Object.assign(headers, job.metadata.headers);
    }

    return { body, headers };
  }

  async #attempt(job) {
    job.attempt += 1;

    if (!job.targetUrl) {
      return { completed: true, status: 'skipped', error: null };
    }

    try {
      const { body, headers } = this.#buildRequest(job);
      const response = await this.fetch(job.targetUrl, {
        method: 'POST',
        headers,
        body,
      });
      if (response.ok) {
        return { completed: true, status: 'delivered', error: null };
      }
      const statusCode = response.status || 0;
      const retryable = statusCode >= 500;
      const error = `status:${statusCode}`;
      if (retryable) {
        return { completed: false, status: `error:${statusCode}`, error };
      }
      return { completed: true, status: `error:${statusCode}`, error };
    } catch (error) {
      const message = error?.message || 'network-error';
      return { completed: false, status: `failed:${message}`, error: message };
    }
  }

  enqueue(task) {
    const job = {
      id: task.deliveryId || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')),
      event: task.event,
      partnerId: task.partnerId,
      targetUrl: task.targetUrl,
      payload: task.payload,
      signingSecret: task.signingSecret,
      metadata: task.metadata || {},
      attempt: 0,
      nextAttempt: Date.now(),
      lastError: null,
    };

    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    job.resolve = (result) => {
      resolve(result);
      this.pending.delete(promise);
    };
    this.pending.add(promise);

    this.queue.push(job);
    this.#ensureProcessing();
    return promise;
  }

  async #processQueue() {
    while (this.queue.length) {
      const job = this.queue.shift();
      const now = Date.now();
      if (job.nextAttempt > now) {
        this.queue.unshift(job);
        await sleep(job.nextAttempt - now);
        continue;
      }

      const outcome = await this.#attempt(job);
      if (!outcome.completed && job.attempt < this.maxRetries) {
        job.lastError = outcome.error;
        job.nextAttempt = Date.now() + this.#computeDelay(job.attempt);
        this.queue.push(job);
        continue;
      }

      const status = outcome.completed
        ? outcome.status
        : `failed:${outcome.error || 'exhausted'}`;

      job.resolve({
        partnerId: job.partnerId,
        event: job.event,
        targetUrl: job.targetUrl,
        payload: job.payload,
        status,
        attempts: job.attempt,
        deliveryId: job.id,
        lastError: outcome.error,
        completedAt: new Date().toISOString(),
      });
    }
  }

  async flush() {
    if (this.processingPromise) {
      await this.processingPromise;
    }
    if (this.pending.size) {
      await Promise.allSettled(Array.from(this.pending));
    }
  }
}

module.exports = WebhookDeliveryQueue;
