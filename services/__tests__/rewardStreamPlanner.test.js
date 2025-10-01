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

    expect(preview.status).toBe('mocked');
    expect(preview.multiplier.value).toBeCloseTo(1.05, 5);
    expect(telemetry.record).toHaveBeenCalledWith(
      'rewards.stream.preview',
      expect.objectContaining({ status: 'mocked', multiplier: 1.05 }),
      expect.objectContaining({ tags: expect.arrayContaining(['rewards']) })
    );
  });

  it('uses mock contract interface when applying contributions', async () => {
    const telemetry = { record: jest.fn() };
    const mockContract = {
      contractAddress: '0xstream',
      sendMultiplierUpdate: jest.fn().mockResolvedValue({ hash: '0xfeed' }),
    };
    const planner = new RewardStreamPlanner({
      telemetry,
      config: { fallbackMultiplier: 1.1, stream: { useMock: true } },
      contractInterface: mockContract,
      nowFn: () => 0,
    });

    const outcome = await planner.applyContribution('0xABC', {
      partnerId: 'partner-9',
      currentYield: { multiplier: 1.25, tierLevel: 'spark' },
      telemetryId: 'telemetry-9',
    });

    expect(mockContract.sendMultiplierUpdate).toHaveBeenCalledWith('0xABC', expect.any(Number));
    expect(outcome.status).toBe('mocked');
    expect(outcome.transactionHash).toBe('0xfeed');
    expect(outcome.contracts.stream).toBe('0xstream');
    expect(telemetry.record).toHaveBeenCalledWith(
      'rewards.stream.applied',
      expect.objectContaining({ walletId: '0xABC', status: 'mocked' }),
      expect.any(Object)
    );
  });
});
