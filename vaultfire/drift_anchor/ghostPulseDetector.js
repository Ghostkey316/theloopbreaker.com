'use strict';

const DEFAULT_THRESHOLD_DAYS = 7;
const DEFAULT_LEGACY_THRESHOLD = 222;
const DEFAULT_LEGACY_BONUS = 11;

class GhostPulseDetector {
  constructor({
    thresholdDays = DEFAULT_THRESHOLD_DAYS,
    legacyThreshold = DEFAULT_LEGACY_THRESHOLD,
    legacyBonusValue = DEFAULT_LEGACY_BONUS,
  } = {}) {
    this.thresholdDays = thresholdDays;
    this.legacyThreshold = legacyThreshold;
    this.legacyBonusValue = legacyBonusValue;
    this._events = [];
  }

  evaluate({ userId, wallet, driftTimeHours, previousBeliefScore = 0 }) {
    if (typeof driftTimeHours !== 'number' || driftTimeHours < 0) {
      throw new Error('driftTimeHours must be a non-negative number.');
    }

    const thresholdHours = this.thresholdDays * 24;
    const ghostPulse = driftTimeHours >= thresholdHours;
    const legacyBonus = ghostPulse && previousBeliefScore > this.legacyThreshold ? this.legacyBonusValue : 0;
    const legacyBuilder = ghostPulse && legacyBonus > 0;

    const event = {
      userId: userId || null,
      wallet: wallet || null,
      driftTimeHours,
      previousBeliefScore,
      ghostPulse,
      legacyBonus,
      legacyBuilder,
      evaluatedAt: new Date().toISOString(),
    };

    this._events.push(event);

    return { ghostPulse, legacyBonus, legacyBuilder };
  }

  events() {
    return this._events.slice();
  }
}

module.exports = { GhostPulseDetector };
