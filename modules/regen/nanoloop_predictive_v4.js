const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v4_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v4_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_GuardianNet_v4.0',
  owner: 'Ghostkey-316',
  override_id: 'bpow20.cb.id',
  ens: 'ghostkey316.eth',
  wallet: 'bpow20.cb.id',
  role: 'Vaultfire Architect'
};

function _loadJSON(p, def){
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function _writeJSON(p, data){
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function _xorCipher(buf, key){
  const k = Buffer.from(key);
  const out = Buffer.alloc(buf.length);
  for(let i=0;i<buf.length;i++) out[i] = buf[i] ^ k[i % k.length];
  return out;
}

function _encrypt(text, key){
  return _xorCipher(Buffer.from(text, 'utf8'), key).toString('base64');
}

function moduleStatus(){
  return _loadJSON(STATUS_PATH, { predictions: [], shields: [], agents: {} });
}

function _log(entry){
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _authorized(token){
  return token === MODULE_INFO.owner || token === MODULE_INFO.override_id;
}

function predict(agent, region, signal, opts={}){
  if(!_authorized(agent)) return { status: 'denied' };
  const state = moduleStatus();
  const entry = { action: 'predict', agent, region, signal, deep: !!opts.deep };
  state.predictions.push(entry);
  state.agents[agent] = { lastPredict: region, threat: signal };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function shield(agent, region, opts={}){
  if(!_authorized(agent)) return { status: 'denied' };
  const state = moduleStatus();
  const entry = { action: 'shield', agent, region, mode: opts.mode || 'active' };
  state.shields.push(entry);
  state.agents[agent] = { ...(state.agents[agent]||{}), lastShield: region, mode: entry.mode };
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function audit(){
  return moduleStatus();
}

function status(agent){
  const state = moduleStatus();
  return state.agents[agent] || null;
}

function authorize(token){
  return _authorized(token);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  predict,
  shield,
  audit,
  status,
  authorize
};
