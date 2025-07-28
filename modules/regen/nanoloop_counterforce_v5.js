const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v5_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v5_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_Counterforce_v5.0',
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
  return _loadJSON(STATUS_PATH, { traces: [], echoes: [], counters: [], deflects: [], agents: {} });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf4');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _requireDependencies() {
  try {
    require('./nanoloop_predictive_v3');
    require('./nanoloop_mirrorsync_v2');
    return true;
  } catch {
    return false;
  }
}

function syncstatus(agent) {
  const state = moduleStatus();
  return state.agents[agent] || null;
}

function trace(agent, signal) {
  if (!_requireDependencies()) return { status: 'missing_dependency' };
  const state = moduleStatus();
  const entry = { action: 'trace', agent, signal };
  state.traces.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), traced: true };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function echo(agent, behavior) {
  if (process.env.NS3_MIRROR !== 'active') return { status: 'ns3_inactive' };
  const state = moduleStatus();
  const entry = { action: 'echo', agent, behavior };
  state.echoes.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function counter(agent, opts = {}) {
  const state = moduleStatus();
  const entry = { action: 'counter', agent, dryRun: !!opts.dryRun };
  state.counters.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastCounter: entry.dryRun ? 'dry' : 'active' };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function deflect(agent, pattern) {
  const state = moduleStatus();
  const entry = { action: 'deflect', agent, pattern };
  state.deflects.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastDeflect: pattern };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  syncstatus,
  trace,
  echo,
  counter,
  deflect
};
