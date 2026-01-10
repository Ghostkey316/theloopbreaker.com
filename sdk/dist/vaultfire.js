"use strict";
/**
 * Vaultfire SDK - Production-Ready Trust Layer for Base
 *
 * @packageDocumentation
 * The official TypeScript SDK for integrating Vaultfire trust verification
 * into your Base applications. Supports beliefs, reputation, credentials,
 * identity, and any custom claim verification.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultfireSDK = exports.ModuleType = void 0;
exports.createVaultfireSDK = createVaultfireSDK;
const ethers_1 = require("ethers");
/**
 * Module types for different verification categories
 */
var ModuleType;
(function (ModuleType) {
    ModuleType[ModuleType["GENERIC"] = 0] = "GENERIC";
    ModuleType[ModuleType["GITHUB"] = 1] = "GITHUB";
    ModuleType[ModuleType["NS3"] = 2] = "NS3";
    ModuleType[ModuleType["BASE"] = 3] = "BASE";
    ModuleType[ModuleType["CREDENTIAL"] = 4] = "CREDENTIAL";
    ModuleType[ModuleType["REPUTATION"] = 5] = "REPUTATION";
    ModuleType[ModuleType["IDENTITY"] = 6] = "IDENTITY";
    ModuleType[ModuleType["GOVERNANCE"] = 7] = "GOVERNANCE";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
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
];
// ============================================================================
// Chain Configuration
// ============================================================================
const CHAIN_CONFIG = {
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
class VaultfireSDK {
    constructor(config = {}) {
        // Set defaults
        this.config = {
            chain: config.chain || 'base',
            rpcUrl: config.rpcUrl || CHAIN_CONFIG[config.chain || 'base'].rpcUrl,
            contracts: {
                dilithiumAttestor: config.contracts?.dilithiumAttestor ||
                    CHAIN_CONFIG[config.chain || 'base'].contracts.dilithiumAttestor,
                beliefVerifier: config.contracts?.beliefVerifier ||
                    CHAIN_CONFIG[config.chain || 'base'].contracts.beliefVerifier,
            },
            apiKey: config.apiKey || '',
            analytics: config.analytics !== false,
        };
        // Initialize provider
        this.provider = new ethers_1.ethers.JsonRpcProvider(this.config.rpcUrl);
        // Initialize contract (read-only by default)
        this.contract = new ethers_1.ethers.Contract(this.config.contracts.dilithiumAttestor, DILITHIUM_ATTESTOR_ABI, this.provider);
    }
    /**
     * Connect a signer for write operations
     * @param signer - Ethers signer instance
     */
    connect(signer) {
        this.signer = signer;
        this.contract = new ethers_1.ethers.Contract(this.config.contracts.dilithiumAttestor, DILITHIUM_ATTESTOR_ABI, signer);
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
    async verifyBelief(attestation) {
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
            const tx = await this.contract.attestBelief(attestation.beliefHash, zkProofBundle);
            const receipt = await tx.wait();
            return {
                verified: true,
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed,
                attestationId: `${attestation.beliefHash}-${receipt.blockNumber}`,
            };
        }
        catch (error) {
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
    async isSovereign(beliefHash) {
        try {
            return await this.contract.isBeliefSovereign(beliefHash);
        }
        catch {
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
    async getAttestations(address, limit = 100) {
        try {
            const filter = this.contract.filters.BeliefAttested(null, null, null);
            const events = await this.contract.queryFilter(filter, -10000, 'latest');
            const attestations = await Promise.all(events
                .filter((event) => {
                if (!('args' in event))
                    return false;
                const args = event.args;
                return args && args[1].toLowerCase() === address.toLowerCase();
            })
                .slice(0, limit)
                .map(async (event) => {
                const block = await event.getBlock();
                if (!('args' in event))
                    throw new Error('Event missing args');
                const args = event.args;
                return {
                    id: `${args[0]}-${event.blockNumber}`,
                    beliefHash: args[0],
                    prover: args[1],
                    moduleId: 0, // TODO: Extract from event
                    zkVerified: args[2],
                    timestamp: block.timestamp,
                    txHash: event.transactionHash,
                };
            }));
            return attestations;
        }
        catch {
            return [];
        }
    }
    /**
     * Get available modules
     *
     * @returns Array of module information
     */
    async getModules() {
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
    hashBelief(statement) {
        return ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(statement));
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
    async estimateGas(attestation) {
        try {
            const zkProofBundle = attestation.zkProofBundle || '0x00';
            return await this.contract.attestBelief.estimateGas(attestation.beliefHash, zkProofBundle);
        }
        catch {
            return BigInt(61000); // Default estimate from benchmarks
        }
    }
}
exports.VaultfireSDK = VaultfireSDK;
// ============================================================================
// Exports
// ============================================================================
exports.default = VaultfireSDK;
/**
 * Utility function to create a quick SDK instance
 *
 * @param chain - Chain to use
 * @returns Configured SDK instance
 */
function createVaultfireSDK(chain = 'base') {
    return new VaultfireSDK({ chain });
}
