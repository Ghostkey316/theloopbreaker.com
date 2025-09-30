const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const DEFAULT_CONFIG = {
  useWalletAsIdentity: true,
  rejectExternalID: true,
  pseudonymousMode: 'always',
  telemetryMode: 'wallet-anonymous',
  identity: {
    useWalletAsIdentity: true,
    rejectExternalID: true,
    pseudonymousMode: 'always',
  },
  telemetry: {
    baseDir: path.join(__dirname, '..', 'logs', 'telemetry'),
    mode: 'wallet-anonymous',
    fallback: {
      enabled: false,
      fileName: 'remote-fallback.jsonl',
    },
  },
  identityStore: {
    provider: 'memory',
  },
  signalCompass: {
    retentionLimit: 200,
  },
  mirror: {
    outputChannel: 'cli',
  },
  verification: {
    remote: null,
    externalValidationEndpoint: null,
  },
  rewards: {
    fallbackMultiplier: 1,
    multiplierAddress: null,
    rewardStreamAddress: null,
    providerUrl: null,
    stream: {
      autoDistribute: false,
    },
  },
};

const STARTER_CONFIG_PATH = path.join(__dirname, '..', 'configs', 'starter-pilot', 'vaultfire-lite.yaml');

function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return YAML.parse(raw);
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Unable to parse ${path.basename(filePath)}, falling back to defaults:`, error.message);
    return {};
  }
}

function mergeConfig(base, override) {
  if (!override) {
    return base;
  }
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      typeof base[key] === 'object' &&
      !Array.isArray(base[key]) &&
      base[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      override[key] !== null
    ) {
      result[key] = mergeConfig(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function loadTrustSyncConfig() {
  const rcPathEnv =
    process.env.VAULTFIRE_RC_PATH ||
    (process.env.VAULTFIRE_STARTER_MODE === 'true' || process.env.VAULTFIRE_STARTER_MODE === '1'
      ? STARTER_CONFIG_PATH
      : null);
  const customPath = rcPathEnv || path.join(__dirname, '..', 'vaultfirerc.json');
  const fileConfig = readConfigFile(customPath);

  const merged = mergeConfig(DEFAULT_CONFIG, fileConfig.trustSync || fileConfig);
  if (fileConfig.modules && !merged.modules) {
    merged.modules = fileConfig.modules;
  }
  if (fileConfig.rewards) {
    merged.rewards = mergeConfig(DEFAULT_CONFIG.rewards, fileConfig.rewards);
  }
  if (process.env.VAULTFIRE_IDENTITY_PROVIDER) {
    merged.identityStore.provider = process.env.VAULTFIRE_IDENTITY_PROVIDER;
  }
  if (process.env.VAULTFIRE_ENCRYPTION_KEY) {
    merged.identityStore.encryptionKey = process.env.VAULTFIRE_ENCRYPTION_KEY;
  }
  merged.identity = merged.identity || {};
  merged.identity.useWalletAsIdentity =
    merged.identity.useWalletAsIdentity ?? merged.useWalletAsIdentity ?? true;
  merged.identity.rejectExternalID = merged.identity.rejectExternalID ?? merged.rejectExternalID ?? true;
  merged.identity.pseudonymousMode = merged.identity.pseudonymousMode ?? merged.pseudonymousMode ?? 'always';
  merged.useWalletAsIdentity = merged.identity.useWalletAsIdentity;
  merged.rejectExternalID = merged.identity.rejectExternalID;
  merged.pseudonymousMode = merged.identity.pseudonymousMode;
  merged.telemetryMode = merged.telemetry?.mode || merged.telemetryMode || 'wallet-anonymous';
  merged.telemetry = merged.telemetry || {};
  const fallbackToggle =
    process.env.VAULTFIRE_TELEMETRY_FALLBACK ??
    merged['telemetry-fallback'] ??
    merged.telemetryFallback ??
    merged.telemetry?.fallback?.enabled;
  merged.telemetry.fallback = merged.telemetry.fallback || {};
  merged.telemetry.fallback.enabled =
    typeof fallbackToggle === 'string'
      ? ['true', '1', 'yes', 'on'].includes(fallbackToggle.toLowerCase())
      : Boolean(fallbackToggle);
  if (!merged.telemetry.fallback.fileName) {
    merged.telemetry.fallback.fileName = 'remote-fallback.jsonl';
  }
  if (merged.verification && typeof merged.verification === 'object') {
    merged.verification.remote = merged.verification.remote || null;
    merged.verification.externalValidationEndpoint =
      merged.verification.externalValidationEndpoint ?? null;
  }
  if (merged.rewards && typeof merged.rewards === 'object') {
    merged.rewards.fallbackMultiplier = Number(merged.rewards.fallbackMultiplier || 1);
    merged.rewards.stream = mergeConfig(DEFAULT_CONFIG.rewards.stream, merged.rewards.stream);
  } else {
    merged.rewards = { ...DEFAULT_CONFIG.rewards };
  }
  return merged;
}

module.exports = { loadTrustSyncConfig };
