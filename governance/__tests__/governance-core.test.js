'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let tempDir;

function setupTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-gov-'));
}

function cleanupTempDir() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDir = undefined;
}

describe('governance-core', () => {
  beforeEach(() => {
    jest.resetModules();
    setupTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  it('merges config file overrides into governance defaults', () => {
    const core = require('../governance-core');
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ thresholds: { escalationWarning: 0.95 } }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { config } = core.loadGovernanceConfig({
      argv: ['node', 'script', `--config-path=${configPath}`],
      cwd: tempDir,
      defaultConfig: { thresholds: { quorum: 0.6 } },
    });
    expect(config.thresholds.quorum).toBe(0.6);
    expect(config.thresholds.escalationWarning).toBe(0.95);
    console.warn.mockRestore();
  });

  it('loads governance config from .govrc and notes source', () => {
    const core = require('../governance-core');
    fs.writeFileSync(path.join(tempDir, '.govrc'), JSON.stringify({ thresholds: { quorum: 0.75, summaryWarning: 1.2 } }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { config, source, usingDefaults } = core.loadGovernanceConfig({ cwd: tempDir });
    expect(source).toContain('.govrc');
    expect(usingDefaults).toBe(false);
    expect(config.thresholds.quorum).toBe(0.75);
    console.warn.mockRestore();
  });

  it('audits governance config and reports validation errors', () => {
    const core = require('../governance-core');
    const report = core.auditGovernanceConfig({
      thresholds: { multiplierCritical: 2, summaryWarning: 1 },
      compliance: { contacts: [] },
    });
    expect(report.ok).toBe(false);
    expect(report.errors).toContain('multiplierCritical must be lower than summaryWarning to ensure early blocking occurs before warning thresholds.');
    expect(report.warnings.length).toBeGreaterThan(0);
  });
});
