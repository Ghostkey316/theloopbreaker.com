/**
 * Vaultfire Agent — Wallet Management
 *
 * Creates and manages the agent's Base mainnet wallet.
 * The private key is sourced exclusively from environment variables.
 */

import { ethers } from 'ethers';
import { AgentConfig } from './config';
import { Logger } from './logger';

const log = new Logger('Wallet');

export interface AgentWallet {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  address: string;
}

/**
 * Initialize the agent wallet from the loaded configuration.
 * Validates connectivity and logs the wallet address and balance.
 */
export async function initializeWallet(config: AgentConfig): Promise<AgentWallet> {
  log.info('Initializing wallet connection', { rpcUrl: config.rpcUrl, chainId: config.chainId });

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId, {
    staticNetwork: true,
  });

  const signer = new ethers.Wallet(config.privateKey, provider);
  const address = await signer.getAddress();

  log.info('Wallet initialized', { address });

  // Verify connectivity
  try {
    const balance = await provider.getBalance(address);
    const ethBalance = ethers.formatEther(balance);
    log.info('Wallet balance retrieved', { address, balanceETH: ethBalance });

    if (balance === 0n) {
      log.warn('Wallet has zero balance — transactions will fail unless funded');
    }
  } catch (err) {
    log.warn('Could not fetch wallet balance — RPC may be rate-limited', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { provider, signer, address };
}

/**
 * Get the current ETH balance of the agent wallet.
 */
export async function getBalance(wallet: AgentWallet): Promise<bigint> {
  return wallet.provider.getBalance(wallet.address);
}

/**
 * Estimate gas cost for a transaction and check if the wallet can afford it.
 */
export async function canAffordGas(
  wallet: AgentWallet,
  estimatedGas: bigint,
): Promise<{ affordable: boolean; balance: bigint; cost: bigint }> {
  const feeData = await wallet.provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  const cost = estimatedGas * gasPrice;
  const balance = await getBalance(wallet);
  return {
    affordable: balance >= cost,
    balance,
    cost,
  };
}
