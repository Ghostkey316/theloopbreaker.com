class ReputationYieldBridge {
  constructor({ thresholds, baseApr = 6.4, telemetry } = {}) {
    this.telemetry = telemetry;
    this.baseApr = baseApr;
    this.thresholds = {
      beliefScore: 0.75,
      contributionCount: 5,
      yieldBonus: 0.02,
      ...thresholds,
    };
  }

  evaluate({ beliefScore = 0, contributionCount = 0, currentApr = this.baseApr, walletId } = {}) {
    const unlocked = beliefScore >= this.thresholds.beliefScore && contributionCount >= this.thresholds.contributionCount;
    const bonusApr = unlocked ? this.thresholds.yieldBonus * 100 : 0;
    const totalApr = unlocked ? currentApr + bonusApr : currentApr;
    if (this.telemetry?.record) {
      this.telemetry.record(
        'reputation.yield.bridge',
        {
          walletId,
          beliefScore,
          contributionCount,
          unlocked,
          totalApr,
        },
        {
          tags: ['rewards', 'reputation'],
          visibility: { partner: true, ethics: false, audit: true },
        }
      );
    }
    return {
      unlocked,
      bonusApr,
      totalApr,
      rationale: unlocked
        ? 'Belief score and contribution cadence unlock hybrid yield bonus.'
        : 'Threshold not met; rewards remain symbolic.',
    };
  }
}

module.exports = ReputationYieldBridge;
