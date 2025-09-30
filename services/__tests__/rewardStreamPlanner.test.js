'use strict';

const RewardStreamPlanner = require('../rewardStreamPlanner');

describe('RewardStreamPlanner', () => {
  it('falls back to fixed multiplier when on-chain integration is unavailable', async () => {
    const telemetry = { record: jest.fn() };
    const planner = new RewardStreamPlanner({ telemetry, config: { fallbackMultiplier: 1.2 } });
    const preview = await planner.previewStream('0xabc', {
      partnerId: 'partner-1',
      currentYield: { multiplier: 1.05, tierLevel: 'ember' },
    });

    expect(preview.status).toBe('fallback');
    expect(preview.multiplier.value).toBe(1.2);
    expect(telemetry.record).toHaveBeenCalledWith(
      'rewards.stream.fallback',
      expect.objectContaining({ reason: 'contracts_unavailable' }),
      expect.any(Object)
    );
  });
});
