/**
 * Vaultfire Agent — Identity Registry
 *
 * Handles self-registration and identity management in the
 * ERC8004IdentityRegistry on Base mainnet.
 */

import { ethers } from 'ethers';
import { AgentConfig, CONTRACTS } from './config';
import { ERC8004IdentityRegistryABI } from './abi';
import { AgentWallet } from './wallet';
import { Logger } from './logger';
import { withRetry } from './retry';

const log = new Logger('Registry');

export interface RegistrationStatus {
  isRegistered: boolean;
  isActive: boolean;
  agentURI: string;
  agentType: string;
  registeredAt: number;
}

/**
 * Build the capabilities hash from a list of capability strings.
 * This is the keccak256 of the ABI-encoded capabilities array.
 */
export function buildCapabilitiesHash(capabilities: string[]): string {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['string[]'],
    [capabilities],
  );
  return ethers.keccak256(encoded);
}

/**
 * Get the ERC8004IdentityRegistry contract instance.
 */
function getRegistryContract(wallet: AgentWallet): ethers.Contract {
  return new ethers.Contract(
    CONTRACTS.ERC8004IdentityRegistry,
    ERC8004IdentityRegistryABI,
    wallet.signer,
  );
}

/**
 * Check the current registration status of the agent.
 */
export async function checkRegistration(wallet: AgentWallet): Promise<RegistrationStatus> {
  const registry = getRegistryContract(wallet);

  try {
    const [agentURI, active, agentType, registeredAt] = await registry.getAgent(wallet.address);
    return {
      isRegistered: registeredAt > 0,
      isActive: active,
      agentURI,
      agentType,
      registeredAt: Number(registeredAt),
    };
  } catch (err) {
    // If the agent has never been registered, the call may revert or return defaults
    log.debug('Agent not found in registry (may not be registered yet)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      isRegistered: false,
      isActive: false,
      agentURI: '',
      agentType: '',
      registeredAt: 0,
    };
  }
}

/**
 * Register the agent in the ERC8004IdentityRegistry.
 * If already registered, updates the URI instead.
 */
export async function registerAgent(
  wallet: AgentWallet,
  config: AgentConfig,
): Promise<{ txHash: string | null; action: 'registered' | 'updated' | 'already-active' | 'dry-run' }> {
  const status = await checkRegistration(wallet);

  const capabilities = [
    'protocol-monitoring',
    'health-checks',
    'metrics-reporting',
    'bond-management',
    'on-chain-accountability',
  ];
  const capabilitiesHash = buildCapabilitiesHash(capabilities);

  log.info('Agent capabilities hash computed', { capabilitiesHash, capabilities });

  // Already registered and active with the same URI — nothing to do
  if (status.isRegistered && status.isActive && status.agentURI === config.agentUri) {
    log.info('Agent is already registered and active with current URI', {
      address: wallet.address,
      registeredAt: status.registeredAt,
    });
    return { txHash: null, action: 'already-active' };
  }

  // Dry-run mode
  if (config.dryRun) {
    if (status.isRegistered) {
      log.info('[DRY RUN] Would update agent URI', {
        address: wallet.address,
        newURI: config.agentUri,
      });
    } else {
      log.info('[DRY RUN] Would register agent', {
        address: wallet.address,
        agentURI: config.agentUri,
        agentType: config.agentType,
        capabilitiesHash,
      });
    }
    return { txHash: null, action: 'dry-run' };
  }

  const registry = getRegistryContract(wallet);

  // If already registered, update the URI
  if (status.isRegistered) {
    log.info('Agent already registered — updating URI', {
      oldURI: status.agentURI,
      newURI: config.agentUri,
    });

    const tx = await withRetry(
      () => registry.updateAgentURI(config.agentUri),
      config.maxRetries,
      config.retryDelayMs,
      log,
      'updateAgentURI',
    );
    const receipt = await tx.wait();
    log.info('Agent URI updated successfully', { txHash: receipt.hash });
    return { txHash: receipt.hash, action: 'updated' };
  }

  // Fresh registration
  log.info('Registering agent in ERC8004IdentityRegistry', {
    address: wallet.address,
    agentURI: config.agentUri,
    agentType: config.agentType,
  });

  const tx = await withRetry(
    () => registry.registerAgent(config.agentUri, config.agentType, capabilitiesHash),
    config.maxRetries,
    config.retryDelayMs,
    log,
    'registerAgent',
  );
  const receipt = await tx.wait();
  log.info('Agent registered successfully', { txHash: receipt.hash });
  return { txHash: receipt.hash, action: 'registered' };
}

/**
 * Get the total number of agents registered in the protocol.
 */
export async function getTotalAgents(wallet: AgentWallet): Promise<number> {
  const registry = getRegistryContract(wallet);
  const count = await registry.getTotalAgents();
  return Number(count);
}
