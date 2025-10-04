'use strict';

class RewardRpcPlaceholder {
  constructor(options = {}) {
    this.rpcIntegrationEnabled = Boolean(options.rpcIntegrationEnabled);
    this.contractAddress = options.contractAddress || null;
    this.betaCompatible = true;
  }

  async sendMultiplierUpdate(address, multiplier) {
    return {
      status: this.rpcIntegrationEnabled ? 'rpc-enabled' : 'rpc-disabled',
      wallet: address || null,
      multiplier,
      betaCompatible: this.betaCompatible,
      rpcIntegrationEnabled: this.rpcIntegrationEnabled,
      hash: null,
    };
  }
}

module.exports = RewardRpcPlaceholder;
