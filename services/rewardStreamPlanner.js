class RewardStreamPlanner {
  constructor({ telemetry } = {}) {
    this.telemetry = telemetry || null;
  }

  previewStream(walletId, { partnerId, currentYield } = {}) {
    const preview = {
      walletId,
      partnerId: partnerId || null,
      status: 'pending-integration',
      plannedContract: null,
      projectedYield: currentYield || null,
      roadmap: {
        phase: 'alpha',
        next: 'vaultfire-rewards-beta',
      },
    };

    this.telemetry?.record('rewards.stream.preview', preview, {
      tags: ['rewards', 'on-chain'],
      visibility: { partner: true, ethics: false, audit: true },
    });

    return preview;
    // TODO(rewards-onchain-migration): replace preview with live on-chain contract wiring once staking vault deployed.
  }
}

module.exports = RewardStreamPlanner;
