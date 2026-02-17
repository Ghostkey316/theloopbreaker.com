/**
 * Tests for the Vaultfire Agent Metrics Module
 */

import { ethers } from 'ethers';
import { computeMetricId } from './metrics';

describe('computeMetricId', () => {
  it('should return a valid bytes32 hash', () => {
    const id = computeMetricId('protocol_health');
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should produce deterministic output', () => {
    const id1 = computeMetricId('agent_uptime');
    const id2 = computeMetricId('agent_uptime');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different metric names', () => {
    const id1 = computeMetricId('protocol_health');
    const id2 = computeMetricId('agent_uptime');
    expect(id1).not.toBe(id2);
  });

  it('should match ethers keccak256 of UTF-8 bytes', () => {
    const name = 'bond_quality';
    const id = computeMetricId(name);
    const expected = ethers.keccak256(ethers.toUtf8Bytes(name));
    expect(id).toBe(expected);
  });

  it('should handle empty string', () => {
    const id = computeMetricId('');
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    // keccak256 of empty bytes
    const expected = ethers.keccak256(ethers.toUtf8Bytes(''));
    expect(id).toBe(expected);
  });
});
