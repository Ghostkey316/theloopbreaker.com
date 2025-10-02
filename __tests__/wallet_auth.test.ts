import { authenticateWallet, resolveAddress } from '../wallet_auth';

const stubResolver: any = {
  async init() {
    return this;
  },
  async refresh() {
    return 0;
  },
  stop() {
    return undefined;
  },
  async resolve(identifier: string) {
    if (identifier === 'ghostkey316.eth') {
      return '0x9abCDEF1234567890abcdefABCDEF1234567890';
    }
    return null;
  },
  resolveSync() {
    return null;
  },
  getMetadata() {
    return null;
  },
};

describe('wallet_auth domain validation', () => {
  it('normalizes wallet identifiers without domain', () => {
    expect(authenticateWallet(' believer ')).toBe('believer.vaultfire.eth');
  });

  it('rejects unsupported wallet domains', () => {
    expect(() => authenticateWallet('user.xyz', ['.eth'])).toThrow('Wallet domain not accepted');
  });

  it('resolves known ENS mappings', async () => {
    await expect(resolveAddress('ghostkey316.eth', stubResolver)).resolves.toBe(
      '0x9abCDEF1234567890abcdefABCDEF1234567890',
    );
  });

  it('returns null for malformed identifiers', async () => {
    await expect(resolveAddress('not a wallet', stubResolver)).resolves.toBeNull();
  });
});
