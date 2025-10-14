const {
  missionGatekeeper,
  lawAlignmentScore,
  progressiveUnlock,
  setGatekeeperOverrides,
  resetGatekeeperOverrides,
} = require('../mission-gatekeeper');

const moduleTiers = {
  core: [{ name: 'CoreAlpha', status: 'pending_audit' }],
  optional: [
    { name: 'SecretBeta', status: 'pending_audit' },
    { name: 'SecretGamma', status: 'pending_audit' },
  ],
  advanced: [
    { name: 'RelicOne', status: 'pending_audit' },
    { name: 'RelicTwo', status: 'pending_audit' },
    { name: 'RelicThree', status: 'pending_audit' },
    { name: 'RelicFour', status: 'pending_audit' },
    { name: 'AdvancedFive', status: 'pending_audit' },
  ],
};

const beliefScores = {
  '0xabc': { interactions: 20, growth_events: 10, flames: 5 },
};

describe('mission-gatekeeper', () => {
  beforeEach(() => {
    setGatekeeperOverrides({ moduleTiers, beliefScores });
  });

  afterEach(() => {
    resetGatekeeperOverrides();
  });

  test('law alignment scoring counts valid entries only', () => {
    expect(lawAlignmentScore({ 1: true, 5: 1, 11: true, foo: true })).toBe(2);
  });

  test('mission gatekeeper unlocks tiers progressively', () => {
    const proof = {};
    for (let index = 1; index <= 10; index += 1) {
      proof[index] = true;
    }
    const decision = missionGatekeeper({ wallet: '0xAbC', proofOfLaw: proof });

    expect(decision.status).toBe('approved');
    expect(decision.lawScore).toBe(10);
    expect(decision.trustScore).toBeGreaterThanOrEqual(45);
    expect(decision.proofSource).toBe('0xabc');

    expect(decision.access.core.map((module) => module.name)).toEqual(['CoreAlpha']);
    expect(decision.access.secrets.map((module) => module.name)).toEqual(['SecretBeta', 'SecretGamma']);
    expect(decision.access.relics.map((module) => module.name)).toEqual([
      'RelicOne',
      'RelicTwo',
      'RelicThree',
      'RelicFour',
    ]);
    expect(decision.access.advanced.map((module) => module.name)).toContain('AdvancedFive');
  });

  test('progressive unlock with low scores keeps advanced tiers locked', () => {
    const access = progressiveUnlock({ trustScore: 10, lawScore: 3 });
    expect(access.core).toEqual(moduleTiers.core);
    expect(access.secrets).toHaveLength(0);
    expect(access.relics).toHaveLength(0);
    expect(access.advanced).toHaveLength(0);
  });
});
