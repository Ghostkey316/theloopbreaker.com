'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('node-fetch', () => jest.fn());

const mockAuditTrail = jest.fn();
const mockParseWebhook = jest.fn();
const mockInterpret = jest.fn();
const mockEmitSummary = jest.fn();

jest.mock('../../services/telemetryLedger', () => {
  return jest.fn().mockImplementation(() => ({
    auditTrail: mockAuditTrail,
  }));
});

jest.mock('../../services/aiMirrorAgent', () => {
  return jest.fn().mockImplementation(() => ({
    parseWebhook: mockParseWebhook,
    interpretBeliefSignal: mockInterpret,
    emitSummary: mockEmitSummary,
  }));
});

jest.mock('../../config/trustSyncConfig', () => ({
  loadTrustSyncConfig: jest.fn(),
}));

jest.mock('../../codex/ledger', () => ({
  createBeliefProof: jest.fn().mockImplementation(({ payload }) => ({
    hash: `proof-${payload.walletId}`,
  })),
}));

jest.mock('../../services/originFingerprint', () => ({
  createFingerprint: jest.fn().mockImplementation(({ wallet, ens }) => ({
    fingerprint: `${wallet}:${ens || 'none'}`,
    method: 'sha256',
  })),
}));

let loadTrustSyncConfig;
let MultiTierTelemetryLedger;
let AIMirrorAgent;
let createBeliefProof;

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-cli-'));
}

