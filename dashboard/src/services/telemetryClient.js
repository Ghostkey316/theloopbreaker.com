import * as Sentry from '@sentry/react';

let initialized = false;

function resolveEnv() {
  if (typeof globalThis !== 'undefined' && globalThis.__VAULTFIRE_DASHBOARD_ENV__) {
    return globalThis.__VAULTFIRE_DASHBOARD_ENV__;
  }
  try {
    return (typeof import !== 'undefined' && import.meta?.env) || {};
  } catch (error) {
    return {};
  }
}

const runtimeEnv = resolveEnv();

function consentKey(wallet) {
  return `vaultfire:telemetry:${wallet.toLowerCase()}`;
}

export function initTelemetry(options = {}) {
  if (initialized) {
    return;
  }
  const dsn = options.dsn ?? runtimeEnv.VITE_SENTRY_DSN ?? runtimeEnv.VAULTFIRE_SENTRY_DSN ?? '';
  const environment = options.environment ?? runtimeEnv.MODE ?? runtimeEnv.NODE_ENV ?? 'development';
  Sentry.init({
    dsn: dsn || undefined,
    environment,
    tracesSampleRate: 0.2,
    autoSessionTracking: false,
  });
  initialized = true;
}

export function hasTelemetryConsent(wallet) {
  if (typeof window === 'undefined' || !wallet) {
    return false;
  }
  return Boolean(window.localStorage.getItem(consentKey(wallet)));
}

export function setTelemetryConsent(wallet, enabled) {
  if (typeof window === 'undefined' || !wallet) {
    return;
  }
  const key = consentKey(wallet);
  if (enabled) {
    window.localStorage.setItem(key, '1');
  } else {
    window.localStorage.removeItem(key);
  }
}

export function trackTelemetryEvent(eventName, { wallet, ...context } = {}) {
  if (!wallet || typeof window === 'undefined') {
    return;
  }
  if (!hasTelemetryConsent(wallet)) {
    return;
  }
  initTelemetry();
  const normalizedWallet = wallet.toLowerCase();
  Sentry.withScope((scope) => {
    scope.setUser({ id: normalizedWallet });
    scope.setTag('event', eventName);
    if (context && Object.keys(context).length) {
      scope.setContext('details', context);
    }
    scope.setFingerprint([eventName, normalizedWallet]);
    Sentry.captureMessage(eventName, 'info');
  });
}

export function resetTelemetryForTests() {
  initialized = false;
  if (typeof window !== 'undefined') {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('vaultfire:telemetry:'))
      .forEach((key) => window.localStorage.removeItem(key));
  }
}
