const fs = require('fs');
const os = require('os');
const path = require('path');

const MultiTierTelemetryLedger = require('../services/telemetryLedger');

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('Telemetry persistence adapters', () => {
  test('JSON adapter writes entries and supports flush', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-json-'));
    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: { type: 'json', json: { baseDir, fileName: 'entries.jsonl' } },
    });

    const entry = ledger.record('telemetry.json.test', { flag: 'json' });
    await ledger.flushExternal();

    const lines = readLines(path.join(baseDir, 'entries.jsonl'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ id: entry.id, eventType: 'telemetry.json.test' });
  });

  test('Postgres adapter replays backlog after transient failure', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-pg-'));
    let failInsert = true;
    const insertCalls = [];
    const clientFactory = jest.fn(async () => ({
      connect: jest.fn(async () => undefined),
      end: jest.fn(async () => undefined),
      query: jest.fn(async (statement, values) => {
        if (/^\s*insert/i.test(statement)) {
          insertCalls.push(values);
          if (failInsert) {
            failInsert = false;
            const error = new Error('pg-offline');
            error.code = 'ECONNRESET';
            throw error;
          }
        }
        return { rows: [] };
      }),
    }));

    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: {
        type: 'postgres',
        tableName: 'vaultfire_telemetry_test',
        clientFactory,
      },
    });

    ledger.record('telemetry.pg.test', { attempt: 1 });
    await new Promise((resolve) => setImmediate(resolve));

    // First attempt should have failed and been captured in the failover log.
    const fallbackLines = readLines(path.join(baseDir, 'persistence-failover.jsonl'));
    expect(fallbackLines.length).toBeGreaterThanOrEqual(1);
    expect(fallbackLines[0].entry.eventType).toBe('telemetry.pg.test');

    await ledger.flushExternal();
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);
    const lastCall = insertCalls[insertCalls.length - 1];
    expect(lastCall[1]).toBe('telemetry.pg.test');
  });

  test('Supabase adapter bubbles errors and resumes on next flush', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-supa-'));
    let shouldError = true;
    const insertLog = [];
    const clientFactory = jest.fn(async () => ({
      from: () => ({
        insert: async (payload) => {
          insertLog.push(payload);
          if (shouldError) {
            shouldError = false;
            return { error: new Error('service-unavailable') };
          }
          return { data: [{ id: payload.id }] };
        },
      }),
    }));

    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: {
        type: 'supabase',
        tableName: 'vaultfire_telemetry_test',
        clientFactory,
      },
    });

    ledger.record('telemetry.supabase.test', { attempt: 'supabase' });
    await new Promise((resolve) => setImmediate(resolve));

    const fallbackLines = readLines(path.join(baseDir, 'persistence-failover.jsonl'));
    expect(fallbackLines.length).toBeGreaterThanOrEqual(1);

    await ledger.flushExternal();
    expect(insertLog.length).toBe(2);
    expect(insertLog[1].event_type).toBe('telemetry.supabase.test');
  });
});
