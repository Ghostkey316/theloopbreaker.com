const Sentry = require('@sentry/node');
const { hasOptIn, setOptIn, normalizeWallet } = require('./nodeConsentStore');

let initialized = false;
let configuration = {
  dsn: process.env.VAULTFIRE_SENTRY_DSN || null,
  environment: process.env.NODE_ENV || 'development',
  storePath: process.env.VAULTFIRE_TELEMETRY_STORE,
};

function initTelemetry(options = {}) {
  configuration = {
    ...configuration,
    ...options,
  };
  if (initialized) {
    return;
  }
  const dsn = configuration.dsn || null;
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
  const normalized = normalizeWallet(wallet);
  if (!normalized || !hasConsent(normalized)) {
    return;
  }
  initTelemetry();
  Sentry.withScope((scope) => {
    scope.setUser({ id: normalized });
    scope.setTag('event', eventName);
    if (context && Object.keys(context).length) {
      scope.setContext('details', context);
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
