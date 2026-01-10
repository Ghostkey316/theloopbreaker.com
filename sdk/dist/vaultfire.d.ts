/**
 * Vaultfire SDK - Production-Ready Trust Layer for Base
 *
 * @packageDocumentation
 * The official TypeScript SDK for integrating Vaultfire trust verification
 * into your Base applications. Supports beliefs, reputation, credentials,
 * identity, and any custom claim verification.
 */
import { Signer } from 'ethers';
/**
 * Supported blockchain networks
 */
export type ChainId = 'base' | 'base-sepolia' | 'base-goerli';
/**
 * Module types for different verification categories
 */
export declare enum ModuleType {
    GENERIC = 0,
    GITHUB = 1,
    NS3 = 2,
    BASE = 3,
    CREDENTIAL = 4,
    REPUTATION = 5,
    IDENTITY = 6,
    GOVERNANCE = 7
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
export declare class VaultfireSDK {
    private config;
    private provider;
    private contract;
    private signer?;
    constructor(config?: VaultfireConfig);
    /**
     * Connect a signer for write operations
     * @param signer - Ethers signer instance
     */
    connect(signer: Signer): void;
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
    verifyBelief(attestation: BeliefAttestation): Promise<VerificationResult>;
    /**
     * Check if a belief has been attested
     *
     * @param beliefHash - Hash of the belief to check
     * @returns Whether the belief is sovereign (attested)
     */
    isSovereign(beliefHash: string): Promise<boolean>;
    /**
     * Get attestations by address
     *
     * @param address - Ethereum address to query
     * @param limit - Maximum number of results (default: 100)
     * @returns Array of attestations
     */
    getAttestations(address: string, limit?: number): Promise<Attestation[]>;
    /**
     * Get available modules
     *
     * @returns Array of module information
     */
    getModules(): Promise<ModuleInfo[]>;
    /**
     * Hash a belief statement
     *
     * @param statement - Belief statement (plain text)
     * @returns Keccak256 hash of the statement
     */
    hashBelief(statement: string): string;
    /**
     * Get current chain configuration
     *
     * @returns Current chain config
     */
    getChainConfig(): {
        chain: ChainId;
        chainId: number;
        contracts: {
            dilithiumAttestor?: string;
            beliefVerifier?: string;
        };
    };
    /**
     * Estimate gas for belief verification
     *
     * @param attestation - Belief attestation parameters
     * @returns Estimated gas units
     */
    estimateGas(attestation: BeliefAttestation): Promise<bigint>;
}
export default VaultfireSDK;
/**
 * Utility function to create a quick SDK instance
 *
 * @param chain - Chain to use
 * @returns Configured SDK instance
 */
export declare function createVaultfireSDK(chain?: ChainId): VaultfireSDK;
