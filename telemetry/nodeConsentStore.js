const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_STORE_PATH = process.env.VAULTFIRE_TELEMETRY_STORE ||
  path.join(os.homedir(), '.vaultfire', 'telemetry-consent.json');

function loadStore(filePath = DEFAULT_STORE_PATH) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveStore(store, filePath = DEFAULT_STORE_PATH) {
  const targetDir = path.dirname(filePath);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

function normalizeWallet(wallet) {
  return typeof wallet === 'string' ? wallet.trim().toLowerCase() : '';
}

function hasOptIn(wallet, { filePath = DEFAULT_STORE_PATH } = {}) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) {
    return false;
  }
  const store = loadStore(filePath);
  return Boolean(store[normalized]?.enabled);
}

function setOptIn(wallet, enabled, { filePath = DEFAULT_STORE_PATH } = {}) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) {
    return null;
  }
  const store = loadStore(filePath);
  if (enabled) {
    store[normalized] = { enabled: true, updatedAt: new Date().toISOString() };
  } else {
    delete store[normalized];
  }
  saveStore(store, filePath);
  return store[normalized] ?? null;
}

module.exports = {
  loadStore,
  saveStore,
  hasOptIn,
  setOptIn,
  normalizeWallet,
  DEFAULT_STORE_PATH,
};
