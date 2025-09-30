class GovernanceEnforcer {
  constructor({ telemetry, thresholds } = {}) {
    this.telemetry = telemetry || null;
    this.thresholds = {
      multiplierCritical: thresholds?.multiplierCritical ?? 1,
      summaryWarning: thresholds?.summaryWarning ?? 1.05,
    };
  }

  assess({ multiplier, summaryScore }) {
    const alerts = [];
    if (multiplier < this.thresholds.multiplierCritical) {
      alerts.push({ type: 'multiplier.floor', multiplier, summaryScore });
      this.telemetry?.record('handshake.governance.blocked', { multiplier, summaryScore }, {
        tags: ['handshake', 'governance'],
        visibility: { partner: false, ethics: true, audit: true },
      });
    }
    if (summaryScore < this.thresholds.summaryWarning) {
      alerts.push({ type: 'summary.threshold', multiplier, summaryScore });
      this.telemetry?.record('handshake.governance.warned', { multiplier, summaryScore }, {
        tags: ['handshake', 'governance'],
        visibility: { partner: true, ethics: true, audit: true },
      });
    }
    const status = alerts.some((alert) => alert.type === 'multiplier.floor')
      ? 'blocked'
      : alerts.length
      ? 'warning'
      : 'ok';
    return { status, alerts };
    // TODO(governance-dao-thresholds): wire DAO-configured dynamic thresholds once partner councils expose signed snapshots.
  }
}

module.exports = GovernanceEnforcer;
