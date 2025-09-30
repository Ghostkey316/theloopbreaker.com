const fs = require('fs');
const path = require('path');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');

describe('Multi-tier telemetry ledger', () => {
  const baseDir = path.join(__dirname, '..', 'logs', 'telemetry-unit');

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('writes partner, ethics and audit records with chained hashes', () => {
    const ledger = new MultiTierTelemetryLedger({ baseDir });
    const entry = ledger.record('test.event', { demo: true });
    expect(entry.id).toBeDefined();

    const partner = ledger.readChannel('partner');
    const ethics = ledger.readChannel('ethics');
    const audit = ledger.auditTrail();

    expect(partner).toHaveLength(1);
    expect(ethics).toHaveLength(1);
    expect(audit).toHaveLength(1);
    expect(audit[0].prev).toBeNull();

    const second = ledger.record('test.event.two', { demo: false });
    const auditTrail = ledger.auditTrail();
    expect(auditTrail[1].prev).toBe(auditTrail[0].hash);
    expect(auditTrail[1].hash).not.toBe(auditTrail[0].hash);
    expect(second.id).not.toBe(entry.id);

    const reloaded = new MultiTierTelemetryLedger({ baseDir });
    expect(reloaded.auditTrail()).toHaveLength(2);
  });

  it('handles empty channels and unknown lookups', () => {
    const ledger = new MultiTierTelemetryLedger({ baseDir });
    expect(ledger.auditTrail()).toEqual([]);
    expect(ledger.readChannel('partner')).toEqual([]);
    expect(() => ledger.readChannel('unknown')).toThrow('Unknown telemetry channel');
  });

  it('streams entries to external sinks', async () => {
    const putObject = jest.fn().mockResolvedValue({});
    const handler = jest.fn();
    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      sinks: [
        { type: 's3', client: { putObject }, bucket: 'test-bucket', prefix: 'telemetry/' },
        { type: 'custom', handler },
      ],
    });

    ledger.record('telemetry.event', { ok: true });
    await ledger.flushExternal();

    expect(putObject).toHaveBeenCalledTimes(1);
    const [{ Body }] = putObject.mock.calls[0];
    expect(JSON.parse(Body).eventType).toBe('telemetry.event');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'telemetry.event' }));
  });

  it('persists records to a postgres adapter when configured', async () => {
    const query = jest.fn().mockResolvedValue({});
    const connect = jest.fn().mockResolvedValue({});
    const end = jest.fn().mockResolvedValue({});
    const clientFactory = async () => ({ query, connect, end });
    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: { type: 'postgres', clientFactory, tableName: 'telemetry_test' },
    });

    const entry = ledger.record('postgres.event', { ok: true }, { visibility: { partner: true } });
    await new Promise((resolve) => setImmediate(resolve));
    await ledger.flushExternal();

    expect(connect).toHaveBeenCalled();
    const insertCall = query.mock.calls.find(([statement]) => statement.includes('INSERT INTO telemetry_test'));
    expect(insertCall).toBeDefined();
    expect(insertCall[1][0]).toBe(entry.id);
  });

  it('persists records to a supabase adapter when configured', async () => {
    const insert = jest.fn().mockResolvedValue({ data: [{}], error: null });
    const from = jest.fn().mockReturnValue({ insert });
    const clientFactory = async () => ({ from });
    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: { type: 'supabase', clientFactory, tableName: 'telemetry_test' },
    });

    ledger.record('supabase.event', { ok: true });
    await new Promise((resolve) => setImmediate(resolve));

    expect(from).toHaveBeenCalledWith('telemetry_test');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), event_type: 'supabase.event' })
    );
  });
});
