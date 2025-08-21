const { syncToASM } = require('../vaultfire_core');

describe('syncToASM', () => {
  test('resolves for authorized wallet', async () => {
    const result = await syncToASM({ wallet: 'bpow20.cb.id', layer: 'tokenomics', trigger: 'loyalty' });
    expect(result.success).toBe(true);
    expect(typeof result.timestamp).toBe('string');
  });

  test('rejects unauthorized wallet', async () => {
    await expect(syncToASM({ wallet: 'bad.wallet', layer: 'tokenomics', trigger: 'loyalty' })).rejects.toThrow('unauthorized wallet ID');
  });
});
