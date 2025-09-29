const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { ROLES } = require('../auth/roles');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');
const AIMirrorAgent = require('../services/aiMirrorAgent');
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');

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
  return payload;
}

async function pushBeliefs({ configPath, token, wallet, ens } = {}) {
  const config = loadConfig(configPath);
  const sessionWallet = (wallet || config.walletAddress || '').toLowerCase();
  if (!sessionWallet) {
    throw new Error('Wallet identity is required to push beliefs.');
  }
  const sessionEns =
    ens !== undefined ? (ens ? ens.toLowerCase() : null) : config.ensAlias;
  const payload = ensureBeliefPayload(config, undefined, { wallet: sessionWallet, ens: sessionEns });
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
  return { ok: response.ok, status: response.status, body };
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

module.exports = {
  CONFIG_FILE,
  initConfig,
  loadConfig,
  testConnection,
  pushBeliefs,
  summarizeMirror,
};
