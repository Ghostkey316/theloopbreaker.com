const fs = require('fs');
const path = require('path');
const { BeliefSyncEngine } = require('../belief_sync_engine');

const RELAY_DIR = path.join(__dirname, '..', 'logs', 'partner_relays');
const RETRY_PATH = path.join(RELAY_DIR, 'retry-schedule.json');

describe('BeliefSyncEngine remote relay scheduling', () => {
  beforeEach(() => {
    fs.rmSync(RELAY_DIR, { recursive: true, force: true });
    fetchMock.resetMocks();
  });

  it('schedules retry entries when relay delivery fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const engine = new BeliefSyncEngine('session-1', '0xabcabcabcabcabcabcabcabcabcabcabcabcabca');
    engine.registerExternalNode({ id: 'partner-a', endpoint: 'https://relay.invalid/payload' });

    engine.syncChoice('fork-1', 'choice-a');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fs.existsSync(RETRY_PATH)).toBe(true);
    const schedule = JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8'));
    expect(schedule).toHaveLength(1);
    expect(schedule[0].nodeId).toBe('partner-a');
    expect(schedule[0].attempts).toBe(0);
  });

  it('retries scheduled entries and clears them on success', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const engine = new BeliefSyncEngine('session-2', '0x1234567890123456789012345678901234567890');
    engine.registerExternalNode({ id: 'partner-b', endpoint: 'https://relay.invalid/payload' });

    engine.syncChoice('fork-2', 'choice-b');
    await new Promise((resolve) => setTimeout(resolve, 10));

    let schedule = JSON.parse(fs.readFileSync(RETRY_PATH, 'utf8'));
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
});
