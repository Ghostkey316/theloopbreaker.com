'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const createEthicsGuard = require('../middleware/ethicsGuard');
const { mergeWithBasePolicy, BASE_ETHICS_POLICY } = require('../middleware/ethicsGuard');

describe('Vaultfire ethics guard base policy', () => {
  it('merges partner policy while preserving core values', () => {
    const merged = mergeWithBasePolicy({
      blockedReasons: ['exploit_loop'],
      warnReasons: [],
      automation: { windowMs: 120000, maxRequests: 100 },
      coreValues: {
        humanityOverGreed: true,
        transparencySignals: true,
      },
    });

    expect(merged.coreValues.humanityOverGreed).toBe(true);
    expect(merged.coreValues.transparencySignals).toBe(true);
    expect(merged.warnReasons).toContain('excessive_automation');
    expect(merged.blockedReasons).toContain('exploit_loop');
    expect(merged.automation.windowMs).toBeLessThanOrEqual(BASE_ETHICS_POLICY.automation.windowMs);
    expect(merged.automation.maxRequests).toBeLessThanOrEqual(BASE_ETHICS_POLICY.automation.maxRequests);
  });

  it('rejects any attempt to weaken the base ethics stance', () => {
    expect(() => mergeWithBasePolicy({ coreValues: { freedomOverControl: false } })).toThrow(
      /cannot disable base ethics value/i
    );
    expect(() => mergeWithBasePolicy({ coreValues: { newValue: false } })).toThrow(/may only be strengthened/i);
  });

  it('exposes merged policy on the guard instance and records enforced core values', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ethics-'));
    const logPath = path.join(tmpDir, 'guard.log');
    const guard = createEthicsGuard({ logPath });

    expect(guard.basePolicy).toBe(BASE_ETHICS_POLICY);
    expect(guard.policy.coreValues.humanityOverGreed).toBe(true);
    expect(Object.isFrozen(guard.policy.coreValues)).toBe(true);

    const req = {
      headers: {},
      body: {},
      method: 'GET',
      originalUrl: '/health',
      user: { role: 'tester', sub: 'wallet' },
    };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
    const logContents = fs.readFileSync(logPath, 'utf8');
    expect(logContents).toMatch(/"enforcedCoreValues"/);
  });
});
