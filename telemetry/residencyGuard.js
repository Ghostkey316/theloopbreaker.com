'use strict';

const isBrowserRuntime = typeof window !== 'undefined';
let NodeURL;

const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

function resolveMobileModeFlag(value) {
  if (value === undefined || value === null) {
    return false;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

const processEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};
function isMobileRuntimeRelaxed(config = {}) {
  // Default: DO NOT relax residency enforcement on mobile/browser.
  // If a deployment explicitly opts into relaxed mode, it must do so via config.
  const relaxOnMobile = Boolean(config.relaxOnMobile);
  if (!relaxOnMobile) {
    return false;
  }
  const mobileModeEnvFlag = resolveMobileModeFlag(processEnv.MOBILE_MODE);
  const mobileRuntimeFlag = Boolean(globalScope.__VAULTFIRE_MOBILE_MODE);
  return isBrowserRuntime || mobileModeEnvFlag || mobileRuntimeFlag;
}

function getUrlCtor() {
  if (isBrowserRuntime && typeof globalScope.URL === 'function') {
    return globalScope.URL;
  }
  if (!NodeURL) {
    ({ URL: NodeURL } = require('url'));
  }
  if (NodeURL) {
    return NodeURL;
  }
  if (typeof globalScope.URL === 'function') {
    return globalScope.URL;
  }
  throw new Error('URL constructor is not available in this environment.');
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizePatterns(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.map((value) => String(value)).filter(Boolean);
  }
  if (typeof input === 'object') {
    return Object.values(input)
      .flat()
      .map((value) => String(value))
      .filter(Boolean);
  }
  return [String(input)];
}

function matchesPattern(host, pattern) {
  if (!pattern) {
    return false;
  }
  if (pattern === '*') {
    return true;
  }
  const normalizedPattern = pattern.trim().toLowerCase();
  const normalizedHost = host.toLowerCase();
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1); // remove leading '*'
    return (
      normalizedHost === normalizedPattern.slice(2) ||
      normalizedHost.endsWith(suffix)
    );
  }
  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(host);
  }
  return normalizedHost === normalizedPattern;
}

function createResidencyGuard(config = {}) {
  const {
    enforce = true,
    defaultRegion = null,
    allowLocalhost = false,
    telemetry = {},
    partnerHooks = {},
    allowedEndpoints,
    globalAllowList = [],
  } = config || {};

  const categoryMap = allowedEndpoints || { telemetry, partnerHooks };
  const normalizedGlobal = normalizePatterns(globalAllowList);

  function resolveRegion(requestedRegion) {
    return requestedRegion || defaultRegion || null;
  }

  function collectPatterns(kind, region) {
    const source = categoryMap[kind] || {};
    const patterns = normalizePatterns(source[region]);
    if (!patterns.length && normalizedGlobal.length) {
      return normalizedGlobal;
    }
    return patterns;
  }

  function ensureEndpointAllowed(endpoint, { kind = 'telemetry', region, label = 'endpoint' } = {}) {
    const relaxed = isMobileRuntimeRelaxed(config);
    if (!enforce || !endpoint || relaxed) {
      return {
        allowed: true,
        region: resolveRegion(region),
        host: null,
        enforced: Boolean(enforce) && !relaxed,
        skipped: relaxed,
      };
    }

    let url;
    try {
      const UrlCtor = getUrlCtor();
      url = new UrlCtor(endpoint);
    } catch (error) {
      throw new Error(`Invalid ${label} URL provided for residency enforcement: ${endpoint}`);
    }

    const host = url.host;
    if (allowLocalhost && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
      return { allowed: true, region: resolveRegion(region), host, enforced: true };
    }

    const resolvedRegion = resolveRegion(region);
    if (!resolvedRegion) {
      throw new Error(`Residency enforcement enabled but no default region configured for ${label}.`);
    }

    const patterns = collectPatterns(kind, resolvedRegion);
    if (!patterns.length) {
      throw new Error(
        `Residency enforcement: no allowed host patterns configured for region "${resolvedRegion}" (${label}).`
      );
    }

    const isAllowed = patterns.some((pattern) => matchesPattern(host, pattern));
    if (!isAllowed) {
      throw new Error(
        `Residency enforcement blocked ${label} host "${host}" for region "${resolvedRegion}" (allowed: ${patterns.join(
          ', '
        )}).`
      );
    }

    return { allowed: true, region: resolvedRegion, host, enforced: true };
  }

  function inspect() {
    const summary = {};
    for (const [kind, regionMap] of Object.entries(categoryMap)) {
      summary[kind] = {};
      if (!regionMap || typeof regionMap !== 'object') {
        continue;
      }
      for (const [region, patterns] of Object.entries(regionMap)) {
        summary[kind][region] = normalizePatterns(patterns);
      }
    }
    return {
      enforced: Boolean(enforce) && !isMobileRuntimeRelaxed(config),
      defaultRegion,
      allowLocalhost: Boolean(allowLocalhost),
      summary,
      globalAllowList: normalizedGlobal,
      mobileRelaxed: isMobileRuntimeRelaxed(config),
    };
  }

  return {
    ensureEndpointAllowed,
    resolveRegion,
    inspect,
    isEnforced: () => Boolean(enforce),
    allowLocalhost: toBoolean(allowLocalhost, false),
  };
}

module.exports = {
  createResidencyGuard,
};
