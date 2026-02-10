'use strict';

const { ethers } = require('ethers');

function buildProvidersFromEnv() {
  // Supported chains: mainnet (1), base (8453), sepolia (11155111), base sepolia (84532)
  const urls = {
    1: process.env.VAULTFIRE_RPC_MAINNET || process.env.MAINNET_RPC_URL || null,
    8453: process.env.VAULTFIRE_RPC_BASE || process.env.BASE_RPC_URL || null,
    11155111: process.env.VAULTFIRE_RPC_SEPOLIA || process.env.SEPOLIA_RPC_URL || null,
    84532: process.env.VAULTFIRE_RPC_BASE_SEPOLIA || process.env.BASE_SEPOLIA_RPC_URL || null,
  };

  const providersByChainId = {};
  for (const [chainIdStr, url] of Object.entries(urls)) {
    const chainId = Number(chainIdStr);
    if (!url) continue;
    providersByChainId[chainId] = new ethers.JsonRpcProvider(url, chainId);
  }

  return providersByChainId;
}

module.exports = {
  buildProvidersFromEnv,
};
