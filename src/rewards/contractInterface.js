'use strict';

const crypto = require('crypto');
const { ethers } = require('ethers');

const CONTRACT_ABI = [
  'function startStream(address recipient,uint256 totalAmount,uint64 startTime,uint64 endTime,string metadataURI,bytes32 userId) external returns (uint256)',
  'function claimable(uint256 tokenId) external view returns (uint256)',
  'function activeMultiplier(address account) external view returns (uint256 multiplierMicros,uint256 tokenId,bool active)',
  'function streamDetails(uint256 tokenId) external view returns (address,uint64,uint64,uint256,uint256,bytes32,string,uint256)',
];

const EVENT_INTERFACE = new ethers.Interface([
  ...CONTRACT_ABI,
  'event StreamStarted(uint256 indexed tokenId,address indexed recipient,bytes32 indexed userId,uint64 startTime,uint64 endTime,uint256 totalAmount,string metadataURI)',
]);

function digest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function formatTimestamp(seconds) {
  return new Date(Number(seconds) * 1000).toISOString();
}

class RewardContractInterface {
  constructor(options = {}) {
    this.provider = options.provider || null;
    this.providerUrl = options.providerUrl || process.env.VF_REWARD_RPC_URL || null;
    this.contractAddress = options.contractAddress || process.env.VF_REWARD_CONTRACT || null;
    this.privateKey = options.privateKey || process.env.VF_REWARD_PRIVATE_KEY || null;
    this.metadataBaseUri = (options.metadataBaseUri || 'ipfs://vaultfire').replace(/\/$/, '');
    const defaultDuration =
      Number(options.defaultDurationSeconds ?? options.stream?.defaultDurationSeconds ?? 7 * 24 * 60 * 60);
    this.defaultDurationSeconds = Number.isFinite(defaultDuration) && defaultDuration > 0 ? Math.round(defaultDuration) : 7 * 24 * 60 * 60;
    this.scalingFactor = BigInt(options.scalingFactor ?? 1_000_000);
    this.signer = options.signer || null;
    this.contract = null;
    this._multipliers = new Map();
    this._connectionError = null;
  }

