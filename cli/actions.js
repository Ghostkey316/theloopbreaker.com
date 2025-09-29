const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { ROLES } = require('../auth/roles');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');
const AIMirrorAgent = require('../services/aiMirrorAgent');
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');
const { createBeliefProof } = require('../codex/ledger');
const { createFingerprint } = require('../services/originFingerprint');

const CONFIG_FILE = 'vaultfire.partner.config.json';
const DEFAULT_WALLET = '0x0000000000000000000000000000000000000001';

function resolveConfigPath(customPath) {
  return path.resolve(process.cwd(), customPath || CONFIG_FILE);
}

function initConfig({
  configPath,
  overwrite = false,
  partnerId = 'demo-partner',
  baseUrl = 'http://localhost:4002',
  role = ROLES.PARTNER,
  walletAddress = DEFAULT_WALLET,
  ensAlias = null,
} = {}) {
  const resolvedPath = resolveConfigPath(configPath);
  if (!overwrite && fs.existsSync(resolvedPath)) {
    throw new Error(`Config file already exists at ${resolvedPath}. Use --overwrite to replace it.`);
  }

  const config = {
    partnerId,
    baseUrl,
    role,
    walletAddress: walletAddress.toLowerCase(),
    ensAlias: ensAlias ? ensAlias.toLowerCase() : null,
    scopes: ['activation:trigger', 'rewards:read', 'belief:sync'],
    beliefFeedPath: 'vaultfire-beliefs.json',
    identityPolicy: {
      useWalletAsIdentity: true,
      rejectExternalID: true,
      pseudonymousMode: 'always',
      telemetryMode: 'wallet-anonymous',
    },
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(resolvedPath, JSON.stringify(config, null, 2));
  return { config, path: resolvedPath };
}

function loadConfig(configPath) {
  const resolvedPath = resolveConfigPath(configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found at ${resolvedPath}. Run \`vaultfire init\` first.`);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const config = JSON.parse(raw);
  config.identityPolicy = config.identityPolicy || {
    useWalletAsIdentity: true,
    rejectExternalID: true,
    pseudonymousMode: 'always',
    telemetryMode: 'wallet-anonymous',
  };
  config.identityPolicy.telemetryMode = config.identityPolicy.telemetryMode || 'wallet-anonymous';
  config.walletAddress = (config.walletAddress || DEFAULT_WALLET).toLowerCase();
  config.ensAlias = config.ensAlias ? config.ensAlias.toLowerCase() : null;
  return config;
}

async function testConnection({ configPath } = {}) {
  const config = loadConfig(configPath);
  const url = new URL('/health', config.baseUrl).toString();
  const response = await fetch(url);
  const body = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function ensureBeliefPayload(config, overridePath, identityOverrides = {}) {
  const beliefPath = path.resolve(process.cwd(), overridePath || config.beliefFeedPath);
  const sessionWallet = (identityOverrides.wallet || config.walletAddress || DEFAULT_WALLET).toLowerCase();
  const rawEns =
    identityOverrides.ens !== undefined ? identityOverrides.ens : config.ensAlias || null;
  const sessionEns = rawEns ? rawEns.toLowerCase() : null;
  if (!fs.existsSync(beliefPath)) {
    const scaffold = {
      walletId: sessionWallet,
      ensAlias: sessionEns,
      beliefScore: 0.82,
      mirroredAt: new Date().toISOString(),
      signals: [
        { signalId: 'demo-signal', weight: 0.64, confidence: 0.91 },
      ],
      consent: {
        tag: 'ethics-first',
        version: '1.0.0',
        attestedAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(beliefPath, JSON.stringify(scaffold, null, 2));
  }

  const payload = JSON.parse(fs.readFileSync(beliefPath, 'utf8'));
  payload.walletId = (identityOverrides.wallet || payload.walletId || config.walletAddress || DEFAULT_WALLET).toLowerCase();
  if (identityOverrides.ens !== undefined) {
    payload.ensAlias = identityOverrides.ens ? identityOverrides.ens.toLowerCase() : null;
  } else if (!payload.ensAlias && sessionEns) {
    payload.ensAlias = sessionEns;
  }
  const origin = createFingerprint({ wallet: payload.walletId, ens: payload.ensAlias });
  payload.originFingerprint = origin.fingerprint;
  return payload;
}

async function pushBeliefs({ configPath, token, wallet, ens, beliefproof = false } = {}) {
  const config = loadConfig(configPath);
  const sessionWallet = (wallet || config.walletAddress || '').toLowerCase();
  if (!sessionWallet) {
    throw new Error('Wallet identity is required to push beliefs.');
  }
  const sessionEns =
    ens !== undefined ? (ens ? ens.toLowerCase() : null) : config.ensAlias;
  const payload = ensureBeliefPayload(config, undefined, { wallet: sessionWallet, ens: sessionEns });
  let proof = null;
  if (beliefproof) {
    proof = createBeliefProof({ payload, wallet: sessionWallet, ens: sessionEns });
    payload.originProof = proof.hash;
  }
  const url = new URL('/vaultfire/mirror', config.baseUrl).toString();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : undefined,
      'X-Vaultfire-Reason': 'belief_sync',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body, proof };
}

async function summarizeMirror({ configPath, inputPath, outputChannel = 'cli' } = {}) {
  const config = loadConfig(configPath);
  const trustConfig = loadTrustSyncConfig();
  const telemetry = new MultiTierTelemetryLedger(trustConfig.telemetry);
  const agent = new AIMirrorAgent({ telemetry, outputChannel });
  const payload = ensureBeliefPayload(config, inputPath, {
    wallet: config.walletAddress,
    ens: config.ensAlias,
  });
  const parsed = agent.parseWebhook(payload);
  const summary = agent.interpretBeliefSignal(parsed);
  await Promise.resolve(agent.emitSummary(summary));
  return summary;
}

const CHECKPOINT_LABELS = {
  'identity.anchor.linked': 'Anchor linked',
  'signal.compass.payload': 'Signal mirrored',
  'mirror.summary.generated': 'Mirror summary',
  'belief.reward.queued': 'Reward queued',
};

function buildTimeline(entries) {
  return entries.map(entry => ({
    checkpoint: CHECKPOINT_LABELS[entry.eventType] || entry.eventType,
    timestamp: entry.timestamp,
    beliefScore: entry.payload?.beliefScore ?? null,
    ensAlias: entry.payload?.ensAlias || entry.payload?.origin?.ens || null,
  }));
}

function computeMaturity(entries) {
  if (!entries.length) {
    return {
      syncEvents: 0,
      syncUptimeHours: 0,
      averageBelief: null,
      maturityScore: 0,
    };
  }
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const first = new Date(sorted[0].timestamp);
  const last = new Date(sorted[sorted.length - 1].timestamp);
  const uptimeHours = Math.max(0, (last.getTime() - first.getTime()) / 36e5);
  const beliefValues = sorted
    .map(entry => entry.payload?.beliefScore)
    .filter(value => typeof value === 'number');
  const averageBelief = beliefValues.length
    ? beliefValues.reduce((acc, value) => acc + value, 0) / beliefValues.length
    : null;
  const uniqueDays = new Set(sorted.map(entry => entry.timestamp.slice(0, 10))).size;
  const maturityScore = Math.min(
    1,
    (averageBelief || 0) * 0.6 + Math.min(uptimeHours / 96, 0.3) + Math.min(uniqueDays / 30, 0.1)
  );
  return {
    syncEvents: entries.length,
    syncUptimeHours: Math.round(uptimeHours * 100) / 100,
    averageBelief: averageBelief !== null ? Math.round(averageBelief * 1000) / 1000 : null,
    maturityScore: Math.round(maturityScore * 1000) / 1000,
    uniqueSyncDays: uniqueDays,
  };
}

function verifyTrustSync({ configPath, wallet, ens, includeHistory = false } = {}) {
  const config = loadConfig(configPath);
  const targetWallet = (wallet || config.walletAddress || '').toLowerCase();
  if (!targetWallet) {
    throw new Error('Wallet identity is required for Trust Sync verification.');
  }
  const targetEns = ens !== undefined ? (ens ? ens.toLowerCase() : null) : config.ensAlias;
  const trustConfig = loadTrustSyncConfig();
  const telemetry = new MultiTierTelemetryLedger(trustConfig.telemetry);
  const auditTrail = telemetry.auditTrail();
  const relevant = auditTrail.filter(entry => {
    const payloadWallet = entry.payload?.walletId || entry.payload?.wallet || entry.payload?.origin?.wallet;
    return payloadWallet ? payloadWallet.toLowerCase() === targetWallet : false;
  });
  const maturity = computeMaturity(relevant);
  const status = maturity.maturityScore >= 0.55 ? 'READY' : 'OBSERVE';
  const timeline = includeHistory ? buildTimeline(relevant) : buildTimeline(relevant.slice(-5));
  return {
    partnerId: config.partnerId,
    wallet: targetWallet,
    ensAlias: targetEns || null,
    status,
    maturity,
    timeline,
  };
}

module.exports = {
  CONFIG_FILE,
  initConfig,
  loadConfig,
  testConnection,
  pushBeliefs,
  summarizeMirror,
  verifyTrustSync,
};
