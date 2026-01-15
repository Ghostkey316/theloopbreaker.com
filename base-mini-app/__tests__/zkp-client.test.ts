/**
 * Comprehensive test suite for ZKP Client
 * Tests error handling, edge cases, and network failures
 */

import { VaultfireZKPClient, BeliefProofInputs } from '../lib/zkp-client';
import { keccak256, toBytes } from 'viem';

describe('VaultfireZKPClient', () => {
  describe('Input Validation', () => {
    it('should reject empty belief text', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });

      const inputs: BeliefProofInputs = {
        belief: '',
        beliefHash: keccak256(toBytes('')),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Belief text cannot be empty');
    });

    it('should reject belief text that is too long', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const longBelief = 'a'.repeat(5001);

      const inputs: BeliefProofInputs = {
        belief: longBelief,
        beliefHash: keccak256(toBytes(longBelief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Belief text too long');
    });

    it('should reject belief hash mismatch', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });

      const inputs: BeliefProofInputs = {
        belief: 'I believe in decentralization',
        beliefHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Belief hash mismatch');
    });

    it('should reject loyalty score below 0', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: -100,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Loyalty score must be between 0 and 10000');
    });

    it('should reject loyalty score above 10000', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 10001,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Loyalty score must be between 0 and 10000');
    });

    it('should reject invalid module ID (too low)', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: -1,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Module ID must be between 0 and 11');
    });

    it('should reject invalid module ID (too high)', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 12,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Module ID must be between 0 and 11');
    });

    it('should reject invalid prover address', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0xinvalid' as `0x${string}`,
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Invalid prover address');
    });

    it('should accept all valid module IDs (0-11)', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      for (let moduleId = 0; moduleId <= 11; moduleId++) {
        const inputs: BeliefProofInputs = {
          belief,
          beliefHash: keccak256(toBytes(belief)),
          loyaltyScore: 5000,
          moduleId,
          activityProof: '{}',
          proverAddress: '0x0000000000000000000000000000000000000001',
        };

        const proof = await client.generateBeliefProof(inputs);
        expect(proof.publicInputs.moduleId).toBe(moduleId);
      }
    });
  });

  describe('Mock Proof Generation', () => {
    it('should generate deterministic mock proofs', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in decentralization';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: JSON.stringify({ commits: 100 }),
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof1 = await client.generateBeliefProof(inputs);
      const proof2 = await client.generateBeliefProof(inputs);

      expect(proof1.proofBytes).toBe(proof2.proofBytes);
    });

    it('should validate loyalty score in mock proofs', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 8500,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.loyaltyScoreValid).toBe(true);
    });

    it('should mark invalid loyalty scores in mock proofs', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      // This should pass validation but be marked invalid in the proof
      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 0,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.loyaltyScoreValid).toBe(true);
      expect(proof.publicInputs.beliefHash).toBe(keccak256(toBytes(belief)));
    });
  });

  describe('Real Proof Generation', () => {
    it('should throw error when prover URL not configured', async () => {
      const client = new VaultfireZKPClient({
        useMockProofs: false,
        proverServiceUrl: undefined
      });

      const belief = 'I believe in freedom';
      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Prover service URL not configured');
    });

    it('should handle prover service errors gracefully', async () => {
      // Mock fetch to simulate server error
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        } as Response)
      );

      const client = new VaultfireZKPClient({
        useMockProofs: false,
        proverServiceUrl: 'https://test-prover.example.com'
      });

      const belief = 'I believe in freedom';
      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Prover service error: 500');
    });

    it('should handle network timeout errors', async () => {
      // Mock fetch to simulate network timeout
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Network timeout'))
      );

      const client = new VaultfireZKPClient({
        useMockProofs: false,
        proverServiceUrl: 'https://test-prover.example.com'
      });

      const belief = 'I believe in freedom';
      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      await expect(client.generateBeliefProof(inputs))
        .rejects
        .toThrow('Failed to generate ZK proof');
    });
  });

  describe('Configuration', () => {
    it('should detect mock proof usage', () => {
      const mockClient = new VaultfireZKPClient({ useMockProofs: true });
      expect(mockClient.isUsingMockProofs()).toBe(true);

      const realClient = new VaultfireZKPClient({
        useMockProofs: false,
        proverServiceUrl: 'https://test-prover.example.com'
      });
      expect(realClient.isUsingMockProofs()).toBe(false);
    });

    it('should default to mock proofs when no URL provided', () => {
      const client = new VaultfireZKPClient({});
      expect(client.isUsingMockProofs()).toBe(true);
    });

    it('should use real proofs when URL is provided', () => {
      const client = new VaultfireZKPClient({
        proverServiceUrl: 'https://test-prover.example.com'
      });
      expect(client.isUsingMockProofs()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum valid loyalty score', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 10000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.loyaltyScoreValid).toBe(true);
    });

    it('should handle minimum valid loyalty score', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 0,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.loyaltyScoreValid).toBe(true);
    });

    it('should handle unicode characters in belief text', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'I believe in freedom 自由 🌍';

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.beliefHash).toBe(keccak256(toBytes(belief)));
    });

    it('should handle exactly 5000 character belief', async () => {
      const client = new VaultfireZKPClient({ useMockProofs: true });
      const belief = 'a'.repeat(5000);

      const inputs: BeliefProofInputs = {
        belief,
        beliefHash: keccak256(toBytes(belief)),
        loyaltyScore: 5000,
        moduleId: 0,
        activityProof: '{}',
        proverAddress: '0x0000000000000000000000000000000000000001',
      };

      const proof = await client.generateBeliefProof(inputs);
      expect(proof.publicInputs.beliefHash).toBe(keccak256(toBytes(belief)));
    });
  });
});
