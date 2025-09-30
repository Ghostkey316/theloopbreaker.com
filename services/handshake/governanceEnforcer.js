class GovernanceEnforcer {
  constructor({ telemetry, thresholds, audit, auditLogger } = {}) {
    this.telemetry = telemetry || null;
    this.thresholds = {
      multiplierCritical: thresholds?.multiplierCritical ?? 1,
      summaryWarning: thresholds?.summaryWarning ?? 1.05,
    };
    this.audit = {
      passed: audit?.passed ?? false,
    };
    this.auditLogger = auditLogger || null;
  }

  #telemetryConfig() {
    return { auditPassed: Boolean(this.audit.passed) };
  }

  assess({ multiplier, summaryScore }) {
    const alerts = [];
    if (multiplier < this.thresholds.multiplierCritical) {
      alerts.push({ type: 'multiplier.floor', multiplier, summaryScore });
      this.telemetry?.record('handshake.governance.blocked', { multiplier, summaryScore }, {
        tags: ['handshake', 'governance'],
        visibility: { partner: false, ethics: true, audit: true },
        config: this.#telemetryConfig(),
      });
    }
    if (summaryScore < this.thresholds.summaryWarning) {
      alerts.push({ type: 'summary.threshold', multiplier, summaryScore });
      this.telemetry?.record('handshake.governance.warned', { multiplier, summaryScore }, {
        tags: ['handshake', 'governance'],
        visibility: { partner: true, ethics: true, audit: true },
        config: this.#telemetryConfig(),
      });
    }
    const status = alerts.some((alert) => alert.type === 'multiplier.floor')
      ? 'blocked'
      : alerts.length
      ? 'warning'
      : 'ok';
    if (alerts.length && this.auditLogger) {
      this.auditLogger.logDecision({
        decisionType: 'governance.enforcer.alert',
        actorWallet: null,
        policyChange: status,
        notes: JSON.stringify({ alerts, thresholds: this.thresholds }),
      });
    }
    return { status, alerts };
    // TODO(governance-dao-thresholds): wire DAO-configured dynamic thresholds once partner councils expose signed snapshots.
  }
}

module.exports = GovernanceEnforcer;
