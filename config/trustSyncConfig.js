const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const isBrowserRuntime = typeof window !== 'undefined';
const processEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};

const DEFAULT_CONFIG = {
  useWalletAsIdentity: true,
  rejectExternalID: true,
  pseudonymousMode: 'always',
  telemetryMode: 'wallet-anonymous',
  vaultfire: {
    partnerReady: false,
  },
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
    residency: {
      enforce: true,
      defaultRegion: 'eu-central-1',
      allowLocalhost: false,
      telemetry: {
        'eu-central-1': ['o*.ingest.sentry.io', 'telemetry.eu.vaultfire.xyz'],
        'us-west-2': ['o*.ingest.sentry.io', 'telemetry.us.vaultfire.xyz'],
      },
      partnerHooks: {
        'eu-central-1': ['hooks.eu.vaultfire.xyz', '*.partners.eu.vaultfire.xyz'],
        'us-west-2': ['hooks.us.vaultfire.xyz', '*.partners.us.vaultfire.xyz'],
      },
      globalAllowList: ['telemetry.vaultfire.xyz'],
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
    remote: {
      endpoint: null,
      apiKey: null,
      telemetryEndpoint: null,
      telemetryApiKey: null,
      telemetryHeaders: {},
      allowFallback: true,
    },
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
    hybridCompliance: {
      enabled: false,
      governanceApproved: false,
    },
  },
  deployment: {
    mode: 'simulated',
    defaultMode: 'simulated',
    partnerReady: false,
    advancedSemantics: false,
    hybridCompliance: {
      enabled: false,
      governanceApproved: false,
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
    processEnv.VAULTFIRE_RC_PATH ||
    (processEnv.VAULTFIRE_STARTER_MODE === 'true' || processEnv.VAULTFIRE_STARTER_MODE === '1'
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
  if (processEnv.VAULTFIRE_IDENTITY_PROVIDER) {
    merged.identityStore.provider = processEnv.VAULTFIRE_IDENTITY_PROVIDER;
  }
  if (processEnv.VAULTFIRE_ENCRYPTION_KEY) {
    merged.identityStore.encryptionKey = processEnv.VAULTFIRE_ENCRYPTION_KEY;
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
    processEnv.VAULTFIRE_TELEMETRY_FALLBACK ??
    merged['telemetry-fallback'] ??
    merged.telemetryFallback ??
    merged.telemetry?.fallback?.enabled;
  merged.telemetry.fallback = merged.telemetry.fallback || {};
  merged.telemetry.fallback.enabled = toBoolean(fallbackToggle, false);
  if (!merged.telemetry.fallback.fileName) {
    merged.telemetry.fallback.fileName = 'remote-fallback.jsonl';
  }
  const residencyOverride = merged.telemetry.residency || {};
  merged.telemetry.residency = mergeConfig(DEFAULT_CONFIG.telemetry.residency, residencyOverride);
  if (processEnv.VAULTFIRE_RESIDENCY_REGION) {
    merged.telemetry.residency.defaultRegion = processEnv.VAULTFIRE_RESIDENCY_REGION;
  }
  if (processEnv.VAULTFIRE_RESIDENCY_ENFORCE) {
    merged.telemetry.residency.enforce = toBoolean(processEnv.VAULTFIRE_RESIDENCY_ENFORCE, true);
  }
  if (processEnv.VAULTFIRE_RESIDENCY_ALLOW_LOCAL) {
    merged.telemetry.residency.allowLocalhost = toBoolean(processEnv.VAULTFIRE_RESIDENCY_ALLOW_LOCAL, false);
  }
  const mobileModeActive = isBrowserRuntime || toBoolean(processEnv.MOBILE_MODE, false);
  if (mobileModeActive) {
    merged.telemetry = merged.telemetry || {};
    merged.telemetry.mobileMode = true;
    if (merged.telemetry.residency) {
      merged.telemetry.residency.enforce = false;
    }
    merged.telemetry.allowPartnerWebhooks = false;
    merged.telemetry.dsn = null;
  }
  if (merged.verification && typeof merged.verification === 'object') {
    if (merged.verification.remote && typeof merged.verification.remote === 'object') {
      merged.verification.remote = mergeConfig(DEFAULT_CONFIG.verification.remote, merged.verification.remote);
    } else {
      merged.verification.remote = { ...DEFAULT_CONFIG.verification.remote };
    }
    merged.verification.externalValidationEndpoint =
      merged.verification.externalValidationEndpoint ?? null;
  }
  if (merged.rewards && typeof merged.rewards === 'object') {
    merged.rewards.fallbackMultiplier = Number(merged.rewards.fallbackMultiplier || 1);
    merged.rewards.stream = mergeConfig(DEFAULT_CONFIG.rewards.stream, merged.rewards.stream);
  } else {
    merged.rewards = { ...DEFAULT_CONFIG.rewards };
  }
  merged.rewards.hybridCompliance = mergeConfig(
    DEFAULT_CONFIG.rewards.hybridCompliance,
    merged.rewards.hybridCompliance
  );

  merged.vaultfire = mergeConfig(DEFAULT_CONFIG.vaultfire, fileConfig.vaultfire || merged.vaultfire);
  merged.deployment = mergeConfig(DEFAULT_CONFIG.deployment, merged.deployment || {});
  merged.deployment = mergeConfig(merged.deployment, fileConfig.deployment || {});
  merged.deployment.hybridCompliance = mergeConfig(
    merged.deployment.hybridCompliance,
    merged.rewards.hybridCompliance
  );
  if (merged.vaultfire.partnerReady) {
    merged.deployment.partnerReady = true;
    merged.rewards.hybridCompliance.enabled = true;
  }
  if (merged.deployment.partnerReady && !merged.deployment.mode) {
    merged.deployment.mode = merged.deployment.defaultMode || 'simulated';
  }
  if (merged.deployment.hybridCompliance?.governanceApproved) {
    merged.rewards.hybridCompliance.governanceApproved = true;
  }
  return merged;
}

module.exports = { loadTrustSyncConfig };
