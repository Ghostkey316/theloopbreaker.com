'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const logPath = path.join(projectRoot, 'fork_log.json');
const nodesPath = path.join(projectRoot, 'partner_port', 'external_nodes.json');
const relayDir = path.join(projectRoot, 'logs', 'partner_relays');
const retryPath = path.join(relayDir, 'retry-schedule.json');

let capturedFallback;
let mockRetry;

jest.mock('../../services/signalRelay', () => ({
  createSignalRelay: jest.fn((options) => {
    capturedFallback = options.fallbackWriter;
    mockRetry = jest.fn().mockResolvedValue({ attempted: 2, retried: 1 });
    return {
      dispatch: jest.fn().mockImplementation(async (node, payload) => {
        if (options.fallbackWriter) {
          options.fallbackWriter(node, payload);
        }
      }),
      retry: mockRetry,
    };
  }),
}));

jest.mock('../../services/retryRelayHandler', () => ({
  RetryRelayHandler: jest.fn(() => ({ run: jest.fn() })),
}));

describe('belief sync engine extended behaviours', () => {
  let backups;
  let BeliefSyncEngine;

  function backup(file) {
    if (fs.existsSync(file)) {
      backups.set(file, fs.readFileSync(file));
    } else {
      backups.set(file, null);
    }
  }

  function restore(file) {
    if (!backups.has(file)) {
      return;
    }
    const original = backups.get(file);
    if (original === null) {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true });
      }
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, original);
    }
  }

  beforeEach(() => {
    jest.resetModules();
    backups = new Map();
    fs.mkdirSync(path.dirname(nodesPath), { recursive: true });
    fs.mkdirSync(relayDir, { recursive: true });
    backup(logPath);
    backup(nodesPath);
    backup(retryPath);
    fs.writeFileSync(logPath, '[]');
    fs.writeFileSync(nodesPath, '[]');
    fs.writeFileSync(retryPath, '[]');
    ({ BeliefSyncEngine } = require('../../belief_sync_engine'));
  });

  afterEach(() => {
    restore(retryPath);
    restore(nodesPath);
    restore(logPath);
  });

  it('updates existing partner nodes and writes encrypted fallback entries', () => {
    const engine = new BeliefSyncEngine('session-x', 'wallet.alpha');
    const first = engine.registerExternalNode({ id: 'node-1', endpoint: 'https://first', relayKey: 'secret-key' });
    const updated = engine.registerExternalNode({ id: first.id, endpoint: 'https://second', relayKey: 'secret-key' });
    expect(updated.endpoint).toBe('https://second');

    capturedFallback({ id: updated.id, relayKey: 'secret-key' }, { belief: 'sync' });
    const relayFile = path.join(relayDir, `${updated.id}.jsonl`);
    const contents = fs.readFileSync(relayFile, 'utf8').trim().split('\n');
    const record = JSON.parse(contents[contents.length - 1]);
    expect(record.encrypted.mode).toBe('aes-256-gcm');
    expect(record.encrypted.payload).toBeTruthy();
  });

  it('aggregates stats from sync choices and retries queued jobs', async () => {
    const engine = new BeliefSyncEngine('session-y', 'wallet.beta');
    engine.registerExternalNode({ id: 'relay', endpoint: null });
    engine.syncChoice('fork-1', 'alpha');
    engine.syncChoice('fork-1', 'beta');
    engine.syncChoice('fork-1', 'beta');
    const stats = engine.getStats();
    expect(stats.alpha).toBe(1);
    expect(stats.beta).toBe(2);

    const outcome = await engine.processRetryQueue({ now: Date.now(), maxAttempts: 1 });
    expect(mockRetry).toHaveBeenCalled();
    expect(outcome).toEqual({ attempted: 2, retried: 1 });
  });
});
