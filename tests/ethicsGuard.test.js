const fs = require('fs');
const os = require('os');
const path = require('path');

const createEthicsGuard = require('../middleware/ethicsGuard');

describe('ethicsGuard middleware', () => {
  const policy = {
    blockedReasons: ['fraud'],
    warnReasons: ['automation'],
  };

  function writePolicy(tempDir) {
    const policyPath = path.join(tempDir, 'policy.json');
    fs.writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
    return policyPath;
  }

  test('logs purpose-based decisions and blocks disallowed intents', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ethics-guard-'));
    const policyPath = writePolicy(tempDir);
    const logPath = path.join(tempDir, 'guard.log');
    const guard = createEthicsGuard({ policyPath, logPath });

    const req = {
      method: 'POST',
      originalUrl: '/vaultfire/reward',
      headers: { 'x-vaultfire-reason': 'fraud', 'x-vaultfire-purpose': 'suspicious-withdrawal' },
      body: {},
      user: { role: 'partner', sub: 'partner-1' },
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
      setHeader() {},
    };

    const next = jest.fn();
    guard(req, res, next);

    expect(res.statusCode).toBe(451);
    expect(next).not.toHaveBeenCalled();
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    expect(lastEntry.decision).toBe('blocked');
    expect(lastEntry.purpose).toBe('suspicious-withdrawal');
  });

  test('warns automation attempts while allowing request', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ethics-guard-'));
    const policyPath = writePolicy(tempDir);
    const logPath = path.join(tempDir, 'guard.log');
    const guard = createEthicsGuard({ policyPath, logPath });

    const req = {
      method: 'GET',
      url: '/vaultfire/telemetry',
      headers: { 'x-vaultfire-reason': 'automation' },
      body: {},
      user: { role: 'partner', sub: 'partner-automation' },
      ip: '127.0.0.1',
    };
    const res = {
      status() {
        throw new Error('should not block automation warning');
      },
      json() {},
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    guard(req, res, next);
    expect(next).toHaveBeenCalled();
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    expect(lastEntry.decision).toBe('warned');
    expect(res.setHeader).toHaveBeenCalledWith('X-Vaultfire-Ethics-Warning', 'automation');
  });
});
