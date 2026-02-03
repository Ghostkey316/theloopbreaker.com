const Sentry = require('@sentry/node');
const { hasOptIn, setOptIn, normalizeWallet } = require('./nodeConsentStore');
const { createResidencyGuard } = require('./residencyGuard');
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');

const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};
const isBrowserRuntime = typeof window !== 'undefined';

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const processEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};

const TELEMETRY_EVENT_SCHEMA = Object.freeze({
  'belief.vote.cast': {
    allowedContextKeys: ['component', 'severity', 'metadata', 'tags'],
    allowedMetadataKeys: ['resonanceBucket', 'pilotId', 'voteSource', 'clientVersion'],
    allowedTagKeys: ['network', 'scope', 'module', 'pilot', 'stage'],
  },
  'dashboard.render': {
    allowedContextKeys: ['component', 'metadata', 'tags'],
    allowedMetadataKeys: ['dashboardVersion', 'widgetCount'],
    allowedTagKeys: ['route', 'pilot', 'scope', 'environment'],
  },
  'wallet.login.result': {
    allowedContextKeys: ['component', 'severity', 'metadata', 'tags'],
    allowedMetadataKeys: ['result', 'failureCode', 'latencyMs'],
    allowedTagKeys: ['surface', 'pilot', 'method'],
  },
  'telemetry.opt_in': {
    allowedContextKeys: ['metadata', 'tags'],
    allowedMetadataKeys: ['status', 'surface'],
    allowedTagKeys: ['pilot', 'scope'],
  },
});

const FORBIDDEN_CONTEXT_KEY_FRAGMENTS = [
  'email',
  'full_name',
  'fullname',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'phone',
  'address',
  'privatekey',
  'secret',
  'token',
  'mnemonic',
  'seed',
  'password',
  'ssn',
  'dob',
  'passport',
  'api_key',
  'apikey',
];

function keyIsAllowed(key) {
  if (!key) {
    return false;
  }
  const lower = String(key).toLowerCase();
  return !FORBIDDEN_CONTEXT_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function sanitizeNestedObject(source, allowedKeys) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const entries = Object.entries(source).filter(([key, value]) => {
    if (!keyIsAllowed(key)) {
      return false;
    }
    if (allowedKeys && !allowedKeys.includes(key)) {
      return false;
    }
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      if (value.length === 0 || value.length > 512) {
        return false;
      }
      return true;
    }
    return typeof value === 'number' || typeof value === 'boolean';
  });
  if (!entries.length) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function isMobileModeActive() {
  if (isBrowserRuntime) {
    return true;
  }
  if (globalScope.__VAULTFIRE_MOBILE_MODE) {
    return true;
  }
  return toBoolean(processEnv.MOBILE_MODE, false);
}

let initialized = false;
let configuration = {
  dsn: processEnv.VAULTFIRE_SENTRY_DSN || null,
  environment: processEnv.NODE_ENV || 'development',
  storePath: processEnv.VAULTFIRE_TELEMETRY_STORE,
  residency: null,
};

let residencyGuard = createResidencyGuard();

function applyResidency(options = {}) {
  if (!options || typeof options !== 'object') {
    residencyGuard = createResidencyGuard();
    return;
  }
  residencyGuard = createResidencyGuard(options);
}

function sanitizeContext(eventName, context = {}) {
  if (!context || typeof context !== 'object') {
    return {};
  }
  const schema = TELEMETRY_EVENT_SCHEMA[eventName];
  if (!schema) {
    return {};
  }
  const allowedKeys = schema.allowedContextKeys || [];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (context[key] === undefined) {
      continue;
    }
    if (!keyIsAllowed(key)) {
      continue;
    }
    if (key === 'details' || key === 'metadata') {
      const nested = sanitizeNestedObject(context[key], key === 'metadata' ? schema.allowedMetadataKeys : undefined);
      if (nested) {
        sanitized[key] = nested;
      }
      continue;
    }
    if (key === 'tags') {
      const tags = sanitizeNestedObject(context[key], schema.allowedTagKeys);
      if (tags) {
        sanitized.tags = tags;
      }
      continue;
    }
    const value = context[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string') {
      if (value.length === 0) {
        continue;
      }
      sanitized[key] = value.length > 512 ? value.slice(0, 512) : value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function initTelemetry(options = {}) {
  configuration = {
    ...configuration,
    ...options,
  };
  if (isMobileModeActive()) {
    configuration.mobileMode = true;
    initialized = true;
    return;
  }
  if (configuration.residency) {
    applyResidency(configuration.residency);
  } else {
    try {
      const trustConfig = loadTrustSyncConfig();
      if (trustConfig?.telemetry?.residency) {
        configuration.residency = trustConfig.telemetry.residency;
        applyResidency(configuration.residency);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[telemetry] Unable to load residency configuration:', error.message);
    }
  }
  if (initialized) {
    return;
  }
  const dsn = configuration.dsn || null;
  if (dsn) {
    residencyGuard.ensureEndpointAllowed(dsn, { kind: 'telemetry', label: 'telemetry DSN' });
  }
  Sentry.init({
    dsn: dsn || undefined,
    environment: configuration.environment,
    tracesSampleRate: 0.1,
    autoSessionTracking: false,
  });
  initialized = true;
}

function hasConsent(wallet) {
  return hasOptIn(wallet, { filePath: configuration.storePath });
}

function updateConsent(wallet, enabled) {
  return setOptIn(wallet, enabled, { filePath: configuration.storePath });
}

function trackEvent(eventName, { wallet, ...context } = {}) {
  if (!wallet) {
    return;
  }
  if (isMobileModeActive()) {
    return;
  }
  if (!TELEMETRY_EVENT_SCHEMA[eventName]) {
    // eslint-disable-next-line no-console
    console.warn(`[telemetry] Event "${eventName}" is not allowed by the schema.`);
    return;
  }
  const normalized = normalizeWallet(wallet);
  if (!normalized || !hasConsent(normalized)) {
    return;
  }
  initTelemetry();
  Sentry.withScope((scope) => {
    // Privacy: do not send wallet identifiers to third-party telemetry sinks.
    // Consent gating can still be wallet-based locally, but outbound identity must be ephemeral.
    scope.setUser(null);
    scope.setTag('event', eventName);
    const sanitized = sanitizeContext(eventName, context);
    if (Object.keys(sanitized).length) {
      if (sanitized.tags) {
        Object.entries(sanitized.tags).forEach(([key, value]) => {
          if (value === undefined) {
            return;
          }
          scope.setTag(`ctx_${key}`, value);
        });
      }
      const { tags, ...rest } = sanitized;
      if (Object.keys(rest).length) {
        scope.setContext('details', rest);
      }
    }
    // Avoid stable fingerprinting that links events across time.
    scope.setFingerprint([eventName]);
    Sentry.captureMessage(eventName, 'info');
  });
}

function recordBeliefVote(payload) {
  trackEvent('belief.vote.cast', payload);
}

module.exports = {
  initTelemetry,
  trackEvent,
  recordBeliefVote,
  hasConsent,
  updateConsent,
};
