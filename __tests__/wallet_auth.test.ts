import { authenticateWallet, resolveAddress } from '../wallet_auth';

describe('wallet_auth domain validation', () => {
  it('normalizes wallet identifiers without domain', () => {
    expect(authenticateWallet(' believer ')).toBe('believer.vaultfire.eth');
  });

  it('rejects unsupported wallet domains', () => {
    expect(() => authenticateWallet('user.xyz', ['.eth'])).toThrow('Wallet domain not accepted');
  });

  it('resolves known ENS mappings', () => {
    expect(resolveAddress('ghostkey316.eth')).toBe('0x9abCDEF1234567890abcdefABCDEF1234567890');
  });

  it('returns null for malformed identifiers', () => {
    expect(resolveAddress('not a wallet')).toBeNull();
  });
});
