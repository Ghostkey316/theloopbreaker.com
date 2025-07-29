const fs = require('fs');
const path = require('path');
const metamirror = require('./nanoloop_metamirror_v13');
const pathatlas = require('./nano_pathatlas_v16');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'echopulse_feedback_v17.log');

const MODULE_INFO = {
  module_name: 'Nano_EchoPulse_v17.0',
  deployed_by: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  ens: 'ghostkey316.eth',
  time_index: 'v17.0',
  version: 'v17.0'
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

function moduleStatus() {
  return _loadJSON(STATUS_PATH, {
    metadata: {
      module: 'nano_echopulse_v17',
      deployed_by: 'Ghostkey-316',
      time_index: 'v17.0',
      clarity_score: 'pending',
      echo_confirmed: false,
      belief_alignment: 'undetermined'
    },
    matches: [],
    clarities: [],
    loops: []
  });
}

function _update(state) {
  _writeJSON(STATUS_PATH, state);
  return state;
}

function matchBeliefEcho(projected, consequence) {
  const state = moduleStatus();
  let classification = 'Distorted';
  if (projected === consequence) classification = 'Aligned';
  else if (!consequence) classification = 'Ignored';
  const entry = { action: 'match', projected, consequence, classification };
  state.matches.push(entry);
  state.metadata.belief_alignment = classification;
  _update(state);
  return entry;
}

function measureSignalClarity(intention, result) {
  const state = moduleStatus();
  const total = intention.length + result.length;
  const diff = Math.abs(intention.length - result.length);
  const clarity = total ? Math.max(0, Math.round(100 * (1 - diff / total))) : 100;
  const entry = { action: 'clarity', intention, result, clarity };
  state.clarities.push(entry);
  state.metadata.clarity_score = clarity;
  _update(state);
  return entry;
}

function _logFeedback(fingerprint, clarity_score, trail_id) {
  const log = _loadJSON(LOG_PATH, []);
  const entry = { fingerprint, clarity_score, trail_id, timestamp: new Date().toISOString() };
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function syncMetaFeedback(fingerprint, trail_id) {
  const state = moduleStatus();
  try {
    metamirror.confirmBeliefLoop(fingerprint, MODULE_INFO.module_name);
  } catch {}
  try {
    pathatlas.assignConsequenceTrail(fingerprint, fingerprint, trail_id);
  } catch {}
  state.metadata.echo_confirmed = true;
  const entry = { action: 'feedback_loop', fingerprint, trail_id, clarity_score: state.metadata.clarity_score };
  state.loops.push(entry);
  _update(state);
  _logFeedback(fingerprint, state.metadata.clarity_score, trail_id);
  return entry;
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  matchBeliefEcho,
  measureSignalClarity,
  syncMetaFeedback
};
