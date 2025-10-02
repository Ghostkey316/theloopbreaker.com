'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const relayDir = path.join(projectRoot, 'logs', 'partner_relays');
const retryPath = path.join(relayDir, 'retry-schedule.json');

function resetRetryQueue() {
  fs.mkdirSync(relayDir, { recursive: true });
  fs.writeFileSync(retryPath, '[]');
}

describe('belief_sync_engine', () => {
  beforeEach(() => {
    jest.resetModules();
    resetRetryQueue();
  });

  afterEach(() => {
    if (fs.existsSync(retryPath)) {
      fs.rmSync(retryPath, { force: true });
    }
  });

  it('registers external nodes and persists sanitised payloads', async () => {
    const { BeliefSyncEngine } = require('../../belief_sync_engine');
    const engine = new BeliefSyncEngine('session-1', 'ghost-id', { autoArchive: false });
    const registered = await engine.registerExternalNode({ partnerId: 'alpha', endpoint: 'https://example.com', relayKey: 'secret' });
    expect(registered.id).toBeTruthy();
    const stored = await engine.storage.listNodes();
    expect(stored).toHaveLength(1);
    expect(stored[0].endpoint).toBe('https://example.com');
  });

  it('logs sync choices and writes entries to storage', async () => {
    const { BeliefSyncEngine } = require('../../belief_sync_engine');
    const engine = new BeliefSyncEngine('session-2', 'ghost-id', { autoArchive: false });
    await engine.registerExternalNode({ endpoint: null });
    const entry = await engine.syncChoice('fork-1', 'choice-a', { originEns: 'vaultfire.eth' });
    expect(entry.choice).toBe('choice-a');
    const events = await engine.storage.getRecentEvents(5);
    const local = events.find((item) => item.nodeId === 'session:session-2');
    expect(local).toBeDefined();
    const payload = typeof local.payload === 'string' ? JSON.parse(local.payload) : local.payload;
    expect(payload.origin.ens).toBe('vaultfire.eth');
  });

  it('retries queued jobs and reschedules on failure', async () => {
    const retryEntry = [
      {
        id: 'job-1',
        nodeId: 'alpha',
        endpoint: 'https://example.com/hook',
        payload: { hello: 'world' },
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    fs.writeFileSync(retryPath, JSON.stringify(retryEntry));
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const { BeliefSyncEngine } = require('../../belief_sync_engine');
    const engine = new BeliefSyncEngine('session-3', 'ghost-id', { autoArchive: false });
    const outcome = await engine.processRetryQueue({ now: Date.now(), maxAttempts: 3 });
    expect(outcome.attempted).toBe(1);
    const queue = JSON.parse(fs.readFileSync(retryPath, 'utf8'));
    expect(queue[0].attempts).toBe(1);
    expect(new Date(queue[0].nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
    delete global.fetch;
  });
});
