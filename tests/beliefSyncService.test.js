const BeliefSyncService = require('../beliefSyncService');
const { ethers } = require('ethers');

describe('BeliefSyncService', () => {
  test('validates trust and orchestrates routing/delivery', async () => {
    const now = Date.now();
    const wallet = ethers.Wallet.createRandom();
    const payload = { action: 'share-belief', id: 'belief-7' };
    const message = JSON.stringify(payload, Object.keys(payload).sort());
    const signature = await wallet.signMessage(message);
    const session = { issuedAt: now - 1000, expiresAt: now + 60_000, id: 'session-xyz' };

    const router = {
      route: jest.fn().mockResolvedValue({ status: 'success' }),
      inspectSoftFails: jest.fn().mockReturnValue([]),
    };
    const deliveryService = {
      deliver: jest.fn().mockResolvedValue({ status: 'success' }),
      drainSoftFailQueue: jest.fn().mockReturnValue([]),
    };

    const service = new BeliefSyncService({
      router,
      deliveryService,
      trust: {
        allowedOrigins: ['https://vaultfire.app'],
        sessionWindowMs: 120000,
        clock: () => now,
      },
    });

    const result = await service.sync({
      origin: 'https://vaultfire.app',
      address: wallet.address,
      sessionToken: session,
      signature,
      payload,
      route: { target: 'https://remote.node/sync', id: 'belief-7', softFailDelayMs: 5000 },
      delivery: { url: 'https://partner/hooks', headers: { 'X-Test': 'yes' }, softFailDelayMs: 3000 },
    });

    expect(result.trust.address).toBe(wallet.address);
    expect(router.route).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'https://remote.node/sync' }),
      expect.objectContaining({ softFailDelayMs: 5000 }),
    );
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://partner/hooks' }),
      expect.objectContaining({ softFailDelayMs: 3000 }),
    );
  });

  test('combines soft fail queues', () => {
    const router = {
      route: jest.fn(),
      inspectSoftFails: jest.fn().mockReturnValue([{ key: 'router', entries: [] }]),
    };
    const delivery = {
      deliver: jest.fn(),
      drainSoftFailQueue: jest.fn().mockReturnValue([{ url: 'https://retry', scheduledAt: Date.now() }]),
    };
    const service = new BeliefSyncService({ router, deliveryService: delivery, trust: { allowedOrigins: ['*'] } });

    const snapshot = service.inspectSoftFails();
    expect(snapshot.router).toEqual([{ key: 'router', entries: [] }]);
    expect(snapshot.delivery).toHaveLength(1);
  });
});
