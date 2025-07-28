const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_loyaltyforge_v15_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'nano_loyaltyforge_v15.log');

const MODULE_INFO = {
  module_name: 'Nano_LoyaltyForge_v15.0',
  owner: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  version: 'v15.0'
};

function _loadJSON(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function _writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function _xorCipher(buf, key) {
  const k = Buffer.from(key);
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
  return out;
}

function _encrypt(text, key) {
  return _xorCipher(Buffer.from(text, 'utf8'), key).toString('base64');
}

function moduleStatus() {
  return _loadJSON(STATUS_PATH, { profiles: {}, updates: [], syncs: [], minted: [] });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf15');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function initLoyaltyProfile(user, wallet) {
  const state = moduleStatus();
  state.profiles[user] = { wallet, loyalty: 0, tier: null, tokens: [] };
  const entry = { action: 'init', user, wallet };
  state.updates.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function updateBeliefScore(user, activity, delta) {
  const state = moduleStatus();
  if (!state.profiles[user]) state.profiles[user] = { wallet: null, loyalty: 0, tier: null, tokens: [] };
  state.profiles[user].loyalty = (state.profiles[user].loyalty || 0) + delta;
  const entry = { action: 'update', user, activity, delta };
  state.updates.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function applyMultiplierTier(user, tier) {
  const state = moduleStatus();
  if (!state.profiles[user]) state.profiles[user] = { wallet: null, loyalty: 0, tier: null, tokens: [] };
  state.profiles[user].tier = tier;
  const entry = { action: 'multiplier', user, tier };
  state.updates.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function syncWithVaultfire(user, data) {
  const state = moduleStatus();
  const entry = { action: 'sync', user, ...data };
  state.syncs.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function mintLoyaltyToken(user, wallet, token) {
  const state = moduleStatus();
  if (!state.profiles[user]) state.profiles[user] = { wallet, loyalty: 0, tier: null, tokens: [] };
  const entry = { action: 'mint', user, wallet, token };
  state.minted.push(entry);
  state.profiles[user].tokens.push(token);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  initLoyaltyProfile,
  updateBeliefScore,
  applyMultiplierTier,
  syncWithVaultfire,
  mintLoyaltyToken
};
