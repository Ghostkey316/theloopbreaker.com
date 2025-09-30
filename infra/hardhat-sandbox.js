'use strict';

const fs = require('fs');
const path = require('path');

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

  return {
    tmpDir: preferredTmp,
    rpcUrl: sanitizedRpc,
  };
}

module.exports = {
  applyHardhatSandbox,
  enforceLoopback,
};
