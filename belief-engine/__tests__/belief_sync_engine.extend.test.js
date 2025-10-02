'use strict';

let capturedFallback;
let mockRetry;

jest.mock('../../services/signalRelay', () => ({
  createSignalRelay: jest.fn((options) => {
    capturedFallback = options.fallbackWriter;
    mockRetry = jest.fn().mockResolvedValue({ attempted: 2, retried: 1 });
    return {
      dispatch: jest.fn().mockImplementation(async (node, payload) => {
        if (options.fallbackWriter) {
          await options.fallbackWriter(node, payload, { status: 'scheduled' });
        }
        return { status: 'delivered', attempts: 1 };
      }),
      retry: mockRetry,
    };
  }),
}));

jest.mock('../../services/retryRelayHandler', () => ({
  RetryRelayHandler: jest.fn(() => ({ run: jest.fn() })),
}));

describe('belief sync engine extended behaviours', () => {
  let BeliefSyncEngine;

  beforeEach(() => {
    jest.resetModules();
    ({ BeliefSyncEngine } = require('../../belief_sync_engine'));
  });

  it('updates existing partner nodes and records fallback entries', async () => {
    const engine = new BeliefSyncEngine('session-x', 'wallet.alpha', { autoArchive: false });
    const first = await engine.registerExternalNode({ id: 'node-1', endpoint: 'https://first', relayKey: 'secret-key' });
    const updated = await engine.registerExternalNode({ id: first.id, endpoint: 'https://second', relayKey: 'secret-key' });
    expect(updated.endpoint).toBe('https://second');

    const payload = {
      session_id: 'session-x',
      ghost_id: 'wallet.alpha',
      belief_fork_id: 'fork-42',
      choice: 'gamma',
      origin: { ens: null },
      timestamp: Date.now(),
    };
    await capturedFallback({ id: updated.id, relayKey: 'secret-key' }, payload, { status: 'failed', error: 'network' });
    const events = await engine.storage.getRecentEvents(5);
    const record = events.find((entry) => entry.nodeId === updated.id);
    expect(record).toBeDefined();
    expect(record.status).toBe('failed');
  });

  it('aggregates stats from sync choices and retries queued jobs', async () => {
    const engine = new BeliefSyncEngine('session-y', 'wallet.beta', { autoArchive: false });
    await engine.registerExternalNode({ id: 'relay', endpoint: null });
    await engine.syncChoice('fork-1', 'alpha');
    await engine.syncChoice('fork-1', 'beta');
    await engine.syncChoice('fork-1', 'beta');
    const stats = await engine.getStats();
    expect(stats.alpha).toBe(1);
    expect(stats.beta).toBe(2);

    const outcome = await engine.processRetryQueue({ now: Date.now(), maxAttempts: 1 });
    expect(mockRetry).toHaveBeenCalled();
    expect(outcome).toEqual({ attempted: 2, retried: 1 });
  });
});
