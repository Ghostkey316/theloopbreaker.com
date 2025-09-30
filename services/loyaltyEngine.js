const { Contract } = require('ethers');

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const DEFAULT_TIERS = [
  { tier: 'ember', minScore: 0, multiplier: 1 },
  { tier: 'spark', minScore: 25, multiplier: 1.05 },
  { tier: 'flame', minScore: 50, multiplier: 1.12 },
  { tier: 'blaze', minScore: 75, multiplier: 1.25 },
  { tier: 'phoenix', minScore: 90, multiplier: 1.4 },
];

class LoyaltyEngine {
  constructor({
    provider = null,
    contractAddress = null,
    contractInterface = ['function getMultiplier(address user) view returns (uint256)'],
    telemetry = null,
    tiers = DEFAULT_TIERS,
    nowFn = () => Date.now(),
    contractFactory = null,
  } = {}) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    this.contractInterface = contractInterface;
    this.telemetry = telemetry || null;
    this.behaviorScores = new Map();
    this.anchors = new Map();
    this.now = typeof nowFn === 'function' ? nowFn : () => Date.now();
    this.tierTable = this.#buildTierTable(tiers);
    this.contract = null;
    this.contractFactory =
      typeof contractFactory === 'function'
        ? contractFactory
        : (address, iface, providerRef) => new Contract(address, iface, providerRef);
    // TODO: reward scaling review (governance calibration pending)
  }

  #buildTierTable(tiers) {
    const valid = Array.isArray(tiers) ? tiers : DEFAULT_TIERS;
    const cleaned = valid
      .map((entry) => ({
        tier: entry.tier || 'unranked',
        minScore: typeof entry.minScore === 'number' ? entry.minScore : 0,
        multiplier: typeof entry.multiplier === 'number' ? entry.multiplier : 1,
      }))
      .sort((a, b) => a.minScore - b.minScore);
    if (!cleaned.length) {
      return DEFAULT_TIERS.slice();
    }
    return cleaned;
  }

  #normalizeAddress(address) {
    if (!address || typeof address !== 'string') {
      return null;
    }
    return address.toLowerCase();
  }

  #record(event, payload) {
    if (this.telemetry && typeof this.telemetry.record === 'function') {
      this.telemetry.record(event, payload, {
        tags: ['loyalty', 'multiplier'],
        visibility: { partner: true, ethics: false, audit: true },
      });
    }
  }

  #resolveTier(score) {
    const value = Number.isFinite(score) ? score : 0;
    let low = 0;
    let high = this.tierTable.length - 1;
    let result = this.tierTable[0];
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = this.tierTable[mid];
      if (value >= candidate.minScore) {
        result = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }

  registerAnchor(telemetryId, address) {
    const normalizedAddress = this.#normalizeAddress(address);
    if (!telemetryId || !normalizedAddress) {
      return null;
    }
    this.anchors.set(String(telemetryId), normalizedAddress);
    return { telemetryId: String(telemetryId), address: normalizedAddress };
  }

  registerBehaviorScore(address, score, { telemetryId = null, metadata = null } = {}) {
    const normalizedAddress = this.#normalizeAddress(address);
    if (!normalizedAddress) {
      throw new Error('Address is required to register behavior metrics.');
    }
    const numericScore = Number.isFinite(score) ? Number(score) : 0;
    const entry = {
      score: numericScore,
      telemetryId: telemetryId ? String(telemetryId) : null,
      updatedAt: new Date(this.now()).toISOString(),
      metadata: metadata || null,
    };
    this.behaviorScores.set(normalizedAddress, entry);
    if (entry.telemetryId) {
      this.anchors.set(entry.telemetryId, normalizedAddress);
    }
    this.#record('loyalty.behavior.recorded', {
      address: normalizedAddress,
      telemetryId: entry.telemetryId,
      score: numericScore,
    });
    return entry;
  }

  #resolveAddress(key) {
    if (!key) {
      return null;
    }
    if (typeof key === 'string' && ADDRESS_REGEX.test(key)) {
      return key.toLowerCase();
    }
    const lookupKey = String(key);
    if (this.anchors.has(lookupKey)) {
      return this.anchors.get(lookupKey);
    }
    return null;
  }

  async #fetchOnChainMultiplier(address) {
    if (!address || !this.provider || !this.contractAddress) {
      return 1;
    }
    if (!this.contract) {
      this.contract = this.contractFactory(this.contractAddress, this.contractInterface, this.provider);
    }
    try {
      const raw = await this.contract.getMultiplier(address);
      if (typeof raw === 'bigint') {
        return Number(raw);
      }
      if (typeof raw === 'object' && raw !== null && typeof raw.toString === 'function') {
        return Number(raw.toString());
      }
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? numeric : 1;
    } catch (error) {
      this.#record('loyalty.multiplier.onchain_error', {
        address,
        error: error.message,
      });
      return 1;
    }
  }

  async calculateMultiplier(key) {
    const address = this.#resolveAddress(key);
    const behavior = address ? this.behaviorScores.get(address) : null;
    const telemetryId = behavior?.telemetryId || (typeof key === 'string' && !ADDRESS_REGEX.test(key) ? String(key) : null);
    const score = behavior?.score ?? 0;
    const tier = this.#resolveTier(score);
    const onChainMultiplier = await this.#fetchOnChainMultiplier(address);
    const combined = Number((tier.multiplier * onChainMultiplier).toFixed(4));
    const result = {
      address,
      multiplier: combined,
      tier: tier.tier,
      tierMultiplier: tier.multiplier,
      onChainMultiplier,
      telemetryId,
      score,
      updatedAt: behavior?.updatedAt || null,
    };
    this.#record('loyalty.multiplier.calculated', result);
    return result;
  }
}

module.exports = {
  LoyaltyEngine,
  DEFAULT_TIERS,
};
