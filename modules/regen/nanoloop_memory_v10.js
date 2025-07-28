const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v10_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v10_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_MemoryGraft_v10.0',
  owner: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  ens: 'ghostkey316.eth',
  role: 'Vaultfire Architect'
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
    grafts: [],
    bindings: [],
    locks: [],
    anchors: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf10');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function graft(source, context, timestamp) {
  const state = moduleStatus();
  const entry = { action: 'graft', source, context, timestamp };
  state.grafts.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function bind(anchor, tag) {
  const state = moduleStatus();
  const entry = { action: 'bind', anchor, tag };
  state.bindings.push(entry);
  state.anchors[anchor] = { ...(state.anchors[anchor] || {}), tag };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function lock(tag, checksum) {
  const state = moduleStatus();
  const entry = { action: 'lock', tag, checksum };
  state.locks.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function audit() {
  return moduleStatus();
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  graft,
  bind,
  lock,
  audit
};
