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
});
