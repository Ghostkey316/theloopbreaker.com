const fs = require('fs');
const os = require('os');
const path = require('path');

const MultiTierTelemetryLedger = require('../services/telemetryLedger');
const SecurityPostureManager = require('../services/securityPosture');

describe('Handshake telemetry integration', () => {
  test('failed handshakes are recorded and persisted', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-handshake-'));
    const ledger = new MultiTierTelemetryLedger({
      baseDir,
      persistence: { type: 'json', json: { baseDir, fileName: 'handshake.jsonl' } },
    });

    const manager = new SecurityPostureManager({ telemetry: ledger });

    expect(() =>
      manager.assertHandshakeSecret({ nonce: 'n', timestamp: Date.now().toString(), digest: 'invalid' }, {
        wallet: '0x123',
      })
    ).toThrow('Handshake secret invalid or expired');

    await new Promise((resolve) => setImmediate(resolve));
    const ethicsLog = ledger.readChannel('ethics');
    const failedEvent = ethicsLog.find((entry) => entry.eventType === 'security.signature.failed');
    expect(failedEvent).toBeTruthy();
    await ledger.flushExternal();
    const persisted = fs
      .readFileSync(path.join(baseDir, 'handshake.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(persisted.some((record) => record.eventType === 'security.signature.failed')).toBe(true);
  });
});
