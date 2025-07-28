const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v12_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v12_log.json');

const MODULE_INFO = {
  module_name: 'Nano_GhostLayer_v12.0',
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
  return _loadJSON(STATUS_PATH, { decoys: [], reflections: [], tracebacks: [], events: [], agents: {} });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf12');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function deploy_decoy(signal) {
  const state = moduleStatus();
  const entry = { action: 'deploy_decoy', signal };
  state.decoys.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function reflect(payload) {
  const state = moduleStatus();
  const entry = { action: 'reflect', payload };
  state.reflections.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function traceback(source) {
  const state = moduleStatus();
  const entry = { action: 'traceback', source };
  state.tracebacks.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function log_event(caller, bait_signature, timestamp) {
  const state = moduleStatus();
  const entry = { action: 'log_event', caller, bait_signature, timestamp };
  state.events.push(entry);
  state.agents[caller] = { ...(state.agents[caller] || {}), lastEvent: timestamp };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  deploy_decoy,
  reflect,
  traceback,
  log_event
};
