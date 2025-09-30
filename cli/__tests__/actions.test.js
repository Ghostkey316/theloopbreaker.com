'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const originalCwd = process.cwd();
let tempDir;

function cleanupTempDir() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDir = undefined;
}

describe('cli/actions', () => {
  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-cli-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupTempDir();
  });

  it('creates a partner config with normalised wallet and ENS', () => {
    const actions = require('../actions');
    const { config, path: configPath } = actions.initConfig({
      configPath: 'partner.json',
      walletAddress: '0xABCDEF',
      ensAlias: 'VaultFire.ETH',
    });

    expect(config.walletAddress).toBe('0xabcdef');
    expect(config.ensAlias).toBe('vaultfire.eth');
    expect(fs.existsSync(configPath)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(stored.walletAddress).toBe('0xabcdef');
  });

  it('throws when config already exists without overwrite flag', () => {
    const actions = require('../actions');
    fs.writeFileSync(path.join(tempDir, 'partner.json'), JSON.stringify({ foo: 'bar' }));
    expect(() => actions.initConfig({ configPath: 'partner.json' })).toThrow(/already exists/);
  });

  it('loads existing config and applies identity defaults', () => {
    const storedConfig = {
      walletAddress: '0xABCDEF',
      beliefFeedPath: 'belief.json',
    };
    fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify(storedConfig));
    const actions = require('../actions');
    const loaded = actions.loadConfig('config.json');
    expect(loaded.walletAddress).toBe('0xabcdef');
    expect(loaded.identityPolicy.telemetryMode).toBe('wallet-anonymous');
  });
});
