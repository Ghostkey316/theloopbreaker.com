/**
 * Tests for the Vaultfire Agent Wallet Module
 *
 * These tests verify wallet initialization logic without
 * requiring a live RPC connection.
 */

import { ethers } from 'ethers';

// Suppress log output during tests
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('Wallet utilities', () => {
  it('should derive a valid address from a private key', () => {
    // Use a known test private key (never use in production)
    const testKey = '0x' + 'a'.repeat(64);
    const wallet = new ethers.Wallet(testKey);
    const address = wallet.address;

    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address.length).toBe(42);
  });

  it('should produce deterministic addresses', () => {
    const key = '0x' + 'b'.repeat(64);
    const wallet1 = new ethers.Wallet(key);
    const wallet2 = new ethers.Wallet(key);

    expect(wallet1.address).toBe(wallet2.address);
  });

  it('should produce different addresses for different keys', () => {
    const wallet1 = new ethers.Wallet('0x' + 'a'.repeat(64));
    const wallet2 = new ethers.Wallet('0x' + 'b'.repeat(64));

    expect(wallet1.address).not.toBe(wallet2.address);
  });

  it('should reject invalid private keys', () => {
    expect(() => new ethers.Wallet('invalid-key')).toThrow();
    expect(() => new ethers.Wallet('0x')).toThrow();
    expect(() => new ethers.Wallet('')).toThrow();
  });

  it('should be able to sign messages', async () => {
    const key = '0x' + 'c'.repeat(64);
    const wallet = new ethers.Wallet(key);
    const signature = await wallet.signMessage('test message');

    expect(signature).toMatch(/^0x[0-9a-f]+$/);
    expect(signature.length).toBe(132); // 65 bytes = 130 hex + 0x
  });
});
