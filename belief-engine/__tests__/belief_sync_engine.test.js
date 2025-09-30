'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const logPath = path.join(projectRoot, 'fork_log.json');
const nodesPath = path.join(projectRoot, 'partner_port', 'external_nodes.json');
const relayDir = path.join(projectRoot, 'logs', 'partner_relays');
const retryPath = path.join(relayDir, 'retry-schedule.json');

function backupFile(filePath, backups) {
  if (fs.existsSync(filePath)) {
    backups.set(filePath, fs.readFileSync(filePath));
  } else {
    backups.set(filePath, null);
  }
}

function restoreFile(filePath, backups) {
  if (!backups.has(filePath)) {
    return;
  }
  const original = backups.get(filePath);
  if (original === null) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } else {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, original);
  }
}

describe('belief_sync_engine', () => {
  let backups;

  beforeEach(() => {
    jest.resetModules();
    backups = new Map();
    fs.mkdirSync(path.dirname(nodesPath), { recursive: true });
    fs.mkdirSync(relayDir, { recursive: true });
    backupFile(logPath, backups);
    backupFile(nodesPath, backups);
    backupFile(retryPath, backups);
    fs.writeFileSync(logPath, '[]');
    fs.writeFileSync(nodesPath, '[]');
    fs.writeFileSync(retryPath, '[]');
  });

  afterEach(() => {
    restoreFile(retryPath, backups);
    restoreFile(nodesPath, backups);
    restoreFile(logPath, backups);
  });

  it('registers external nodes and persists sanitised payloads', () => {
    const { BeliefSyncEngine } = require('../../belief_sync_engine');
    const engine = new BeliefSyncEngine('session-1', 'ghost-id');
    const registered = engine.registerExternalNode({ partnerId: 'alpha', endpoint: 'https://example.com', relayKey: 'secret' });
    expect(registered.id).toBeTruthy();
    const stored = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
    expect(stored).toHaveLength(1);
    expect(stored[0].endpoint).toBe('https://example.com');
  });

  it('logs sync choices and writes entries to the fork log', () => {
    const { BeliefSyncEngine } = require('../../belief_sync_engine');
    const engine = new BeliefSyncEngine('session-2', 'ghost-id');
    engine.registerExternalNode({ endpoint: null });
    const entry = engine.syncChoice('fork-1', 'choice-a', { originEns: 'vaultfire.eth' });
    expect(entry.choice).toBe('choice-a');
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    expect(log).toHaveLength(1);
    expect(log[0].origin.ens).toBe('vaultfire.eth');
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
    const engine = new BeliefSyncEngine('session-3', 'ghost-id');
    const outcome = await engine.processRetryQueue({ now: Date.now(), maxAttempts: 3 });
    expect(outcome.attempted).toBe(1);
    const queue = JSON.parse(fs.readFileSync(retryPath, 'utf8'));
    expect(queue[0].attempts).toBe(1);
    expect(new Date(queue[0].nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
    delete global.fetch;
  });
});
