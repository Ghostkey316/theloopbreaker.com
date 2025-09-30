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

function sanitizeContext(context = {}) {
  if (!context || typeof context !== 'object') {
    return {};
  }
  const allowedKeys = ['component', 'severity', 'details', 'metadata', 'tags'];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (context[key] === undefined) {
      continue;
    }
    if (key === 'details' || key === 'metadata') {
      sanitized[key] = Object.fromEntries(
        Object.entries(context[key] || {}).filter(([, value]) => typeof value !== 'string' || value.length <= 512)
      );
      continue;
    }
    sanitized[key] = context[key];
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
  const normalized = normalizeWallet(wallet);
  if (!normalized || !hasConsent(normalized)) {
    return;
  }
  initTelemetry();
  Sentry.withScope((scope) => {
    scope.setUser({ id: normalized });
    scope.setTag('event', eventName);
    const sanitized = sanitizeContext(context);
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
    scope.setFingerprint([eventName, normalized]);
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
