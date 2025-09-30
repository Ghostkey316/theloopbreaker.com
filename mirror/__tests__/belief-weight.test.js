const { computeBeliefMultiplier, determineTier, baseMultiplierFor } = require('../belief-weight');

describe('belief multiplier math module', () => {
  test('computes multiplier with custom baseline and weights', () => {
    const result = computeBeliefMultiplier(
      'vote',
      {
        loyalty: 90,
        ethics: 80,
        frequency: 70,
        alignment: 60,
        holdDuration: 50,
      },
      {
        baselineMultiplier: 1.1,
        weights: { loyalty: 0.5, ethics: 0.3, frequency: 0.1, alignment: 0.05, holdDuration: 0.05 },
      }
    );

    expect(result.multiplier).toBeCloseTo(1.1 + 0.9 * 0.5 + 0.8 * 0.3 + 0.7 * 0.1 + 0.6 * 0.05 + 0.5 * 0.05, 4);
    expect(result.overridesDetected).toBe(true);
  });

  test('determines tier based on multiplier thresholds', () => {
    expect(determineTier(1.7)).toBe('Mythic');
    expect(determineTier(1.0)).toBe('Initiate');
    expect(determineTier(0.9)).toBe('Observer');
  });

  test('falls back to default baseline when action type is unknown', () => {
    expect(baseMultiplierFor('unknown-action')).toBe(1.02);
  });
});
