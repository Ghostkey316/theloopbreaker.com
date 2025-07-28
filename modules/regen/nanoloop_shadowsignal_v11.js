const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v11_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v11_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_ShadowSignal_v11.0',
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
    scans: [],
    recursion_flags: [],
    burns: [],
    agents: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf11');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function scanPayload(agent, origin, fingerprint) {
  const state = moduleStatus();
  const entry = { action: 'scan', agent, origin, fingerprint };
  state.scans.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastScan: origin };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function flagRecursion(agent, depthThreshold) {
  const state = moduleStatus();
  const entry = { action: 'flag_recursion', agent, depth: depthThreshold };
  state.recursion_flags.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), recursionDepth: depthThreshold };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function burn(agent, anchor, ghostkeyTag) {
  const state = moduleStatus();
  const entry = { action: 'burn', agent, anchor, ghostkeyTag };
  state.burns.push(entry);
  state.agents[agent] = { ...(state.agents[agent] || {}), lastBurn: anchor };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  scanPayload,
  flagRecursion,
  burn
};