  async triggerRewardStream({
    wallet,
    userId,
    multiplier = 1,
    totalAmount = null,
    durationSeconds = null,
    metadataURI = null,
    startTime = null,
    overrides = {},
    simulate = false,
  } = {}) {
    const normalizedWallet = this.#normalizeAddress(wallet);
    const numericMultiplier = this.#asNumber(multiplier);
    const amount =
      totalAmount !== null && totalAmount !== undefined
        ? this.#coerceAmount(totalAmount)
        : this.#multiplierToAmount(numericMultiplier);
    const streamDuration = this.#resolveDuration(durationSeconds);
    const plannedStart = this.#resolveStart(startTime);
    const plannedEnd = plannedStart + streamDuration;
    const resolvedUserId = userId || normalizedWallet;
    const userHash = this.#encodeUserId(resolvedUserId, normalizedWallet);
    const metadata = this.#resolveMetadata(metadataURI, resolvedUserId);

    const payload = {
      wallet: normalizedWallet,
      userId: resolvedUserId,
      multiplier: numericMultiplier,
      amount: amount.toString(),
      durationSeconds: streamDuration,
      startTime: plannedStart,
      endTime: plannedEnd,
      metadata,
      simulate,
    };

    this._multipliers.set(normalizedWallet, numericMultiplier);

    if (simulate || !(await this.#ensureContract())) {
      return {
        status: simulate ? 'simulated' : 'offline-fallback',
        tokenId: null,
        hash: null,
        contract: this.contractAddress,
        startTime: formatTimestamp(plannedStart),
        endTime: formatTimestamp(plannedEnd),
        digest: digest({ ...payload, status: simulate ? 'simulated' : 'offline-fallback' }),
      };
    }

    try {
      const tx = await this.contract.startStream(
        normalizedWallet,
        amount,
        plannedStart,
        plannedEnd,
        metadata,
        userHash,
        overrides
      );
      const receipt = await tx.wait();
      const eventDetails = this.#parseStreamStarted(receipt.logs);
      const record = {
        status: 'on-chain',
        tokenId: eventDetails?.tokenId ?? null,
        hash: receipt.hash,
        contract: this.contractAddress,
        wallet: normalizedWallet,
        userId: resolvedUserId,
        multiplier: numericMultiplier,
        multiplierMicros: amount.toString(),
        startTime: formatTimestamp(eventDetails?.startTime ?? plannedStart),
        endTime: formatTimestamp(eventDetails?.endTime ?? plannedEnd),
      };
      return { ...record, digest: digest(record) };
    } catch (error) {
      this._connectionError = error;
      const fallbackRecord = {
        status: 'fallback-error',
        wallet: normalizedWallet,
        userId: resolvedUserId,
        multiplier: numericMultiplier,
        reason: error.message,
        startTime: formatTimestamp(plannedStart),
        endTime: formatTimestamp(plannedEnd),
      };
      return { ...fallbackRecord, digest: digest(fallbackRecord) };
    }
  }

  async sendMultiplierUpdate(address, multiplier, options = {}) {
    return this.triggerRewardStream({ wallet: address, multiplier, ...options });
  }

  async getUserMultiplier(address) {
    const normalized = this.#normalizeAddress(address);
    if (await this.#ensureContract()) {
      try {
        const [micros] = await this.contract.activeMultiplier(normalized);
        if (micros > 0n) {
          const value = Number(micros) / Number(this.scalingFactor);
          return Number.isFinite(value) ? value : this._multipliers.get(normalized) ?? null;
        }
      } catch (error) {
        this._connectionError = error;
      }
    }
    return this._multipliers.get(normalized) ?? null;
  }

  async fetchStreamDetails(tokenId) {
    if (!(await this.#ensureContract())) {
      throw new Error('contract-unavailable');
    }
    const [recipient, start, end, total, claimed, userId, metadata, claimable] = await this.contract.streamDetails(tokenId);
    return {
      tokenId: BigInt(tokenId).toString(),
      recipient,
      startTime: Number(start),
      endTime: Number(end),
      totalAmount: BigInt(total).toString(),
      claimedAmount: BigInt(claimed).toString(),
      claimable: BigInt(claimable).toString(),
      userId,
      metadata,
    };
  }

  get lastConnectionError() {
    return this._connectionError;
  }

  async #ensureContract() {
    if (this.contract) {
      return true;
    }
    if (!this.contractAddress) {
      return false;
    }
    let normalizedAddress;
    try {
      normalizedAddress = this.#normalizeAddress(this.contractAddress);
    } catch (error) {
      this._connectionError = error;
      return false;
    }
    if (!this.provider && this.providerUrl) {
      try {
        this.provider = new ethers.JsonRpcProvider(this.providerUrl);
      } catch (error) {
        this._connectionError = error;
        return false;
      }
    }
    if (!this.provider) {
      return false;
    }
    if (!this.signer && this.privateKey) {
      try {
        this.signer = new ethers.Wallet(this.privateKey, this.provider);
      } catch (error) {
        this._connectionError = error;
        return false;
      }
    }
    const runner = this.signer || this.provider;
    this.contractAddress = normalizedAddress;
    this.contract = new ethers.Contract(this.contractAddress, CONTRACT_ABI, runner);
    return true;
  }

  #normalizeAddress(address) {
    if (!address) {
      throw new Error('address-required');
    }
    if (typeof address !== 'string') {
      throw new Error('invalid-address');
    }
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      throw new Error('invalid-address');
    }
    return ethers.getAddress(trimmed);
  }

  #asNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error('invalid-multiplier');
    }
    return numeric;
  }

  #coerceAmount(value) {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error('invalid-amount');
      }
      return BigInt(Math.round(value));
    }
    if (typeof value === 'string') {
      if (/^0x[0-9a-fA-F]+$/.test(value)) {
        return BigInt(value);
      }
      if (!/^[0-9]+(\.[0-9]+)?$/.test(value)) {
        throw new Error('invalid-amount');
      }
      return BigInt(Math.round(Number(value)));
    }
    throw new Error('invalid-amount');
  }

  #multiplierToAmount(multiplier) {
    return BigInt(Math.round(multiplier * Number(this.scalingFactor)));
  }

  #resolveDuration(durationSeconds) {
    const duration = durationSeconds ? Number(durationSeconds) : this.defaultDurationSeconds;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('invalid-duration');
    }
    return Math.round(duration);
  }

  #resolveStart(startTime) {
    if (startTime === null || startTime === undefined) {
      return Math.floor(Date.now() / 1000);
    }
    const numeric = Number(startTime);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error('invalid-start');
    }
    return Math.round(numeric);
  }

  #encodeUserId(userId, wallet) {
    if (typeof userId === 'string' && userId.length > 0 && userId.length <= 31) {
      try {
        return ethers.encodeBytes32String(userId);
      } catch (error) {
        return ethers.id(userId);
      }
    }
    if (typeof userId === 'string' && userId.length > 0) {
      return ethers.id(userId);
    }
    return ethers.id(wallet);
  }

  #resolveMetadata(metadataURI, userId) {
    if (metadataURI && typeof metadataURI === 'string') {
      return metadataURI;
    }
    return `${this.metadataBaseUri}/${userId}`;
  }

  #parseStreamStarted(logs) {
    for (const log of logs) {
      try {
        const parsed = EVENT_INTERFACE.parseLog(log);
        if (parsed && parsed.name === 'StreamStarted') {
          return {
            tokenId: parsed.args.tokenId.toString(),
            startTime: Number(parsed.args.startTime),
            endTime: Number(parsed.args.endTime),
          };
        }
      } catch (error) {
        continue; // eslint-disable-line no-continue
      }
    }
    return null;
  }
}

module.exports = RewardContractInterface;
