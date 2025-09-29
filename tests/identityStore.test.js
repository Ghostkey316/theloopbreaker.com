const EncryptedIdentityStore = require('../services/identityStore');

describe('Encrypted identity store', () => {
  it('encrypts anchors and retrieves them by wallet', async () => {
    const store = new EncryptedIdentityStore({ provider: 'memory', encryptionKey: 'test-key' });
    await store.init();
    const anchor = await store.linkAnchor({
      wallet: '0xidentity',
      partnerUserId: 'user-1',
      beliefScore: 0.87,
      metadata: { intents: ['align'] },
    });
    expect(anchor.anchorId).toBeDefined();

    const fetched = await store.getAnchor({ wallet: '0xidentity', partnerUserId: 'user-1' });
    expect(fetched.beliefScore).toBeCloseTo(0.87);

    const walletAnchors = await store.listByWallet('0xidentity');
    expect(walletAnchors).toHaveLength(1);
    expect(walletAnchors[0].metadata.intents).toContain('align');
  });
});
