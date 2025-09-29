const fs = require('fs');
const os = require('os');
const path = require('path');

const { BeliefSyncEngine } = require('../belief_sync_engine');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'belief-sync-'));
  const logPath = path.join(dir, 'fork_log.json');
  fs.writeFileSync(logPath, '[]', 'utf8');
  const originalLogPath = path.join(__dirname, '..', 'fork_log.json');
  const originalContent = fs.existsSync(originalLogPath) ? fs.readFileSync(originalLogPath, 'utf8') : '[]';
  fs.writeFileSync(originalLogPath, '[]', 'utf8');
  try {
    fn();
  } finally {
    fs.writeFileSync(originalLogPath, originalContent, 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('belief sync emits events and captures origin fingerprint', () => {
  withTempDir(() => {
    const a = new BeliefSyncEngine('session-a', '0xabc');
    const b = new BeliefSyncEngine('session-a', '0xdef');
    let received = null;
    b.on('sync', event => {
      received = event;
    });
    const result = a.syncChoice('fork-1', 'YES', { originEns: 'belief.eth' });

    expect(received).not.toBeNull();
    expect(received.choice).toBe('YES');
    expect(received.origin).toMatchObject({ ens: 'belief.eth', wallet: '0xabc' });
    expect(received.origin.fingerprint).toHaveLength(64);
    expect(result.origin.fingerprint).toBe(received.origin.fingerprint);

    const logPath = path.join(__dirname, '..', 'fork_log.json');
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    expect(log).toHaveLength(1);
    expect(log[0].origin.ens).toBe('belief.eth');
  });
});
*** End of File
