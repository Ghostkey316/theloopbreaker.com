const fs = require('fs');
const path = require('path');

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
};

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
  const customPath = process.env.VAULTFIRE_RC_PATH || path.join(__dirname, '..', 'vaultfirerc.json');
  let fileConfig = {};
  if (fs.existsSync(customPath)) {
    try {
      const raw = fs.readFileSync(customPath, 'utf8');
      fileConfig = JSON.parse(raw);
    } catch (error) {
      console.warn('Unable to parse vaultfirerc.json, falling back to defaults:', error.message);
    }
  }

  const merged = mergeConfig(DEFAULT_CONFIG, fileConfig.trustSync || fileConfig);
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
  return merged;
}

module.exports = { loadTrustSyncConfig };
