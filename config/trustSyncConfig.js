const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  identityStore: {
    provider: 'memory',
  },
  telemetry: {
    baseDir: path.join(__dirname, '..', 'logs', 'telemetry'),
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
  return merged;
}

module.exports = { loadTrustSyncConfig };
