'use strict';

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
  return toBoolean(processEnv.MOBILE_MODE, false);
}

const { createResidencyGuard } = require('../residencyGuard');

let partnerHookUrl = null;
let customFetch = null;
let residencyGuard = createResidencyGuard();

function applyResidency(options = {}) {
  if (isMobileModeActive()) {
    residencyGuard = createResidencyGuard({ enforce: false });
    return;
  }
  residencyGuard = createResidencyGuard(options);
}

function resolveFetch() {
  if (isBrowserRuntime && typeof globalScope.fetch === 'function') {
    return globalScope.fetch.bind(globalScope);
  }
  if (customFetch) {
    return customFetch;
  }
  // eslint-disable-next-line global-require
  const fetch = require('node-fetch');
  return typeof fetch === 'function' ? fetch : fetch.default;
}

const adapter = {
  init(partnerUrl, options = {}) {
    if (isMobileModeActive()) {
      residencyGuard = createResidencyGuard({ enforce: false });
      partnerHookUrl = null;
      return { partnerHookUrl: null, mobileMode: true };
    }
    if (!partnerUrl && !options.partnerUrl) {
      throw new Error('partner_hook_adapter.init requires a partnerUrl value.');
    }
    if (options.residency) {
      applyResidency(options.residency);
    }
    partnerHookUrl = partnerUrl || options.partnerUrl;
    residencyGuard.ensureEndpointAllowed(partnerHookUrl, { kind: 'partnerHooks', label: 'partner telemetry hook' });
    if (options.fetch) {
      customFetch = options.fetch;
    }
    return { partnerHookUrl };
  },

  configureResidency(options = {}) {
    if (isMobileModeActive()) {
      residencyGuard = createResidencyGuard({ enforce: false });
      return;
    }
    applyResidency(options);
    if (partnerHookUrl) {
      residencyGuard.ensureEndpointAllowed(partnerHookUrl, { kind: 'partnerHooks', label: 'partner telemetry hook' });
    }
  },

  async writeTelemetry(entry = {}) {
    if (isMobileModeActive()) {
      return { skipped: true };
    }
    if (!partnerHookUrl) {
      throw new Error('partner_hook_adapter not initialised. Call init(partnerUrl) first.');
    }
    const fetchImpl = resolveFetch();
    const response = await fetchImpl(partnerHookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      const error = new Error(`Partner hook responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  },
};

module.exports = adapter;
