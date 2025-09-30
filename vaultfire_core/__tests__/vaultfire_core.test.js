'use strict';

const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(projectRoot, 'ghostkey_manifesto.md');
const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(originalEnv, key)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

describe('vaultfire_core', () => {
  beforeEach(() => {
    jest.resetModules();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('activates with manifest present and exposes wallet whitelist', () => {
    const core = require('../../vaultfire_core');
    expect(() => require('fs').accessSync(manifestPath)).not.toThrow();
    const result = core.activateCore();
    expect(result.wallets).toContain('bpow20.cb.id');
    expect(result.wallet).toBe(result.wallets[0]);
  });

  it('allows multi-wallet injections and blocks unauthorised senders', () => {
    process.env.WALLET_WHITELIST = 'wallet.one,wallet.two';
    const core = require('../../vaultfire_core');
    const vaultfire = {
      inject: jest.fn().mockReturnValue({ ok: true }),
      displayStatus: jest.fn(),
      simulateVaultfireEngagement: jest.fn(),
    };
    const injection = core.injectVaultfire(vaultfire, { senderWallet: 'wallet.one', testMode: true });
    expect(injection.ok).toBe(true);
    expect(vaultfire.inject).toHaveBeenCalled();
    expect(() => core.injectVaultfire(vaultfire, { senderWallet: 'wallet.three' })).toThrow(/not authorised/);
  });

  it('syncs to ASM when wallet is authorised', async () => {
    process.env.WALLET_WHITELIST = 'wallet.alpha';
    const core = require('../../vaultfire_core');
    const result = await core.syncToASM({ wallet: 'wallet.alpha', layer: 'asm-l2', trigger: 'manual' });
    expect(result.success).toBe(true);
    expect(result.authorisedWallets).toContain('wallet.alpha');
    await expect(core.syncToASM({ wallet: 'wallet.beta', layer: 'asm-l2', trigger: 'manual' })).rejects.toThrow(/unauthorized wallet/);
  });
});
