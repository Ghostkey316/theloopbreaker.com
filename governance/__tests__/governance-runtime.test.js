'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('governance runtime behaviours', () => {
  let tempDir;
  let core;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-gov-runtime-'));
    core = require('../governance-core');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('prefers environment overrides when resolving config path', () => {
    const configPath = path.join(tempDir, 'env-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ thresholds: { quorum: 0.7 } }));
    process.env.VAULTFIRE_GOV_CONFIG = configPath;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { source, config } = core.loadGovernanceConfig({ cwd: tempDir });
    expect(source).toBe(configPath);
    expect(config.thresholds.quorum).toBe(0.7);
    warnSpy.mockRestore();
    delete process.env.VAULTFIRE_GOV_CONFIG;
  });

  it('logs runtime events with audit metadata', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const entry = core.logRuntimeEvent('governance.audit.summary', {
      level: 'error',
      details: { ok: false },
      config: { auditPassed: false },
    });
    expect(entry.level).toBe('error');
    expect(entry.config.auditPassed).toBe(false);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('runs audits and records decisions via audit logger', () => {
    const configPath = path.join(tempDir, 'failing.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ thresholds: { multiplierCritical: 2, summaryWarning: 1 }, compliance: { contacts: [] } })
    );
    const auditLogger = { logDecision: jest.fn() };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const outcome = core.runAudit(['node', 'audit', `--config-path=${configPath}`], { auditLogger });
    expect(outcome.ok).toBe(false);
    expect(auditLogger.logDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decisionType: 'governance.audit.summary', policyChange: 'blocked' })
    );
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
