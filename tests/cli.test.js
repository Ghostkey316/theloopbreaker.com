const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');

const {
  initConfig,
  loadConfig,
  testConnection,
  pushBeliefs,
  summarizeMirror,
  verifyTrustSync,
} = require('../cli/actions');
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');

jest.mock('node-fetch');

describe('vaultfire CLI actions', () => {
  let cwd;
  let tempDir;

  beforeEach(() => {
    cwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-cli-'));
    process.chdir(tempDir);
    fetch.resetMocks();
    process.env.VAULTFIRE_RC_PATH = path.join(tempDir, 'vaultfirerc.test.json');
    const telemetryBaseDir = path.join(tempDir, 'telemetry-logs');
    fs.mkdirSync(telemetryBaseDir, { recursive: true });
    const rcConfig = {
      trustSync: {
        telemetry: {
          baseDir: telemetryBaseDir,
          fallback: { enabled: false },
        },
        verification: {
          remote: {
            telemetryEndpoint: 'https://telemetry.vaultfire.test/logs',
            telemetryApiKey: 'test-telemetry-key',
            allowFallback: true,
          },
        },
      },
    };
    fs.writeFileSync(process.env.VAULTFIRE_RC_PATH, JSON.stringify(rcConfig, null, 2));
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.VAULTFIRE_RC_PATH;
  });

  it('initializes partner config scaffolding', () => {
    const result = initConfig();
    expect(fs.existsSync(result.path)).toBe(true);
    const config = loadConfig();
    expect(config.partnerId).toBe('demo-partner');
    expect(config.scopes).toContain('belief:sync');
  });

  it('tests connectivity against the health endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    initConfig();
    const outcome = await testConnection();
    expect(outcome.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4002/health');
  });

  it('pushes beliefs to the mirror endpoint', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ status: 'mirroring' }) });
    initConfig();
    const result = await pushBeliefs({ token: 'demo-token' });
    expect(result.status).toBe(202);
    expect(fetch).toHaveBeenLastCalledWith('http://localhost:4002/vaultfire/mirror', expect.any(Object));
  });

  it('summarizes belief payloads using the mirror agent', async () => {
    initConfig();
    const summary = await summarizeMirror();
    expect(summary.recommendedAction).toBeDefined();
    expect(summary.walletId).toBeDefined();
  });

  it('verifies trust sync using remote telemetry mirrors', async () => {
    const { config } = initConfig();
    const trustConfig = loadTrustSyncConfig();
    const ledger = new MultiTierTelemetryLedger(trustConfig.telemetry);
    const wallet = config.walletAddress;

    ledger.record(
      'identity.anchor.linked',
      { walletId: wallet, beliefScore: 0.82, ensAlias: 'demo.eth' },
      { visibility: { partner: true, ethics: true, audit: true } }
    );
    const auditTrail = ledger.auditTrail();
    const remoteEntries = auditTrail
      .filter((entry) => entry.payload?.walletId === wallet)
      .map((entry) => ({
        hash: entry.hash,
        eventType: entry.eventType,
        timestamp: entry.timestamp,
        payload: entry.payload,
      }));
    const signature = crypto
      .createHash('sha256')
      .update(remoteEntries.map((entry) => entry.hash).sort().join(':'))
      .digest('hex');

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        entries: remoteEntries,
        signature,
        signer: 'verifier',
        timestamp: new Date().toISOString(),
      }),
    });

    const result = await verifyTrustSync({ wallet, includeHistory: true });
    expect(result.remoteTelemetry.status).toBe('verified');
    expect(result.remoteTelemetry.signature).toBe(signature);
    expect(result.localDigest).toBe(signature);
    expect(result.warnings).toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`wallet=${encodeURIComponent(wallet)}`),
      expect.any(Object)
    );
  });

  it('flags mismatched remote telemetry as warnings', async () => {
    const { config } = initConfig();
    const trustConfig = loadTrustSyncConfig();
    const ledger = new MultiTierTelemetryLedger(trustConfig.telemetry);
    const wallet = config.walletAddress;

    ledger.record(
      'identity.anchor.linked',
      { walletId: wallet, beliefScore: 0.92 },
      { visibility: { partner: true, ethics: true, audit: true } }
    );
    const auditTrail = ledger.auditTrail();
    const remoteEntries = auditTrail.map((entry) => ({ hash: entry.hash, eventType: entry.eventType, timestamp: entry.timestamp }));
    const badEntries = remoteEntries.concat({ hash: '0xdeadbeef', eventType: 'tampered', timestamp: new Date().toISOString() });
    const signature = crypto
      .createHash('sha256')
      .update(remoteEntries.map((entry) => entry.hash).sort().join(':'))
      .digest('hex');

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ entries: badEntries, signature, signer: 'verifier' }),
    });

    const result = await verifyTrustSync({ wallet });
    expect(result.remoteTelemetry.status).toBe('mismatch');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
