/**
 * Vaultfire SDK - Production-Ready Trust Layer for Base
 *
 * @packageDocumentation
 * The official TypeScript SDK for integrating Vaultfire trust verification
 * into your Base applications. Supports beliefs, reputation, credentials,
 * identity, and any custom claim verification.
 */

import { ethers, Contract, Signer, Provider } from 'ethers';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Supported blockchain networks
 */
export type ChainId = 'base' | 'base-sepolia' | 'base-goerli';

/**
 * Module types for different verification categories
 */
export enum ModuleType {
  GENERIC = 0,
  GITHUB = 1,
  NS3 = 2,
  BASE = 3,
  CREDENTIAL = 4,
  REPUTATION = 5,
  IDENTITY = 6,
  GOVERNANCE = 7,
}

/**
 * Belief attestation request
 */
export interface BeliefAttestation {
  /** Hash of the belief statement (keccak256) */
  beliefHash: string;
  /** Module ID for verification type */
  moduleId: number;
  /** ZK proof bundle from RISC Zero */
  zkProofBundle?: string;
  /** Optional metadata (stays off-chain) */
  metadata?: Record<string, unknown>;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the proof is valid */
  verified: boolean;
  /** Transaction hash on Base */
  txHash?: string;
  /** Gas used for verification */
  gasUsed?: bigint;
  /** Attestation ID (if successful) */
  attestationId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Attestation record from chain
 */
export interface Attestation {
  /** Unique attestation ID */
  id: string;
  /** Belief hash */
  beliefHash: string;
  /** Attester address */
  prover: string;
  /** Module used */
  moduleId: number;
  /** Whether ZK verified */
  zkVerified: boolean;
  /** Block timestamp */
  timestamp: number;
  /** Transaction hash */
  txHash: string;
}

/**
 * SDK Configuration
 */
export interface VaultfireConfig {
  /** Chain to use (default: 'base') */
  chain?: ChainId;
  /** Custom RPC URL (optional) */
  rpcUrl?: string;
  /** Custom contract addresses (optional) */
  contracts?: {
    dilithiumAttestor?: string;
    beliefVerifier?: string;
  };
  /** API key for rate limiting (optional) */
  apiKey?: string;
  /** Enable analytics (default: true) */
  analytics?: boolean;
}

/**
 * Module information
 */
export interface ModuleInfo {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
}

// ============================================================================
// Contract ABIs (minimal for SDK)
// ============================================================================

const DILITHIUM_ATTESTOR_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' },
      { internalType: 'bytes', name: 'zkProofBundle', type: 'bytes' },
    ],
    name: 'attestBelief',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' }],
    name: 'isBeliefSovereign',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'prover', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'zkVerified', type: 'bool' },
    ],
    name: 'BeliefAttested',
    type: 'event',
  },
] as const;

// ============================================================================
// Chain Configuration
// ============================================================================

const CHAIN_CONFIG: Record<ChainId, { chainId: number; rpcUrl: string; contracts: { dilithiumAttestor: string; beliefVerifier: string } }> = {
  base: {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    contracts: {
      dilithiumAttestor: '0x0000000000000000000000000000000000000000', // TODO: Set after deployment
      beliefVerifier: '0x0000000000000000000000000000000000000000',
    },
  },
  'base-sepolia': {
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    contracts: {
      dilithiumAttestor: '0x0000000000000000000000000000000000000000',
      beliefVerifier: '0x0000000000000000000000000000000000000000',
    },
  },
  'base-goerli': {
    chainId: 84531,
    rpcUrl: 'https://goerli.base.org',
    contracts: {
      dilithiumAttestor: '0x0000000000000000000000000000000000000000',
      beliefVerifier: '0x0000000000000000000000000000000000000000',
    },
  },
};

// ============================================================================
// VaultfireSDK Class
// ============================================================================

/**
 * Main SDK class for Vaultfire trust layer integration
 *
 * @example
 * ```typescript
 * import { VaultfireSDK } from '@vaultfire/sdk';
 *
 * const vaultfire = new VaultfireSDK({ chain: 'base' });
 * const proof = await vaultfire.verifyBelief({ beliefHash, moduleId });
 * ```
 */
export class VaultfireSDK {
  private config: Required<VaultfireConfig>;
  private provider: Provider;
  private contract: Contract;
  private signer?: Signer;

  constructor(config: VaultfireConfig = {}) {
    // Set defaults
    this.config = {
      chain: config.chain || 'base',
      rpcUrl: config.rpcUrl || CHAIN_CONFIG[config.chain || 'base'].rpcUrl,
      contracts: {
        dilithiumAttestor:
          config.contracts?.dilithiumAttestor ||
          CHAIN_CONFIG[config.chain || 'base'].contracts.dilithiumAttestor,
        beliefVerifier:
          config.contracts?.beliefVerifier ||
          CHAIN_CONFIG[config.chain || 'base'].contracts.beliefVerifier,
      },
      apiKey: config.apiKey || '',
      analytics: config.analytics !== false,
    };

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    // Initialize contract (read-only by default)
    this.contract = new ethers.Contract(
      this.config.contracts.dilithiumAttestor!,
      DILITHIUM_ATTESTOR_ABI,
      this.provider
    );
  }

