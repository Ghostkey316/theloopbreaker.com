const { evaluateScalingPlan, DEFAULT_THRESHOLDS } = require('../services/scalingPlaybook');

describe('Scaling playbook', () => {
  it('marks environment as stable when metrics within thresholds', () => {
    const plan = evaluateScalingPlan({
      throughput: 750,
      maxThroughput: 1000,
      errorRate: 0.01,
      queueDepth: 5,
      latencyP95: 420,
      securityAlerts: 0,
      signedCallbacks: true,
      failoverReady: true,
    });
    expect(plan.status).toBe('stable');
    expect(plan.lanes.delivery.status).toBe('green');
    expect(plan.recommendations).toHaveLength(0);
  });

  it('surfaces delivery resilience and scaling warnings', () => {
    const plan = evaluateScalingPlan({
      throughput: 900,
      maxThroughput: 1000,
      errorRate: DEFAULT_THRESHOLDS.maxErrorRate * 0.8,
      queueDepth: DEFAULT_THRESHOLDS.maxQueueDepth + 10,
      latencyP95: DEFAULT_THRESHOLDS.maxLatencyMs + 20,
      backlogMinutes: 8,
      securityAlerts: 1,
      signedCallbacks: false,
      failoverReady: false,
    });

    expect(plan.status).toBe('at-risk');
    expect(plan.lanes.delivery.status).toBe('red');
    expect(plan.lanes.scaling.status).toBe('red');
    expect(plan.lanes.security.status).toBe('red');
    const labels = plan.recommendations.map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(['Delivery resilience', 'Scaling pathways', 'Security controls']));
  });

  it('allows threshold overrides per deployment', () => {
    const plan = evaluateScalingPlan(
      {
        throughput: 400,
        maxThroughput: 1000,
        errorRate: 0.015,
        queueDepth: 30,
        signedCallbacks: true,
        failoverReady: false,
      },
      { thresholds: { maxQueueDepth: 40 } }
    );

    expect(plan.status).toBe('watch');
    expect(plan.lanes.delivery.status).toBe('amber');
    expect(plan.recommendations.length).toBeGreaterThan(0);
  });
});
