const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v7_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v7_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_ConsciousMirror_v7.0',
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
    reflections: [],
    mirrors: [],
    reminders: [],
    checkloops: [],
    agents: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf7');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _voice(agent, text) {
  const state = moduleStatus();
  const entry = { action: 'voice', agent, text };
  state.agents[agent] = { ...(state.agents[agent] || {}), lastVoice: text };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function reflect(agent, depth = 1, anchor = 'ghostkey316.ethics_core') {
  try {
    depth = Math.min(depth || 1, 3);
    const state = moduleStatus();
    const entry = { action: 'reflect', agent, depth, anchor };
    state.reflections.push(entry);
    state.agents[agent] = { ...(state.agents[agent] || {}), lastReflect: depth };
    _writeJSON(STATUS_PATH, state);
    return _log(entry);
  } catch (err) {
    return _voice(agent, 'reflect-fallback');
  }
}

function mirror(agent) {
  const state = moduleStatus();
  const entry = { action: 'mirror', agent };
  state.mirrors.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastMirror: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function remind(agent) {
  const state = moduleStatus();
  const entry = { action: 'remind', agent };
  state.reminders.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastRemind: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function checkloop(agent) {
  const state = moduleStatus();
  const entry = { action: 'checkloop', agent };
  state.checkloops.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastCheck: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  reflect,
  mirror,
  remind,
  checkloop
};
