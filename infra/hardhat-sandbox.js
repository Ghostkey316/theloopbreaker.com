'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function isVersionAtLeast(version, baseline) {
  if (!version) {
    return false;
  }

  const parse = (input) =>
    String(input)
      .split('-')[0]
      .split('.')
      .map((segment) => {
        const value = Number.parseInt(segment, 10);
        return Number.isNaN(value) ? 0 : value;
      });

  const left = parse(version);
  const right = parse(baseline);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta > 0) {
      return true;
    }
    if (delta < 0) {
      return false;
    }
  }

  return true;
}

const HARDHAT_TAG = `${path.sep}node_modules${path.sep}hardhat${path.sep}`;
const SOLC_TAG = `${path.sep}node_modules${path.sep}solc${path.sep}`;

let moduleGuardsInstalled = false;
let safeTmpBase = null;
const originalModuleLoad = Module._load;

function isHardhatParent(parent) {
  return Boolean(parent && parent.filename && parent.filename.includes(HARDHAT_TAG));
}

function isSandboxedTmpParent(parent) {
  if (!parent || !parent.filename) {
    return false;
  }
  const filePath = parent.filename;
  return filePath.includes(HARDHAT_TAG) || filePath.includes(SOLC_TAG);
}

function createSentryStub() {
  const noop = () => undefined;
  const resolved = Promise.resolve(true);
  return {
    __vaultfireSandboxStub: true,
    init: () => ({
      close: () => resolved,
      flush: () => resolved,
      captureException: noop,
      captureMessage: noop,
    }),
    close: () => resolved,
    flush: () => resolved,
    captureException: noop,
    captureMessage: noop,
    withScope: (cb) => {
      if (typeof cb === 'function') {
        cb({ setTag: noop, setExtra: noop, setContext: noop });
      }
    },
    configureScope: (cb) => {
      if (typeof cb === 'function') {
        cb({ setTag: noop, setExtra: noop, setContext: noop });
      }
    },
    getCurrentHub: () => ({ getClient: () => null }),
  };
}

function createSafeTmpWrapper(tmpModule, baseDir) {
  if (!tmpModule || tmpModule.__vaultfireGuarded) {
    return tmpModule;
  }

  let tmpVersion = null;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    tmpVersion = require('tmp/package.json').version;
  } catch (error) {
    tmpVersion = null;
  }

  if (isVersionAtLeast(tmpVersion, '0.2.4')) {
    return tmpModule;
  }

  const safeDir = ensureDirectory(baseDir);

  const normalizeOptions = (options = {}) => {
    if (typeof options === 'string') {
      return { dir: safeDir, template: options };
    }
    const sanitized = { ...options, dir: safeDir };
    if (sanitized.unsafeCleanup) {
      sanitized.unsafeCleanup = false;
    }
    return sanitized;
  };

  const wrapped = { ...tmpModule };

  wrapped.dirSync = (options) => tmpModule.dirSync(normalizeOptions(options));
  wrapped.dir = (options, callback) => {
    let normalizedOptions = options;
    let cb = callback;
    if (typeof options === 'function') {
      normalizedOptions = {};
      cb = options;
    }
    return tmpModule.dir(normalizeOptions(normalizedOptions), cb);
  };

  wrapped.__vaultfireGuarded = true;
  return wrapped;
}

function installModuleGuards(preferredTmp) {
  safeTmpBase = ensureDirectory(path.join(preferredTmp, 'sandbox-tmp'));

  if (moduleGuardsInstalled) {
    return;
  }

  Module._load = function vaultfireSandboxedLoad(request, parent, isMain) {
    if (request === '@sentry/node' && isHardhatParent(parent)) {
      return createSentryStub();
    }
    if (request === 'tmp' && isSandboxedTmpParent(parent)) {
      const loaded = originalModuleLoad.call(this, request, parent, isMain);
      return createSafeTmpWrapper(loaded, safeTmpBase);
    }
    return originalModuleLoad.call(this, request, parent, isMain);
  };

  moduleGuardsInstalled = true;
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true, mode: 0o700 });
  return targetPath;
}

function enforceLoopback(url) {
  if (!url) {
    return 'http://127.0.0.1:8545';
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || '';
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
    if (!loopbackHosts.has(host)) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠ [hardhat sandbox] Non-loopback RPC host "${host}" detected. Resetting to 127.0.0.1 to contain cookie/tmp CVEs.`
      );
      return 'http://127.0.0.1:8545';
    }
    return url;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠ [hardhat sandbox] Invalid RPC URL "${url}" provided (${error.message}). Falling back to http://127.0.0.1:8545.`
    );
    return 'http://127.0.0.1:8545';
  }
}

function applyHardhatSandbox() {
  const rootTmp = path.join(__dirname, '..', '.vaultfire_tmp');
  const hardhatTmp = ensureDirectory(path.join(rootTmp, 'hardhat')); // scoped directory prevents tmp symlink exploits
  const preferredTmp = process.env.VAULTFIRE_HARDHAT_TMPDIR || hardhatTmp;
  ensureDirectory(preferredTmp);

  process.env.TMPDIR = preferredTmp;
  process.env.TMP = preferredTmp;
  process.env.TEMP = preferredTmp;
  process.env.HARDHAT_DISABLE_TELEMETRY = '1';
  process.env.HARDHAT_NETWORK_ALLOW_REMOTE = '0';

  const sanitizedRpc = enforceLoopback(process.env.BASE_RPC_URL);
  process.env.BASE_RPC_URL = sanitizedRpc;

  installModuleGuards(preferredTmp);

  return {
    tmpDir: preferredTmp,
    rpcUrl: sanitizedRpc,
  };
}

module.exports = {
  applyHardhatSandbox,
  enforceLoopback,
};
