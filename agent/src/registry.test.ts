/**
 * Tests for the Vaultfire Agent Registry Module
 */

import { ethers } from 'ethers';
import { buildCapabilitiesHash } from './registry';

describe('buildCapabilitiesHash', () => {
  it('should return a valid bytes32 hash', () => {
    const hash = buildCapabilitiesHash(['protocol-monitoring', 'health-checks']);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should produce deterministic output for the same input', () => {
    const caps = ['protocol-monitoring', 'health-checks', 'metrics-reporting'];
    const hash1 = buildCapabilitiesHash(caps);
    const hash2 = buildCapabilitiesHash(caps);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different capabilities', () => {
    const hash1 = buildCapabilitiesHash(['capability-a']);
    const hash2 = buildCapabilitiesHash(['capability-b']);
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty capabilities array', () => {
    const hash = buildCapabilitiesHash([]);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should be order-sensitive', () => {
    const hash1 = buildCapabilitiesHash(['a', 'b']);
    const hash2 = buildCapabilitiesHash(['b', 'a']);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce the expected hash for the agent default capabilities', () => {
    const capabilities = [
      'protocol-monitoring',
      'health-checks',
      'metrics-reporting',
      'bond-management',
      'on-chain-accountability',
    ];
    const hash = buildCapabilitiesHash(capabilities);
    // Verify it is a valid keccak256 hash
    expect(hash.length).toBe(66); // 0x + 64 hex chars

    // Verify manually: ABI encode then keccak256
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(['string[]'], [capabilities]);
    const expected = ethers.keccak256(encoded);
    expect(hash).toBe(expected);
  });
});
