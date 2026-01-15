/**
 * Vaultfire ZK Proof Client
 *
 * Interfaces with RISC Zero prover service to generate cryptographic proofs
 * for belief attestations with privacy-preserving loyalty scores
 */

import { keccak256, toBytes, bytesToHex } from 'viem';

export interface BeliefProofInputs {
  belief: string;
  beliefHash: `0x${string}`;
  loyaltyScore: number;
  moduleId: number;
  activityProof: string;
  proverAddress: `0x${string}`;
}

export interface ZKProof {
  proofBytes: `0x${string}`;
  publicInputs: {
    beliefHash: `0x${string}`;
    moduleId: number;
    loyaltyScoreValid: boolean;
    proverAddress: `0x${string}`;
  };
  imageId: `0x${string}`;
}

/**
 * Configuration for ZK proof generation
 */
export interface ZKProofConfig {
  // URL of the RISC Zero prover service (production)
  proverServiceUrl?: string;
  // Whether to use mock proofs for development
  useMockProofs?: boolean;
  // API key for prover service
  apiKey?: string;
}

/**
 * ZK Proof Client for generating belief attestation proofs
 */
export class VaultfireZKPClient {
  private config: ZKProofConfig;

  constructor(config: ZKProofConfig = {}) {
    this.config = {
      useMockProofs: config.useMockProofs ?? !config.proverServiceUrl,
      proverServiceUrl: config.proverServiceUrl ?? process.env.NEXT_PUBLIC_ZKP_PROVER_URL,
      apiKey: config.apiKey ?? process.env.NEXT_PUBLIC_ZKP_API_KEY,
    };
  }

  /**
   * Generate a zero-knowledge proof for a belief attestation
   *
   * @param inputs Proof inputs (belief, loyalty score, etc.)
   * @returns ZK proof that can be submitted to the smart contract
   */
  async generateBeliefProof(inputs: BeliefProofInputs): Promise<ZKProof> {
    // Validate inputs
    this.validateInputs(inputs);

    // Use mock proofs in development or when prover service is unavailable
    if (this.config.useMockProofs) {
      console.warn(
        '⚠️  Using MOCK ZK proofs - NOT CRYPTOGRAPHICALLY SECURE\n' +
        '   For production, configure NEXT_PUBLIC_ZKP_PROVER_URL'
      );
      return this.generateMockProof(inputs);
    }

    // Generate real RISC Zero STARK proof via prover service
    return this.generateRealProof(inputs);
  }

  /**
   * Generate a real RISC Zero STARK proof via prover service
   */
  private async generateRealProof(inputs: BeliefProofInputs): Promise<ZKProof> {
    if (!this.config.proverServiceUrl) {
      throw new Error(
        'Prover service URL not configured. Set NEXT_PUBLIC_ZKP_PROVER_URL ' +
        'or use useMockProofs for development.'
      );
    }

    try {
      const response = await fetch(`${this.config.proverServiceUrl}/prove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
        },
        body: JSON.stringify({
          belief: inputs.belief,
          expected_belief_hash: inputs.beliefHash,
          loyalty_score: inputs.loyaltyScore,
          module_id: inputs.moduleId,
          activity_proof: inputs.activityProof,
          prover_address: inputs.proverAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Prover service error: ${response.status} - ${error}`);
      }

      const proofData = await response.json();

      return {
        proofBytes: proofData.proof_bytes as `0x${string}`,
        publicInputs: {
          beliefHash: proofData.public_outputs.belief_hash as `0x${string}`,
          moduleId: proofData.public_outputs.module_id,
          loyaltyScoreValid: proofData.public_outputs.loyalty_score_valid,
          proverAddress: proofData.public_outputs.prover_address as `0x${string}`,
        },
        imageId: proofData.image_id as `0x${string}`,
      };
    } catch (error) {
      console.error('Error generating real ZK proof:', error);
      throw new Error(`Failed to generate ZK proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a mock proof for development/testing
   * ⚠️  NOT CRYPTOGRAPHICALLY SECURE - FOR DEVELOPMENT ONLY
   */
  private generateMockProof(inputs: BeliefProofInputs): ZKProof {
    // Create deterministic mock proof based on inputs
    const inputHash = keccak256(
      toBytes(`${inputs.beliefHash}${inputs.loyaltyScore}${inputs.moduleId}${inputs.activityProof}`)
    );

    // Generate 128-byte mock proof (deterministic, NOT random)
    const mockProofData = new Uint8Array(128);
    const hashBytes = toBytes(inputHash);
    for (let i = 0; i < 128; i++) {
      mockProofData[i] = hashBytes[i % hashBytes.length];
    }

    // Mock image ID (would be the RISC Zero guest program's image ID in production)
    const mockImageId = bytesToHex(new Uint8Array(32).fill(0x42));

    return {
      proofBytes: bytesToHex(mockProofData),
      publicInputs: {
        beliefHash: inputs.beliefHash,
        moduleId: inputs.moduleId,
        loyaltyScoreValid: inputs.loyaltyScore >= 0 && inputs.loyaltyScore <= 10000,
        proverAddress: inputs.proverAddress,
      },
      imageId: mockImageId,
    };
  }

  /**
   * Validate proof inputs
   */
  private validateInputs(inputs: BeliefProofInputs): void {
    if (!inputs.belief || inputs.belief.trim().length === 0) {
      throw new Error('Belief text cannot be empty');
    }

    if (inputs.belief.length > 5000) {
      throw new Error('Belief text too long (max 5000 characters)');
    }

    // Verify belief hash matches the belief text
    const computedHash = keccak256(toBytes(inputs.belief));
    if (computedHash !== inputs.beliefHash) {
      throw new Error('Belief hash mismatch - hash does not match belief text');
    }

    if (inputs.loyaltyScore < 0 || inputs.loyaltyScore > 10000) {
      throw new Error('Loyalty score must be between 0 and 10000 basis points');
    }

    if (inputs.moduleId < 0 || inputs.moduleId > 7) {
      throw new Error('Module ID must be between 0 and 7');
    }

    if (!inputs.proverAddress || inputs.proverAddress.length !== 42) {
      throw new Error('Invalid prover address');
    }
  }

  /**
   * Check if the client is using mock proofs
   */
  isUsingMockProofs(): boolean {
    return this.config.useMockProofs ?? false;
  }
}

/**
 * Singleton instance for the ZKP client
 */
let zkpClient: VaultfireZKPClient | null = null;

/**
 * Get the global ZKP client instance
 */
export function getZKPClient(config?: ZKProofConfig): VaultfireZKPClient {
  if (!zkpClient) {
    zkpClient = new VaultfireZKPClient(config);
  }
  return zkpClient;
}

/**
 * Generate a belief proof using the global client
 */
export async function generateBeliefProof(inputs: BeliefProofInputs): Promise<ZKProof> {
  const client = getZKPClient();
  return client.generateBeliefProof(inputs);
}

/**
 * Check if currently using mock proofs (not production-ready)
 */
export function isUsingMockProofs(): boolean {
  return getZKPClient().isUsingMockProofs();
}
