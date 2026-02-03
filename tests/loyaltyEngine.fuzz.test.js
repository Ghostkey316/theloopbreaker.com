const { LoyaltyEngine, DEFAULT_TIERS } = require('../services/loyaltyEngine');

function makeXorShift32(seed = 123456789) {
  let x = seed >>> 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

function randomInt(rng, min, max) {
  const n = rng() / 0xffffffff;
  return Math.floor(n * (max - min + 1)) + min;
}

function expectedTierForScore(score, tiers = DEFAULT_TIERS) {
  const s = Number.isFinite(score) ? score : 0;
  // highest tier with minScore <= score
  let best = tiers[0];
  for (const tier of tiers) {
    if (s >= tier.minScore) best = tier;
  }
  return best;
}

describe('LoyaltyEngine (randomized invariants)', () => {
  const createEngine = (onChainMultiplier = 1) =>
    new LoyaltyEngine({
      provider: {},
      contractAddress: '0x0000000000000000000000000000000000000001',
      contractFactory: () => ({ getMultiplier: async () => onChainMultiplier }),
    });

  it('tier resolution matches the tier table for many random scores', async () => {
    const rng = makeXorShift32(0xdecafbad);
    const engine = createEngine(3);

    // Use a stable, valid address; we overwrite the score each iteration.
    const address = '0x2222222222222222222222222222222222222222';

    for (let i = 0; i < 250; i += 1) {
      const score = randomInt(rng, -50, 150);
      engine.registerBehaviorScore(address, score);
      const result = await engine.calculateMultiplier(address);

      const expectedTier = expectedTierForScore(score);
      expect(result.tier).toBe(expectedTier.tier);
      expect(result.tierMultiplier).toBeCloseTo(expectedTier.multiplier, 8);
      expect(result.onChainMultiplier).toBe(3);
      expect(result.multiplier).toBeCloseTo(Number((expectedTier.multiplier * 3).toFixed(4)), 8);
    }
  });

  it('tier multiplier is monotonic (non-decreasing) as scores increase', async () => {
    const rng = makeXorShift32(0x1234abcd);
    const engine = createEngine(1);
    const address = '0x3333333333333333333333333333333333333333';

    const scores = Array.from({ length: 200 }, () => randomInt(rng, -100, 200)).sort((a, b) => a - b);

    let lastTierMultiplier = -Infinity;
    for (const score of scores) {
      engine.registerBehaviorScore(address, score);
      const result = await engine.calculateMultiplier(address);
      expect(result.tierMultiplier).toBeGreaterThanOrEqual(lastTierMultiplier);
      lastTierMultiplier = result.tierMultiplier;
    }
  });
});
