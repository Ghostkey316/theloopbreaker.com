const path = require('path');
const fs = require('fs');
const SignalCompass = require('../services/signalCompass');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');

describe('Signal Compass', () => {
  const baseDir = path.join(__dirname, '..', 'logs', 'telemetry-signal');

  beforeEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('tracks time series, intent frequency and ethics triggers', () => {
    const ledger = new MultiTierTelemetryLedger({ baseDir });
    const compass = new SignalCompass({ telemetry: ledger, retentionLimit: 10 });
    const snapshot = compass.recordPayload({
      walletId: '0xabc1',
      ensAlias: 'partner.eth',
      beliefScore: 0.9,
      intents: ['align', 'reward'],
      ethicsFlags: ['consent:verified'],
    });

    expect(snapshot.incoming[0].walletId).toBe('0xabc1');
    expect(snapshot.incoming[0].ensAlias).toBe('partner.eth');
    expect(snapshot.timeSeries).toHaveLength(1);
    expect(snapshot.intentFrequency[0]).toEqual({ intent: 'align', count: 1 });
    expect(snapshot.ethicsTriggers[0]).toMatchObject({ flag: 'consent:verified', ensAlias: 'partner.eth' });
  });
});
