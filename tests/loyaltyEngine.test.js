const { LoyaltyEngine, DEFAULT_TIERS } = require('../services/loyaltyEngine');

describe('LoyaltyEngine', () => {
  const createEngine = (options = {}) =>
    new LoyaltyEngine({
      ...options,
      provider: options.provider ?? {},
      contractAddress: '0x0000000000000000000000000000000000000001',
    });

  it('registers behavior scores and resolves tiers via address', async () => {
    const engine = createEngine({ contractFactory: () => ({ getMultiplier: async () => 1 }) });
    engine.registerBehaviorScore('0xabcDEFabcdefABCDefabcdefabcdefabcdefabcd', 82);
    const result = await engine.calculateMultiplier('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    expect(result.tier).toBe('blaze');
    expect(result.multiplier).toBeCloseTo(
      DEFAULT_TIERS.find((tier) => tier.tier === 'blaze').multiplier,
      5
    );
  });

  it('links telemetry anchors to addresses and exposes calculateMultiplier for telemetry ids', async () => {
    const engine = createEngine({ contractFactory: () => ({ getMultiplier: async () => 1 }) });
    engine.registerBehaviorScore('0x9999999999999999999999999999999999999999', 45, { telemetryId: 'session-123' });
    const result = await engine.calculateMultiplier('session-123');
    expect(result.address).toBe('0x9999999999999999999999999999999999999999');
    expect(result.telemetryId).toBe('session-123');
    expect(result.tier).toBe('spark');
  });

  it('combines on-chain multipliers with tiered multipliers', async () => {
    const engine = createEngine({
      provider: {},
      contractFactory: () => ({ getMultiplier: async () => 2 }),
    });
    engine.registerBehaviorScore('0x5555555555555555555555555555555555555555', 30);
    const result = await engine.calculateMultiplier('0x5555555555555555555555555555555555555555');
    expect(result.onChainMultiplier).toBe(2);
    expect(result.multiplier).toBeCloseTo(2 * result.tierMultiplier, 5);
  });

  it('falls back to baseline multiplier when on-chain calls fail', async () => {
    const engine = createEngine({
      contractFactory: () => ({ getMultiplier: async () => { throw new Error('offline'); } }),
    });
    const result = await engine.calculateMultiplier('0x1111111111111111111111111111111111111111');
    expect(result.multiplier).toBeCloseTo(1, 5);
  });
});
