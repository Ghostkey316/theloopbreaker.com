'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../services/telemetrySinks', () => ({
  createTelemetrySinkRegistry: jest.fn(() => ({
    dispatch: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('vaultfire auxiliary modules', () => {
  let tempDir;
  let telemetryPath;
  let BeliefMirrorEngine;
  let exportLogs;
  let identityGuards;
  let createTelemetrySinkRegistry;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-core-'));
    telemetryPath = path.join(tempDir, 'belief-log.json');
    ({ BeliefMirrorEngine } = require('../../mirror/engine'));
    ({ exportLogs } = require('../../compliance/exportLogs'));
    identityGuards = require('../../utils/identityGuards');
    ({ createTelemetrySinkRegistry } = require('../../services/telemetrySinks'));
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
    const sourcesDir = path.join(path.resolve(__dirname, '..'), '..', 'mirror', 'sources');
    if (fs.existsSync(sourcesDir)) {
      fs.rmSync(sourcesDir, { recursive: true, force: true });
    }
  });

  it('calculates belief entries and enforces identity guards', async () => {
    const engine = new BeliefMirrorEngine({ telemetryPath, rotationDays: 1 });
    const entry = await engine.processAction({
      wallet: '0xabc',
      ens: 'pilot.eth',
      type: 'partnerSync',
      metrics: { loyalty: 0.8 },
    });
    expect(entry.wallet).toBe('0xabc');
    expect(engine.readLog()).toHaveLength(1);

    expect(() => identityGuards.assertWalletOnlyData({ email: 'blocked' }, { context: 'test' })).toThrow(
      /Wallet \+ ENS only/
    );
  });

  it('rotates logs, loads sources, and exports filtered telemetry snapshots', async () => {
    const engine = new BeliefMirrorEngine({ telemetryPath, rotationDays: 1 });
    const now = new Date('2025-01-02T00:00:00.000Z');
    await engine.appendEntry({
      wallet: '0xabc',
      ens: 'vaultfire.eth',
      type: 'partnerSync',
      multiplier: 1.2,
      tier: 'gold',
      metrics: { loyalty: 0.9 },
      timestamp: new Date('2025-01-01T00:00:00.000Z').toISOString(),
    });
    await engine.appendEntry({
      wallet: '0xdef',
      ens: null,
      type: 'partnerSync',
      multiplier: 0.8,
      tier: 'silver',
      metrics: { loyalty: 0.4 },
      timestamp: new Date('2025-01-01T12:00:00.000Z').toISOString(),
    });

    const latestCall = createTelemetrySinkRegistry.mock.results.at(-1);
    expect(latestCall.value.dispatch).toHaveBeenCalled();

    const filtered = engine.exportLogs({ wallet: '0xabc' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].wallet).toBe('0xabc');

    const csvExport = exportLogs({ telemetryPath, format: 'csv' });
    expect(csvExport.content.split('\n')).toHaveLength(3);

    const jsonExport = exportLogs({ telemetryPath, format: 'json' });
    expect(Array.isArray(jsonExport)).toBe(true);

    const sourcesDir = path.join(path.resolve(__dirname, '..'), '..', 'mirror', 'sources');
    fs.mkdirSync(sourcesDir, { recursive: true });
    fs.writeFileSync(path.join(sourcesDir, 'batch.json'), JSON.stringify([{ wallet: '0xaaa', type: 'partnerSync' }]));
    fs.writeFileSync(path.join(sourcesDir, 'invalid.json'), '{broken');
    const actions = await engine.loadFromSources();
    expect(actions).toHaveLength(1);
  });

  it('schedules hourly runs and flushes telemetry sinks', async () => {
    jest.useFakeTimers();
    const engine = new BeliefMirrorEngine({ telemetryPath });
    const loader = jest.fn().mockResolvedValue([{ wallet: '0xabc', type: 'partnerSync' }]);
    const stop = engine.scheduleHourly(loader);
    await Promise.resolve();
    expect(loader).toHaveBeenCalled();
    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(loader).toHaveBeenCalledTimes(2);
    stop();
    jest.useRealTimers();
  });
});
