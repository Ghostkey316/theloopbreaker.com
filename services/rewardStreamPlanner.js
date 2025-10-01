const { ethers } = require('ethers');
const RewardContractInterface = require('../src/rewards/contractInterface');

const MULTIPLIER_ABI = [
  'function streamMultiplier(address user, uint256 baseRateBps, uint256 beliefScoreBps, uint256 loyaltyScoreBps) external returns (uint256)',
];

class RewardStreamPlanner {
  constructor({ telemetry, config = {}, contractInterface = null, nowFn = () => Date.now() } = {}) {
    this.telemetry = telemetry || null;
    this.config = config;
    this.fallbackMultiplier = typeof config.fallbackMultiplier === 'number' ? config.fallbackMultiplier : 1;
    this.multiplierAddress = this.#normalizeAddress(config.multiplierAddress);
    this.rewardStreamAddress = this.#normalizeAddress(config.rewardStreamAddress);
    this.provider = config.provider || null;
    this.signer = config.signer || null;
    this.contractsReady = false;
    this.multiplierContract = null;
    this.now = typeof nowFn === 'function' ? nowFn : () => Date.now();
    this.contractInterface = contractInterface || null;

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

    const useMock =
      config.stream?.useMock === true || !this.provider || !this.rewardStreamAddress || !this.multiplierAddress;
    if (!this.contractInterface && useMock) {
      this.contractInterface = new RewardContractInterface({
        provider: this.provider,
        contractAddress: this.rewardStreamAddress,
      });
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

  async #simulateStream(walletId, metrics) {
    const normalizedWallet = walletId || null;
    if (await this.#ensureContracts()) {
      try {
        const staticResult = await this.multiplierContract.streamMultiplier.staticCall(
          normalizedWallet,
          metrics.baseRateBps,
          metrics.beliefScoreBps,
          metrics.loyaltyScoreBps
        );
        const multiplierValue = this.#asFloatMultiplier(staticResult);
        return {
          status: 'on-chain',
          multiplier: multiplierValue,
          contracts: {
            multiplier: this.multiplierAddress,
            stream: this.rewardStreamAddress,
          },
        };
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.simulation_failed',
          { walletId: normalizedWallet, reason: error.message, metrics },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
      }
    }

    if (this.contractInterface) {
      const multiplierValue = metrics.baseRateBps / 10000;
      return {
        status: 'mocked',
        multiplier: multiplierValue,
        contracts: {
          stream: this.contractInterface.contractAddress || null,
        },
      };
    }

    return {
      status: 'fallback',
      multiplier: this.fallbackMultiplier,
      contracts: null,
    };
  }

  async #executeStream(walletId, metrics) {
    const normalizedWallet = walletId || null;
    if (await this.#ensureContracts()) {
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
        return {
          status: 'on-chain',
          multiplier: multiplierValue,
          transactionHash: receipt.hash,
          contracts: {
            multiplier: this.multiplierAddress,
            stream: this.rewardStreamAddress,
          },
        };
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.execution_failed',
          { walletId: normalizedWallet, reason: error.message, metrics },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
      }
    }

    if (this.contractInterface) {
      try {
        const multiplierValue = metrics.baseRateBps / 10000;
        const response = await this.contractInterface.sendMultiplierUpdate(normalizedWallet, multiplierValue);
        return {
          status: 'mocked',
          multiplier: multiplierValue,
          transactionHash: response?.hash || null,
          contracts: {
            stream: this.contractInterface.contractAddress || null,
          },
        };
      } catch (error) {
        this.telemetry?.record(
          'rewards.stream.execution_failed',
          { walletId: normalizedWallet, reason: error.message, metrics },
          { tags: ['rewards', 'fallback'], visibility: { partner: true, ethics: false, audit: true } }
        );
      }
    }

    return {
      status: 'fallback',
      multiplier: this.fallbackMultiplier,
      transactionHash: null,
      contracts: null,
    };
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

    const simulation = await this.#simulateStream(normalizedWallet, metrics);

    if (simulation.status === 'on-chain') {
      preview.status = 'streaming';
      preview.multiplier = {
        value: simulation.multiplier,
        source: 'on-chain',
      };
      preview.contracts = simulation.contracts;
    } else if (simulation.status === 'mocked') {
      preview.status = 'mocked';
      preview.multiplier = {
        value: simulation.multiplier,
        source: 'mock',
      };
      preview.contracts = simulation.contracts;
    } else {
      preview.status = 'fallback';
      preview.multiplier = {
        value: this.fallbackMultiplier,
        source: 'fallback',
      };
    }

    this.telemetry?.record(
      'rewards.stream.preview',
      {
        walletId: normalizedWallet,
        partnerId,
        status: preview.status,
        multiplier: preview.multiplier.value,
        metrics,
      },
      {
        tags: ['rewards', preview.status === 'fallback' ? 'fallback' : 'on-chain'],
        visibility: { partner: true, ethics: false, audit: true },
      }
    );

    return preview;
  }

  async applyContribution(walletId, { partnerId, currentYield = {}, telemetryId = null, metadata = {} } = {}) {
    const normalizedWallet = walletId || null;
    const metrics = this.#prepareMetrics(currentYield || {});
    const execution = await this.#executeStream(normalizedWallet, metrics);

    const payload = {
      walletId: normalizedWallet,
      partnerId: partnerId || null,
      telemetryId,
      multiplier: execution.multiplier,
      status: execution.status,
      transactionHash: execution.transactionHash || null,
      metrics,
      metadata,
      appliedAt: new Date(this.now()).toISOString(),
    };

    const telemetryEvent = execution.status === 'fallback' ? 'rewards.stream.fallback' : 'rewards.stream.applied';
    this.telemetry?.record(
      telemetryEvent,
      payload,
      {
        tags: ['rewards', execution.status === 'fallback' ? 'fallback' : 'on-chain'],
        visibility: { partner: true, ethics: false, audit: true },
      }
    );

    return { ...payload, contracts: execution.contracts };
  }
}

module.exports = RewardStreamPlanner;
