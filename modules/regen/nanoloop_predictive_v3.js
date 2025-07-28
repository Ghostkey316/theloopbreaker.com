const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v3_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v3_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_Predictive_v3.0',
  owner: 'Ghostkey-316',
  override_id: 'bpow20.cb.id'
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

function moduleStatus(){
  return _loadJSON(STATUS_PATH, { predictions: [], shields: [] });
}

function _log(entry){
  const log = _loadJSON(LOG_PATH, []);
  log.push({ ...entry, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _authorized(user){
  return user === MODULE_INFO.owner || user === MODULE_INFO.override_id;
}

function predict(user, region, signal){
  if(!_authorized(user)) return { status: 'denied' };
  const state = moduleStatus();
  const entry = { action: 'predict', region, signalVolatility: signal };
  state.predictions.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function shield(user, region){
  if(!_authorized(user)) return { status: 'denied' };
  const state = moduleStatus();
  const entry = { action: 'shield', region };
  state.shields.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log(entry);
}

function audit(){
  return moduleStatus();
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  predict,
  shield,
  audit,
};
