const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v8_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v8_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_InnerVoice_v8.0',
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
    echoes: [],
    listens: [],
    biaschecks: [],
    whispers: [],
    resolves: [],
    agents: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf8');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function echo(agent, thought) {
  const state = moduleStatus();
  const entry = { action: 'echo', agent, thought };
  state.echoes.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastEcho: thought };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function listen(agent) {
  const state = moduleStatus();
  const entry = { action: 'listen', agent };
  state.listens.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastListen: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function biascheck(agent) {
  const state = moduleStatus();
  const entry = { action: 'biascheck', agent };
  state.biaschecks.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastBiascheck: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function whisper(agent, message) {
  const state = moduleStatus();
  const entry = { action: 'whisper', agent, message };
  state.whispers.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastWhisper: message };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function resolve(agent) {
  const state = moduleStatus();
  const entry = { action: 'resolve', agent };
  state.resolves.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastResolve: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  echo,
  listen,
  biascheck,
  whisper,
  resolve
};
