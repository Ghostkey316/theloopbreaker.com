const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_trustengine_v14_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'trustengine_sync_v14.log');

const MODULE_INFO = {
  module_name: 'Nano_TrustEngine_v14.0',
  owner: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  ens: 'ghostkey.eth',
  version: 'v14.0'
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
  return _loadJSON(STATUS_PATH, {
    trustMap: {},
    updates: [],
    validations: [],
    syncs: [],
    fingerprints: []
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf14');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function initTrustMap(contributor, wallet) {
  const state = moduleStatus();
  state.trustMap[contributor] = { wallet, score: 0 };
  const entry = { action: 'init', contributor, wallet };
  state.updates.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function updateScore(contributor, activity, delta) {
  const state = moduleStatus();
  if (!state.trustMap[contributor]) state.trustMap[contributor] = { wallet: null, score: 0 };
  state.trustMap[contributor].score = (state.trustMap[contributor].score || 0) + delta;
  const entry = { action: 'update', contributor, activity, delta };
  state.updates.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function validateLoop(wallet) {
  const state = moduleStatus();
  const entry = { action: 'validate', wallet };
  state.validations.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function syncLoyalty(contributor) {
  const state = moduleStatus();
  const entry = { action: 'sync', contributor };
  state.syncs.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function lockFingerprint(contributor, wallet, protocol) {
  const state = moduleStatus();
  const entry = { action: 'lock', contributor, wallet, protocol };
  state.fingerprints.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  initTrustMap,
  updateScore,
  validateLoop,
  syncLoyalty,
  lockFingerprint
};