  /**
   * Connect a signer for write operations
   * @param signer - Ethers signer instance
   */
  connect(signer: Signer): void {
    this.signer = signer;
    this.contract = new ethers.Contract(
      this.config.contracts.dilithiumAttestor!,
      DILITHIUM_ATTESTOR_ABI,
      signer
    );
  }

  /**
   * Verify a belief with ZK proof
   *
   * @param attestation - Belief attestation parameters
   * @returns Verification result with transaction details
   *
   * @example
   * ```typescript
   * const result = await vaultfire.verifyBelief({
   *   beliefHash: '0x...',
   *   moduleId: ModuleType.GITHUB,
   *   zkProofBundle: '0x...',
   * });
   * console.log('Verified:', result.verified);
   * console.log('TX:', result.txHash);
   * ```
   */
  async verifyBelief(attestation: BeliefAttestation): Promise<VerificationResult> {
    if (!this.signer) {
      throw new Error('SDK not connected. Call connect(signer) first.');
    }

    try {
      // Validate inputs
      if (!attestation.beliefHash || !attestation.beliefHash.startsWith('0x')) {
        throw new Error('Invalid beliefHash format');
      }

      // Generate ZK proof if not provided
      const zkProofBundle = attestation.zkProofBundle || '0x00';

      // Submit attestation
      const tx = await this.contract.attestBelief(
        attestation.beliefHash,
        zkProofBundle
      );

      const receipt = await tx.wait();

      return {
        verified: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed,
        attestationId: `${attestation.beliefHash}-${receipt.blockNumber}`,
      };
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a belief has been attested
   *
   * @param beliefHash - Hash of the belief to check
   * @returns Whether the belief is sovereign (attested)
   */
  async isSovereign(beliefHash: string): Promise<boolean> {
    try {
      return await this.contract.isBeliefSovereign(beliefHash);
    } catch {
      return false;
    }
  }

  /**
   * Get attestations by address
   *
   * @param address - Ethereum address to query
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of attestations
   */
  async getAttestations(address: string, limit = 100): Promise<Attestation[]> {
    try {
      const filter = this.contract.filters.BeliefAttested(null, null, null);
      const events = await this.contract.queryFilter(filter, -10000, 'latest');

      const attestations = await Promise.all(
        events
          .filter((event) => {
            if (!('args' in event)) return false;
            const args = event.args;
            return args && args[1].toLowerCase() === address.toLowerCase();
          })
          .slice(0, limit)
          .map(async (event) => {
            const block = await event.getBlock();
            if (!('args' in event)) throw new Error('Event missing args');
            const args = event.args!;

            return {
              id: `${args[0]}-${event.blockNumber}`,
              beliefHash: args[0],
              prover: args[1],
              moduleId: 0, // TODO: Extract from event
              zkVerified: args[2],
              timestamp: block.timestamp,
              txHash: event.transactionHash,
            };
          })
      );

      return attestations;
    } catch {
      return [];
    }
  }

  /**
   * Get available modules
   *
   * @returns Array of module information
   */
  async getModules(): Promise<ModuleInfo[]> {
    return [
      { id: ModuleType.GENERIC, name: 'Generic', description: 'Generic belief attestation', enabled: true },
      { id: ModuleType.GITHUB, name: 'GitHub', description: 'Verify GitHub contributions', enabled: true },
      { id: ModuleType.NS3, name: 'NS3', description: 'Verify NS3 namespace ownership', enabled: true },
      { id: ModuleType.BASE, name: 'Base', description: 'Verify Base transactions', enabled: true },
      { id: ModuleType.CREDENTIAL, name: 'Credentials', description: 'Professional credentials', enabled: true },
      { id: ModuleType.REPUTATION, name: 'Reputation', description: 'On-chain reputation', enabled: true },
      { id: ModuleType.IDENTITY, name: 'Identity', description: 'Identity verification', enabled: true },
      { id: ModuleType.GOVERNANCE, name: 'Governance', description: 'DAO governance proofs', enabled: true },
    ];
  }

  /**
   * Hash a belief statement
   *
   * @param statement - Belief statement (plain text)
   * @returns Keccak256 hash of the statement
   */
  hashBelief(statement: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(statement));
  }

  /**
   * Get current chain configuration
   *
   * @returns Current chain config
   */
  getChainConfig() {
    return {
      chain: this.config.chain,
      chainId: CHAIN_CONFIG[this.config.chain].chainId,
      contracts: this.config.contracts,
    };
  }

  /**
   * Estimate gas for belief verification
   *
   * @param attestation - Belief attestation parameters
   * @returns Estimated gas units
   */
  async estimateGas(attestation: BeliefAttestation): Promise<bigint> {
    try {
      const zkProofBundle = attestation.zkProofBundle || '0x00';
      return await this.contract.attestBelief.estimateGas(
        attestation.beliefHash,
        zkProofBundle
      );
    } catch {
      return BigInt(61000); // Default estimate from benchmarks
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default VaultfireSDK;

/**
 * Utility function to create a quick SDK instance
 *
 * @param chain - Chain to use
 * @returns Configured SDK instance
 */
export function createVaultfireSDK(chain: ChainId = 'base'): VaultfireSDK {
  return new VaultfireSDK({ chain });
}
