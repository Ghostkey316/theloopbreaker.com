const fs = require('fs');
const path = require('path');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v2_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v2_log.json');

const MODULE_INFO = {
  module_name: 'NanoLoop_MirrorSync_v2.0',
  owner: 'Ghostkey-316',
  purpose_engine_link: 'v2'
};

const ghostkey = { alignment: 'ethical' };

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
  return _loadJSON(STATUS_PATH, { healing_rate: 0 });
}

function _log(entry){
  const log = _loadJSON(LOG_PATH, []);
  log.push({ ...entry, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function syncMirror(signalClarity, beliefSync){
  const state = moduleStatus();
  let rate = signalClarity * beliefSync;
  if(ghostkey.alignment === 'ethical') rate *= 1.2;
  state.healing_rate = Number(rate.toFixed(2));
  _writeJSON(STATUS_PATH, state);
  return state;
}

function repair(patient, thread){
  return _log({ action: 'repair', patient, thread });
}

function stabilize(patient, notes){
  return _log({ action: 'stabilize', patient, notes });
}

function rebuild(patient, pattern){
  return _log({ action: 'rebuild', patient, pattern });
}

function adapt(status){
  const state = moduleStatus();
  state.ethics_status = status;
  _writeJSON(STATUS_PATH, state);
  return state;
}

function upgradeCore(tag){
  const state = moduleStatus();
  state.upgraded_to = tag;
  _writeJSON(STATUS_PATH, state);
  return state;
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  syncMirror,
  repair,
  stabilize,
  rebuild,
  adapt,
  upgradeCore,
};
