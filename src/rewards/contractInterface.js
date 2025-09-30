'use strict';

/**
 * Placeholder interface for interacting with the on-chain reward stream contract.
 * Swap these implementations with actual RPC calls when the RewardStream.sol contract
 * is deployed to a configured network.
 */
class RewardContractInterface {
  constructor({ provider, contractAddress }) {
    this.provider = provider || null;
    this.contractAddress = contractAddress || null;
    this._multipliers = new Map();
  }

  /**
   * Simulates sending an updated multiplier to the reward stream contract.
   * @param {string} address - Wallet address receiving the reward multiplier.
   * @param {number} multiplier - Multiplier factor (e.g., 1.0 = 100%).
   */
  async sendMultiplierUpdate(address, multiplier) {
    if (!address) throw new Error('address-required');
    if (typeof multiplier !== 'number' || Number.isNaN(multiplier)) {
      throw new Error('invalid-multiplier');
    }

    this._multipliers.set(address.toLowerCase(), multiplier);
    return {
      hash: `0x${Math.random().toString(16).slice(2, 10)}`,
      status: 'simulated',
      address,
      multiplier,
    };
  }

  /**
   * Retrieves the multiplier associated with the provided wallet address.
   * @param {string} address
   * @returns {Promise<number | null>}
   */
  async getUserMultiplier(address) {
    if (!address) throw new Error('address-required');
    const value = this._multipliers.get(address.toLowerCase());
    return value ?? null;
  }

  /**
   * Placeholder for future ERC-1155/721 streaming logic.
   * Extend this method once the contract exposes NFT-based yield accrual.
   */
  // eslint-disable-next-line class-methods-use-this
  async streamTokenizedRewards(/* params */) {
    throw new Error('reward-streaming-not-implemented');
  }
}

module.exports = RewardContractInterface;
