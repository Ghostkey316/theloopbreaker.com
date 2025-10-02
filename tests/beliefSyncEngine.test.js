const fs = require('fs');
const path = require('path');
const { BeliefSyncEngine } = require('../belief_sync_engine');

const RELAY_DIR = path.join(__dirname, '..', 'logs', 'partner_relays');
const RETRY_PATH = path.join(RELAY_DIR, 'retry-schedule.json');

describe('BeliefSyncEngine remote relay scheduling', () => {
  beforeEach(() => {
    fs.rmSync(RELAY_DIR, { recursive: true, force: true });
    fetchMock.resetMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('schedules retry entries when relay delivery fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const engine = new BeliefSyncEngine('session-1', '0xabcabcabcabcabcabcabcabcabcabcabcabcabca', { autoArchive: false });
    await engine.registerExternalNode({ id: 'partner-a', endpoint: 'https://relay.invalid/payload' });

    await engine.syncChoice('fork-1', 'choice-a');
    for (let i = 0; i < 10 && !fs.existsSync(RETRY_PATH); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(fs.existsSync(RETRY_PATH)).toBe(true);
    const schedule = JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8')).filter(
      (entry) => entry.nodeId === 'partner-a'
    );
    expect(schedule).toHaveLength(1);
    expect(schedule[0].nodeId).toBe('partner-a');
    expect(schedule[0].attempts).toBe(engine.signalRelay.retryHandler.maxAttempts);
  });

  it('retries scheduled entries and clears them on success', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const engine = new BeliefSyncEngine('session-2', '0x1234567890123456789012345678901234567890', { autoArchive: false });
    await engine.registerExternalNode({ id: 'partner-b', endpoint: 'https://relay.invalid/payload' });

    await engine.syncChoice('fork-2', 'choice-b');
    for (let i = 0; i < 10 && !fs.existsSync(RETRY_PATH); i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    let schedule = JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8'));
    schedule = schedule.filter((entry) => entry.nodeId === 'partner-b');
    expect(schedule).toHaveLength(1);
    schedule[0].nextAttemptAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(RETRY_PATH, JSON.stringify(schedule, null, 2));

    fetchMock.mockResolvedValueOnce({ ok: true });
    const result = await engine.processRetryQueue({ now: Date.now() });
    expect(result.attempted).toBe(1);
    expect(result.delivered).toBe(1);

    schedule = JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8'));
    expect(schedule).toHaveLength(0);
  });

  afterEach(() => {
    console.warn.mockRestore();
  });
});
