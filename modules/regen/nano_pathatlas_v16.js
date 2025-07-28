const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const metamirror = require('./nanoloop_metamirror_v13');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_pathatlas_v16_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'pathatlas_consequence_v16.log');
const MORAL_MIRROR_PATH = path.join(__dirname, '..', '..', 'logs', 'moral_mirror.json');
const SCORECARD_PATH = path.join(__dirname, '..', '..', 'user_scorecard.json');

const MODULE_INFO = {
  module_name: 'Nano_PathAtlas_v16.0',
  owner: 'Ghostkey-316',
  authority: 'bpow20.cb.id',
  version: 'v16.0',
  tag: 'Deployed by Ghostkey-316 | bpow20.cb.id',
  time_index: 'v16.0'
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
  return _loadJSON(STATUS_PATH, { actions: [], trails: [], predictions: [], vectors: {} });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf16');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _behaviorWeight(user) {
  const scorecard = _loadJSON(SCORECARD_PATH, {});
  return (scorecard[user] && scorecard[user].contributor_score) || 0;
}

function _recordMoralMirror(user, text) {
  const data = _loadJSON(MORAL_MIRROR_PATH, {});
  const history = data[user] || [];
  history.push({ timestamp: new Date().toISOString(), text });
  data[user] = history.slice(-50);
  _writeJSON(MORAL_MIRROR_PATH, data);
}

function _syncLayers(user, text) {
  _recordMoralMirror(user, text);
  try {
    metamirror.confirmBeliefLoop(user, MODULE_INFO.module_name);
  } catch {
    // ignore sync errors
  }
}

function captureBeliefEvent(user, beliefSig, event) {
  const state = moduleStatus();
  const weight = _behaviorWeight(user);
  const entry = {
    action: 'capture',
    user,
    beliefSig,
    event,
    weight,
    uuid: crypto.randomUUID()
  };
  state.actions.push(entry);
  state.vectors[beliefSig] = (state.vectors[beliefSig] || 0) + weight;
  _writeJSON(STATUS_PATH, state);
  _syncLayers(user, JSON.stringify(event));
  return _log(entry);
}

function assignConsequenceTrail(user, beliefSig, outcome) {
  const state = moduleStatus();
  const weight = _behaviorWeight(user);
  const entry = {
    action: 'trail',
    user,
    beliefSig,
    outcome,
    weight,
    uuid: crypto.randomUUID()
  };
  state.trails.push(entry);
  state.vectors[beliefSig] = (state.vectors[beliefSig] || 0) + weight;
  _writeJSON(STATUS_PATH, state);
  _syncLayers(user, outcome);
  return _log(entry);
}

function generateAdaptivePrediction() {
  const state = moduleStatus();
  const entries = Object.entries(state.vectors || {});
  if (!entries.length) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const [belief, weight] = entries.sort((a, b) => b[1] - a[1])[0];
  const pred = {
    action: 'predict',
    belief,
    probability: total ? weight / total : 0,
    uuid: crypto.randomUUID()
  };
  state.predictions.push(pred);
  _writeJSON(STATUS_PATH, state);
  return _log(pred);
}

module.exports = {
  MODULE_INFO,
  moduleStatus,
  captureBeliefEvent,
  assignConsequenceTrail,
  generateAdaptivePrediction
};