describe('cli actions', () => {
  let originalCwd;
  let tempDir;
  let actions;
  let nodeFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalCwd = process.cwd();
    tempDir = createTempDir();
    process.chdir(tempDir);
    ({ loadTrustSyncConfig } = require('../../config/trustSyncConfig'));
    ({ createBeliefProof } = require('../../codex/ledger'));
    MultiTierTelemetryLedger = require('../../services/telemetryLedger');
    AIMirrorAgent = require('../../services/aiMirrorAgent');
    loadTrustSyncConfig.mockReturnValue({
      telemetry: { baseDir: path.join(tempDir, 'telemetry') },
      verification: { remote: { telemetryEndpoint: null } },
    });
    mockAuditTrail.mockReturnValue([]);
    mockParseWebhook.mockImplementation((payload) => payload);
    mockInterpret.mockReturnValue({ summary: 'ok' });
    mockEmitSummary.mockResolvedValue({});
    jest.isolateModules(() => {
      actions = require('../actions');
      nodeFetch = require('node-fetch');
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(overrides = {}) {
    const configPath = path.join(tempDir, 'partner.json');
    const baseConfig = {
      partnerId: 'demo',
      baseUrl: 'http://localhost:5000',
      role: 'partner',
      walletAddress: '0xABCDEF',
      ensAlias: 'Vaultfire.eth',
      scopes: ['belief:sync'],
      beliefFeedPath: 'beliefs.json',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
    fs.writeFileSync(configPath, JSON.stringify(baseConfig, null, 2));
    return configPath;
  }

  it('initialises config files with defaults and lowercases identity fields', () => {
    const result = actions.initConfig({
      configPath: 'config.json',
      walletAddress: '0xABCDEF',
      ensAlias: 'Example.ETH',
    });

    const stored = JSON.parse(fs.readFileSync(result.path, 'utf8'));
    expect(stored.walletAddress).toBe('0xabcdef');
    expect(stored.ensAlias).toBe('example.eth');
    expect(stored.scopes).toContain('belief:sync');
  });

  it('prevents overwriting config unless overwrite flag is set', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}));
    expect(() => actions.initConfig({ configPath })).toThrow(/already exists/);
    expect(() => actions.initConfig({ configPath, overwrite: true })).not.toThrow();
  });

  it('loads config and normalises wallet + telemetry defaults', () => {
    const configPath = writeConfig({ walletAddress: '0xABC', ensAlias: 'Demo.ETH' });
    const loaded = actions.loadConfig(configPath);
    expect(loaded.walletAddress).toBe('0xabc');
    expect(loaded.identityPolicy.telemetryMode).toBe('wallet-anonymous');
  });

  it('tests remote connection via health endpoint', async () => {
    const configPath = writeConfig({ baseUrl: 'http://vaultfire.partner' });
    nodeFetch.mockImplementation(() =>
      Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    })
    );
    const response = await actions.testConnection({ configPath });
    expect(nodeFetch).toHaveBeenCalledWith('http://vaultfire.partner/health');
    expect(response.body.status).toBe('ok');
  });

  it('pushes beliefs with origin proof and returns response body', async () => {
    const configPath = writeConfig({ walletAddress: '0xDEADBEEF', ensAlias: 'Trust.eth' });
    nodeFetch.mockImplementation(() =>
      Promise.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ accepted: true }),
    })
    );

    const result = await actions.pushBeliefs({
      configPath,
      token: 'jwt',
      wallet: '0xDEADBEEF',
      beliefproof: true,
    });

    expect(nodeFetch).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.proof.hash).toContain('proof-');
    expect(createBeliefProof).toHaveBeenCalled();
  });

  it('summarises mirror payloads using AIMirrorAgent', async () => {
    const configPath = writeConfig();
    const summary = await actions.summarizeMirror({ configPath, inputPath: 'custom.json' });
    expect(MultiTierTelemetryLedger).toHaveBeenCalled();
    expect(AIMirrorAgent).toHaveBeenCalled();
    expect(mockParseWebhook).toHaveBeenCalled();
    expect(mockInterpret).toHaveBeenCalled();
    expect(mockEmitSummary).toHaveBeenCalled();
    expect(summary).toEqual({ summary: 'ok' });
  });

  it('verifies trust sync telemetry and merges remote evaluation', async () => {
    const configPath = writeConfig({ walletAddress: '0xF00', ensAlias: 'Pilot.eth' });
    mockAuditTrail.mockReturnValue([
      {
        eventType: 'mirror.summary.generated',
        timestamp: '2025-01-01T00:00:00.000Z',
        payload: { walletId: '0xf00', beliefScore: 0.7 },
      },
      {
        eventType: 'belief.reward.queued',
        timestamp: '2025-01-03T00:00:00.000Z',
        payload: { walletId: '0xf00', beliefScore: 0.9 },
      },
    ]);

    loadTrustSyncConfig.mockReturnValue({
      telemetry: { baseDir: path.join(tempDir, 'telemetry') },
      verification: {
        remote: {
          telemetryEndpoint: 'https://remote.example/telemetry',
          allowFallback: true,
        },
      },
    });

    nodeFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            entries: [
              {
                eventType: 'mirror.summary.generated',
                timestamp: '2025-01-01T00:00:00.000Z',
                payload: { walletId: '0xf00', beliefScore: 0.7 },
              },
              {
                eventType: 'belief.reward.queued',
                timestamp: '2025-01-03T00:00:00.000Z',
                payload: { walletId: '0xf00', beliefScore: 0.9 },
              },
            ],
            signature: null,
            timestamp: '2025-01-03T00:00:00.000Z',
          }),
      })
    );

    const result = await actions.verifyTrustSync({ configPath, includeHistory: true });
    expect(result.status).toBe('READY');
    expect(result.timeline).toHaveLength(2);
    expect(result.remoteTelemetry.status).toBe('verified');
    expect(result.warnings.length).toBe(0);
  });

  it('bubbles remote telemetry errors when fallback disabled', async () => {
    const configPath = writeConfig({ walletAddress: '0xF01' });
    mockAuditTrail.mockReturnValue([]);
    loadTrustSyncConfig.mockReturnValue({
      telemetry: {},
      verification: {
        remote: { telemetryEndpoint: 'https://bad.example', allowFallback: false },
      },
    });
    nodeFetch.mockImplementation(() => Promise.reject(new Error('network down')));
    await expect(actions.verifyTrustSync({ configPath })).rejects.toThrow(/Remote telemetry request failed/);
  });
});
