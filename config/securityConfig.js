const fs = require('fs');
const path = require('path');

const DEFAULT_SECURITY_CONFIG = {
  cors: {
    allowedOrigins: [
      'https://vaultfire.app',
      'https://partners.vaultfire.app',
      'https://vaultfire-staging.web.app',
      'http://localhost:4050',
      'http://localhost:5173',
    ],
    allowedDomains: ['vaultfire.app', 'vaultfire-staging.web.app', 'partners.vaultfire.app', 'localhost'],
  },
  telemetry: {
    signatureChannel: 'security',
    rotationChannel: 'security.rotation',
  },
  verification: {
    rotationGraceDays: 14,
    allowLegacyHandshake: false,
    secrets: [
      {
        id: '2024-q2',
        value: 'vaultfire-rotation-q2',
        activeFrom: '2024-04-01T00:00:00.000Z',
        expiresAt: '2024-07-01T00:00:00.000Z',
      },
      {
        id: '2024-q3',
        value: 'vaultfire-rotation-q3',
        activeFrom: '2024-07-01T00:00:00.000Z',
        expiresAt: '2024-10-01T00:00:00.000Z',
      },
    ],
  },
  walletKeys: {
    rotationIntervalDays: 45,
    lastRotatedAt: null,
  },
  sandbox: {
    mode: 'sandbox',
    testEnsProfiles: [
      {
        ens: 'auditpartner.eth',
        wallet: '0x1111111111111111111111111111111111111111',
        note: 'Default sandbox auditor profile',
      },
      {
        ens: 'vaultramp.eth',
        wallet: '0x2222222222222222222222222222222222222222',
        note: 'Rotating ENS identity for contract testing',
      },
    ],
  },
};

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function loadExternalConfig() {
  const configPath = process.env.VAULTFIRE_SECURITY_CONFIG || path.join(__dirname, '..', 'vaultfire_security.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse security config, using defaults:', error.message);
    return {};
  }
}

function mergeConfig(base, override) {
  if (!override || typeof override !== 'object') {
    return base;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = mergeConfig(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function loadSecurityConfig() {
  const merged = mergeConfig(DEFAULT_SECURITY_CONFIG, loadExternalConfig());

  if (process.env.VAULTFIRE_ALLOWED_ORIGINS) {
    merged.cors.allowedOrigins = parseList(process.env.VAULTFIRE_ALLOWED_ORIGINS);
  }
  if (process.env.VAULTFIRE_ALLOWED_DOMAINS) {
    merged.cors.allowedDomains = parseList(process.env.VAULTFIRE_ALLOWED_DOMAINS);
  }
  if (process.env.VAULTFIRE_SANDBOX_MODE) {
    merged.sandbox = merged.sandbox || {};
    merged.sandbox.mode = process.env.VAULTFIRE_SANDBOX_MODE;
  }
  if (process.env.VAULTFIRE_TEST_ENS) {
    merged.sandbox = merged.sandbox || {};
    merged.sandbox.testEnsProfiles = parseList(process.env.VAULTFIRE_TEST_ENS).map((ens) => ({
      ens,
      wallet: null,
      note: 'Env configured auditor identity',
    }));
  }
  if (process.env.VAULTFIRE_VERIFICATION_SECRETS) {
    try {
      const parsed = JSON.parse(process.env.VAULTFIRE_VERIFICATION_SECRETS);
      if (Array.isArray(parsed)) {
        merged.verification.secrets = parsed;
      }
    } catch (error) {
      console.warn('Invalid VAULTFIRE_VERIFICATION_SECRETS payload, ignoring.');
    }
  }
  if (process.env.VAULTFIRE_ALLOW_LEGACY_HANDSHAKE !== undefined) {
    merged.verification = merged.verification || {};
    merged.verification.allowLegacyHandshake =
      String(process.env.VAULTFIRE_ALLOW_LEGACY_HANDSHAKE).toLowerCase() === 'true';
  }

  return merged;
}

function resolveActiveSecret({ verification }) {
  const now = Date.now();
  const secrets = verification?.secrets || [];
  if (!secrets.length) {
    return { current: null, previous: [], upcoming: [] };
  }

  let current = secrets[0];
  const previous = [];
  const upcoming = [];
  for (const secret of secrets) {
    const activeFrom = Date.parse(secret.activeFrom);
    const expiresAt = Date.parse(secret.expiresAt);
    if (Number.isFinite(activeFrom) && Number.isFinite(expiresAt)) {
      if (now >= activeFrom && now < expiresAt) {
        current = secret;
      } else if (now >= expiresAt) {
        previous.push(secret);
      } else if (now < activeFrom) {
        upcoming.push(secret);
      }
    }
  }

  previous.sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt));
  upcoming.sort((a, b) => Date.parse(a.activeFrom) - Date.parse(b.activeFrom));
  return { current, previous, upcoming };
}

function isOriginAllowed(config, origin) {
  if (!origin) return false;
  return config.cors.allowedOrigins.some((allowed) => allowed === '*' || allowed === origin.trim());
}

function extractDomain(value) {
  try {
    const { hostname } = new URL(value);
    return hostname;
  } catch (error) {
    return value;
  }
}

function isDomainAllowed(config, domain) {
  if (!domain) return false;
  const value = domain.toLowerCase();
  return config.cors.allowedDomains.some((allowed) => value.endsWith(allowed.toLowerCase()));
}

module.exports = {
  loadSecurityConfig,
  resolveActiveSecret,
  isOriginAllowed,
  isDomainAllowed,
  DEFAULT_SECURITY_CONFIG,
};
