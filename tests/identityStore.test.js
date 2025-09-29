const EncryptedIdentityStore = require('../services/identityStore');

describe('Encrypted identity store', () => {
  it('encrypts anchors and retrieves them by wallet', async () => {
    const store = new EncryptedIdentityStore({ provider: 'memory', encryptionKey: 'test-key' });
    await store.init();
    const wallet = '0x4444444444444444444444444444444444444444';
    const anchor = await store.linkWallet({
      wallet,
      beliefScore: 0.87,
      metadata: { intents: ['align'] },
    });
    expect(anchor.anchorId).toBeDefined();
    expect(anchor.wallet).toBe(wallet);
    expect(anchor.ensAlias).toBeNull();

    const fetched = await store.getWalletAnchor({ wallet });
    expect(fetched.beliefScore).toBeCloseTo(0.87);

    const aliasAnchor = await store.linkWallet({
      wallet,
      ensAlias: 'ghostkey316.eth',
      beliefScore: 0.91,
      metadata: { intents: ['alias'] },
    });
    expect(aliasAnchor.ensAlias).toBe('ghostkey316.eth');

    const walletAnchors = await store.listByWallet(wallet);
    expect(walletAnchors).toHaveLength(2);
    expect(walletAnchors.map((entry) => entry.metadata.intents[0])).toEqual(expect.arrayContaining(['align', 'alias']));
  });
});
