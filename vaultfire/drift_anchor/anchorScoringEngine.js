'use strict';

const DEFAULT_CONFIG = {
  maxScore: 111,
  decayRules: {
    default: { halfLifeHours: 72 },
    github_commit: { halfLifeHours: 168 },
    dapp_use: { halfLifeHours: 96 },
    api_ping: { halfLifeHours: 48 },
    social_signal: { halfLifeHours: 120 },
  },
  resetInteractions: ['identity_reset', 'anchor_reset'],
  decayFloor: 0,
};

class AnchorScoringEngine {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      decayRules: {
        ...DEFAULT_CONFIG.decayRules,
        ...(config.decayRules || {}),
      },
      resetInteractions: config.resetInteractions || DEFAULT_CONFIG.resetInteractions,
    };
  }

  calculate({ driftTimeHours, beliefCoefficient, interactionType, previousAnchorScore = 0 }) {
    if (typeof driftTimeHours !== 'number' || driftTimeHours < 0) {
      throw new Error('driftTimeHours must be a non-negative number.');
    }

    if (typeof beliefCoefficient !== 'number') {
      throw new Error('beliefCoefficient must be a number.');
    }

    const resetApplied = this._shouldReset(interactionType);
    if (resetApplied) {
      return {
        anchorScore: 0,
        baseScore: 0,
        decayedScore: 0,
        resetApplied: true,
        driftTimeHours,
        previousAnchorScore,
        decayMultiplier: 0,
      };
    }

    const baseScore = driftTimeHours * beliefCoefficient;
    const decayMultiplier = this._decayMultiplier(driftTimeHours, interactionType);
    const decayedScore = baseScore * decayMultiplier;

    const adjusted = Math.max(this.config.decayFloor, decayedScore);
    const anchorScore = this._clampScore(adjusted);

    return {
      anchorScore,
      baseScore,
      decayedScore: adjusted,
      resetApplied: false,
      driftTimeHours,
      previousAnchorScore,
      decayMultiplier,
    };
  }

  _decayMultiplier(driftTimeHours, interactionType) {
    const halfLifeHours = this._resolveHalfLife(interactionType);
    if (!halfLifeHours || halfLifeHours <= 0) {
      return 1;
    }

    const exponent = driftTimeHours / halfLifeHours;
    return Number(Math.pow(0.5, exponent).toFixed(6));
  }

  _resolveHalfLife(interactionType) {
    if (interactionType && this.config.decayRules[interactionType]) {
      return this.config.decayRules[interactionType].halfLifeHours;
    }

    return this.config.decayRules.default?.halfLifeHours || null;
  }

  _shouldReset(interactionType) {
    if (!interactionType) {
      return false;
    }

    return this.config.resetInteractions.includes(interactionType);
  }

  _clampScore(score) {
    if (Number.isNaN(score)) {
      return 0;
    }

    return Math.max(0, Math.min(this.config.maxScore, Number(score.toFixed(3))));
  }
}

module.exports = { AnchorScoringEngine, DEFAULT_CONFIG };
