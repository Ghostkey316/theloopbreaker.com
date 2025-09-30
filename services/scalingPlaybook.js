const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const DEFAULT_THRESHOLDS = {
  maxErrorRate: 0.02,
  maxQueueDepth: 25,
  minThroughputRatio: 0.6,
  stretchThroughputRatio: 0.85,
  maxLatencyMs: 750,
  maxSecurityAlerts: 0,
};

function normaliseMetrics(metrics = {}) {
  const result = { ...metrics };
  result.throughput = Number(metrics.throughput || 0);
  result.maxThroughput = Number(metrics.maxThroughput || 1);
  result.errorRate = clamp(Number(metrics.errorRate || 0), 0, 1);
  result.queueDepth = Number(metrics.queueDepth || 0);
  result.latencyP95 = Number(metrics.latencyP95 || 0);
  result.securityAlerts = Number(metrics.securityAlerts || 0);
  result.signedCallbacks = Boolean(metrics.signedCallbacks);
  result.failoverReady = Boolean(metrics.failoverReady);
  result.backlogMinutes = Number(metrics.backlogMinutes || 0);
  return result;
}

function evaluateDelivery(metrics, thresholds) {
  const resilience = {
    status: 'green',
    notes: [],
  };
  if (metrics.errorRate > thresholds.maxErrorRate) {
    resilience.status = 'red';
    resilience.notes.push('Error rate above acceptable threshold.');
  } else if (metrics.errorRate > thresholds.maxErrorRate * 0.6) {
    resilience.status = 'amber';
    resilience.notes.push('Monitor error rate to prevent alerting.');
  }

  if (metrics.queueDepth > thresholds.maxQueueDepth) {
    resilience.status = 'red';
    resilience.notes.push('Webhook queue depth needs drain capacity.');
  } else if (metrics.queueDepth > thresholds.maxQueueDepth * 0.6) {
    resilience.status = resilience.status === 'green' ? 'amber' : resilience.status;
    resilience.notes.push('Queue depth trending high.');
  }

  if (!metrics.failoverReady) {
    if (resilience.status !== 'red') {
      resilience.status = 'amber';
    }
    resilience.notes.push('Enable failover workers for delivery queue.');
  }

  return resilience;
}

function evaluateScaling(metrics, thresholds) {
  const ratio = metrics.maxThroughput ? metrics.throughput / metrics.maxThroughput : 0;
  const scaling = {
    status: 'green',
    notes: [],
    utilisation: clamp(ratio, 0, 1),
  };

  if (ratio < thresholds.minThroughputRatio) {
    scaling.notes.push('Capacity unused: consider dialling down autoscaling floor.');
  } else if (ratio > thresholds.stretchThroughputRatio) {
    scaling.status = 'amber';
    scaling.notes.push('Approaching scaling limits – prepare burst capacity.');
  }

  if (metrics.backlogMinutes > 5) {
    scaling.status = 'amber';
    scaling.notes.push('Backlog exceeding 5 minutes. Increase worker slots.');
  }

  if (metrics.latencyP95 > thresholds.maxLatencyMs) {
    scaling.status = 'red';
    scaling.notes.push('Latency above commitment window. Optimise pipelines.');
  }

  return scaling;
}

function evaluateSecurity(metrics, thresholds) {
  const security = {
    status: 'green',
    notes: [],
  };

  if (!metrics.signedCallbacks) {
    security.status = 'amber';
    security.notes.push('Enable signed callbacks for partner endpoints.');
  }

  if (metrics.securityAlerts > thresholds.maxSecurityAlerts) {
    security.status = 'red';
    security.notes.push('Resolve outstanding security alerts before scaling.');
  }

  return security;
}

function aggregateStatus(lanes) {
  if (lanes.some((lane) => lane.status === 'red')) {
    return 'at-risk';
  }
  if (lanes.some((lane) => lane.status === 'amber')) {
    return 'watch';
  }
  return 'stable';
}

function evaluateScalingPlan(metrics = {}, overrides = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...overrides.thresholds };
  const normalised = normaliseMetrics(metrics);

  const delivery = evaluateDelivery(normalised, thresholds);
  const scaling = evaluateScaling(normalised, thresholds);
  const security = evaluateSecurity(normalised, thresholds);

  const status = aggregateStatus([delivery, scaling, security]);

  const recommendations = [];
  [
    ['Delivery resilience', delivery.notes],
    ['Scaling pathways', scaling.notes],
    ['Security controls', security.notes],
  ].forEach(([label, notes]) => {
    notes.forEach((note) => recommendations.push({ label, note }));
  });

  return {
    status,
    metrics: normalised,
    lanes: {
      delivery,
      scaling,
      security,
    },
    recommendations,
  };
}

module.exports = {
  evaluateScalingPlan,
  DEFAULT_THRESHOLDS,
};
