const EventEmitter = require('events');

const INDICATORS = {
  simulated: { color: 'amber', label: 'SIMULATED' },
  live: { color: 'green', label: 'LIVE' },
};

class DeploymentModeController extends EventEmitter {
  constructor({ config = {}, telemetry } = {}) {
    super();
    this.telemetry = telemetry;
    const defaultMode = (config.mode || config.defaultMode || 'simulated').toLowerCase();
    const normalized = ['live', 'simulated'].includes(defaultMode) ? defaultMode : 'simulated';
    const timestamp = new Date().toISOString();
    this.state = {
      mode: normalized,
      indicator: INDICATORS[normalized] || INDICATORS.simulated,
      simulatedSince: normalized === 'simulated' ? timestamp : null,
      liveSince: normalized === 'live' ? timestamp : null,
      lastTransition: null,
      partnerReady: Boolean(config.partnerReady),
      advancedSemantics: Boolean(config.advancedSemantics),
      hybridCompliance: {
        enabled: Boolean(config?.hybridCompliance?.enabled),
        governanceApproved: Boolean(config?.hybridCompliance?.governanceApproved),
      },
    };
    this.partnerReady = Boolean(config.partnerReady);
  }

  getStatus() {
    return {
      ...this.state,
      indicator: { ...this.state.indicator },
    };
  }

  async setMode(mode, context = {}) {
    const normalized = mode === 'live' ? 'live' : 'simulated';
    if (this.state.mode === normalized) {
      return this.getStatus();
    }
    const timestamp = new Date().toISOString();
    this.state.mode = normalized;
    this.state.lastTransition = {
      by: context.actor || 'system',
      at: timestamp,
      reason: context.reason || null,
    };
    this.state.indicator = INDICATORS[normalized] || INDICATORS.simulated;
    if (normalized === 'live') {
      this.state.liveSince = timestamp;
      this.state.simulatedSince = null;
    } else {
      this.state.simulatedSince = timestamp;
      this.state.liveSince = null;
    }
    if (this.telemetry?.record) {
      this.telemetry.record(
        'deployment.mode.changed',
        {
          mode: normalized,
          actor: context.actor || 'system',
          partnerReady: this.partnerReady,
        },
        {
          tags: ['deployment'],
          visibility: { partner: true, ethics: true, audit: true },
        }
      );
    }
    this.emit('mode', this.getStatus());
    return this.getStatus();
  }

  async toggle(context = {}) {
    const next = this.state.mode === 'live' ? 'simulated' : 'live';
    return this.setMode(next, context);
  }

  applyPartnerReady(partnerReady) {
    this.partnerReady = Boolean(partnerReady);
    this.state.partnerReady = this.partnerReady;
    return this.getStatus();
  }

  enableAdvancedSemantics(context = {}) {
    this.state.advancedSemantics = true;
    this.state.lastTransition = {
      by: context.actor || 'system',
      at: new Date().toISOString(),
      reason: context.reason || 'advanced_semantics_enabled',
    };
    this.emit('semantics', this.getStatus());
    return this.getStatus();
  }

  updateHybridCompliance(overrides = {}, context = {}) {
    this.state.hybridCompliance = {
      ...this.state.hybridCompliance,
      ...overrides,
    };
    this.state.lastTransition = {
      by: context.actor || 'system',
      at: new Date().toISOString(),
      reason: context.reason || 'hybrid_compliance_updated',
    };
    this.emit('hybridCompliance', this.getStatus());
    return this.getStatus();
  }
}

module.exports = {
  DeploymentModeController,
  INDICATORS,
};
