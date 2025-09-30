'use strict';

const client = require('prom-client');

class OpsMetrics {
  constructor({ registerDefaultMetrics = true } = {}) {
    this.registry = new client.Registry();
    if (registerDefaultMetrics) {
      client.collectDefaultMetrics({ register: this.registry });
    }

    this.queueDepthGauge = new client.Gauge({
      name: 'vaultfire_webhook_delivery_queue_depth',
      help: 'Number of webhook deliveries queued or in-flight.',
      registers: [this.registry],
      labelNames: ['state'],
    });

    this.queueRetryCounter = new client.Counter({
      name: 'vaultfire_webhook_delivery_retries_total',
      help: 'Count of webhook delivery retry attempts.',
      registers: [this.registry],
      labelNames: ['reason'],
    });

    this.queueOutcomeCounter = new client.Counter({
      name: 'vaultfire_webhook_delivery_outcomes_total',
      help: 'Count of webhook delivery outcomes grouped by status.',
      registers: [this.registry],
      labelNames: ['status'],
    });

    this.postureChangeCounter = new client.Counter({
      name: 'vaultfire_security_posture_changes_total',
      help: 'Number of security posture change events observed.',
      registers: [this.registry],
      labelNames: ['status'],
    });
  }

  updateQueueDepth({ queued, inFlight }) {
    const pending = Number.isFinite(queued) ? queued : 0;
    const active = Number.isFinite(inFlight) ? inFlight : 0;
    this.queueDepthGauge.set({ state: 'queued' }, pending);
    this.queueDepthGauge.set({ state: 'in_flight' }, active);
  }

  incrementRetry(reason = 'retryable') {
    this.queueRetryCounter.inc({ reason });
  }

  recordOutcome(status = 'unknown') {
    this.queueOutcomeCounter.inc({ status });
  }

  recordPostureChange(status = 'unknown') {
    this.postureChangeCounter.inc({ status });
  }

  async metricsSnapshot() {
    return this.registry.metrics();
  }

  contentType() {
    return this.registry.contentType;
  }
}

function createOpsMetrics(options = {}) {
  return new OpsMetrics(options);
}

module.exports = {
  OpsMetrics,
  createOpsMetrics,
};

