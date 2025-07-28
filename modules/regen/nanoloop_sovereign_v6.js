const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v6_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v6_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_Sovereign_v6.0',
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
    recursions: [],
    realigns: [],
    vowchecks: [],
    growthmaps: [],
    agents: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf6');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function recursify(agent, depth = 1) {
  const state = moduleStatus();
  const entry = { action: 'recursify', agent, depth };
  state.recursions.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastRecursion: depth };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function realign(agent, priority) {
  const state = moduleStatus();
  const entry = { action: 'realign', agent, priority };
  state.realigns.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastRealign: priority };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function vowcheck(agent) {
  const state = moduleStatus();
  const entry = { action: 'vowcheck', agent };
  state.vowchecks.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastVowcheck: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function growthmap(agent, horizon = 1) {
  const state = moduleStatus();
  const entry = { action: 'growthmap', agent, horizon };
  state.growthmaps.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastGrowthmap: horizon };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  recursify,
  realign,
  vowcheck,
  growthmap
};
