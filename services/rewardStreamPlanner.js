const { ethers } = require('ethers');

const MULTIPLIER_ABI = [
  'function streamMultiplier(address user, uint256 baseRateBps, uint256 beliefScoreBps, uint256 loyaltyScoreBps) external returns (uint256)',
];

class RewardStreamPlanner {
  constructor({ telemetry, config = {} } = {}) {
    this.telemetry = telemetry || null;
    this.config = config;
    this.fallbackMultiplier = typeof config.fallbackMultiplier === 'number' ? config.fallbackMultiplier : 1;
    this.multiplierAddress = this.#normalizeAddress(config.multiplierAddress);
    this.rewardStreamAddress = this.#normalizeAddress(config.rewardStreamAddress);
    this.provider = config.provider || null;
    this.signer = config.signer || null;
    this.contractsReady = false;
    this.multiplierContract = null;

    if (!this.provider && config.providerUrl && this.multiplierAddress && this.rewardStreamAddress) {
      try {
        this.provider = new ethers.JsonRpcProvider(config.providerUrl);
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.provider.unavailable',
          { providerUrl: config.providerUrl, error: error.message },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
      }
    }

    if (!this.signer && config.privateKey && this.provider) {
      try {
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.signer.invalid',
          { reason: error.message },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
      }
    }
  }

  #normalizeAddress(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed || /^0x0+$/i.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  async #ensureContracts() {
    if (this.contractsReady) {
      return true;
    }
    if (!this.provider || !this.multiplierAddress || !this.rewardStreamAddress) {
      return false;
    }
    if (!this.signer) {
      try {
        this.signer = await (typeof this.provider.getSigner === 'function'
          ? this.provider.getSigner()
          : null);
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.signer.unavailable',
          { reason: error.message },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
        return false;
      }
    }
    if (!this.signer) {
      return false;
    }

    this.multiplierContract = new ethers.Contract(this.multiplierAddress, MULTIPLIER_ABI, this.signer);
    this.contractsReady = true;
    return true;
  }

  #tierToBps(tier) {
    switch ((tier || '').toLowerCase()) {
      case 'flame':
        return 500;
      case 'ember':
        return 250;
      case 'spark':
        return 100;
      default:
        return 0;
    }
  }

  #prepareMetrics(currentYield = {}) {
    const apr = Number(currentYield.apr ?? 0);
    const multiplier = Number(currentYield.multiplier ?? 1);
    const beliefScore = Number(currentYield.beliefScore ?? 0.65);
    return {
      baseRateBps: Math.max(10000, Math.round(multiplier * 10000)),
      beliefScoreBps: Math.max(0, Math.min(10000, Math.round(beliefScore * 10000))),
      loyaltyScoreBps: this.#tierToBps(currentYield.tierLevel),
      aprBps: Math.max(0, Math.round(apr * 100)),
    };
  }

  #asFloatMultiplier(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return this.fallbackMultiplier;
    }
    return numeric / 10000;
  }

  async previewStream(walletId, { partnerId, currentYield } = {}) {
    const normalizedWallet = walletId || null;
    const metrics = this.#prepareMetrics(currentYield || {});
    const preview = {
      walletId: normalizedWallet,
      partnerId: partnerId || null,
      status: 'fallback',
      multiplier: {
        value: this.fallbackMultiplier,
        source: 'fallback',
      },
      roadmap: {
        phase: 'pilot',
        next: 'vaultfire-rewards-beta',
      },
      metrics,
    };

    const contractsReady = await this.#ensureContracts();
    if (!contractsReady) {
      this.telemetry?.record(
        'rewards.stream.fallback',
        { walletId: normalizedWallet, partnerId, reason: 'contracts_unavailable', metrics },
        { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
      );
      return preview;
    }

    try {
      const staticResult = await this.multiplierContract.streamMultiplier.staticCall(
        normalizedWallet,
        metrics.baseRateBps,
        metrics.beliefScoreBps,
        metrics.loyaltyScoreBps
      );
      const tx = await this.multiplierContract.streamMultiplier(
        normalizedWallet,
        metrics.baseRateBps,
        metrics.beliefScoreBps,
        metrics.loyaltyScoreBps
      );
      const receipt = await tx.wait();
      const multiplierValue = this.#asFloatMultiplier(staticResult);
      preview.status = 'streaming';
      preview.multiplier = {
        value: multiplierValue,
        source: 'on-chain',
        transactionHash: receipt.hash,
      };
      preview.contracts = {
        multiplier: this.multiplierAddress,
        stream: this.rewardStreamAddress,
      };

      this.telemetry?.record(
        'rewards.stream.dispatched',
        {
          walletId: normalizedWallet,
          partnerId,
          multiplier: multiplierValue,
          transactionHash: receipt.hash,
          metrics,
        },
        { tags: ['rewards', 'on-chain'], visibility: { partner: true, ethics: false, audit: true } }
      );

      return preview;
    } catch (error) {
      this.telemetry?.record(
        'rewards.stream.fallback',
        { walletId: normalizedWallet, partnerId, reason: error.message, metrics },
        { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
      );
      preview.multiplier = {
        value: this.fallbackMultiplier,
        source: 'fallback',
        reason: error.message,
      };
      return preview;
    }
  }
}

module.exports = RewardStreamPlanner;
