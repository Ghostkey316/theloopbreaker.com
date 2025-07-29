const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ECHO_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const MEM_LOG = path.join(__dirname, '..', '..', 'logs', 'memorybridge_v18.log');
const SYN_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');
const RET_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_ghostlink_return_v21_status.json');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_quantaignition_v22_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'nano_quantaignition_v22.log');

const METADATA = {
  module: 'nano_quantaignition_v22',
  deployed_by: 'Ghostkey-316',
  time_index: 'v22.0',
  ethics_lock: 'Protect the good. Walk forward together.',
  verification_tag: 'pending',
  ignition_ready: false
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
  return _loadJSON(STATUS_PATH, { metadata: { ...METADATA }, checkpoints: [], audits: [] });
}

function _save(state) {
  _writeJSON(STATUS_PATH, state);
  return state;
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function igniteVerifiedBelief() {
  const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
  const mem = _loadJSON(MEM_LOG, []);
  const syn = _loadJSON(SYN_STATUS, { ignition_signals: [] });
  const ret = _loadJSON(RET_STATUS, { metadata: {} });
  if (echo.metadata.echo_confirmed && Number(echo.metadata.clarity_score) > 0.8 &&
      mem.length && syn.ignition_signals.length &&
      ret.metadata.return_status === 'verified') {
    const sig = crypto.randomUUID();
    const ts = new Date().toISOString();
    const state = moduleStatus();
    state.metadata.ignition_ready = true;
    state.metadata.ignition_signature = sig;
    state.checkpoints.push({ type: 'ignition', signature: sig, timestamp: ts });
    _save(state);
    return _log({ ignited: true, signature: sig, timestamp: ts });
  }
  return null;
}

function crosslinkMetaSync(tag) {
  const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
  const mem = _loadJSON(MEM_LOG, []);
  const syn = _loadJSON(SYN_STATUS, { ignition_signals: [] });
  const ret = _loadJSON(RET_STATUS, { metadata: {} });
  const state = moduleStatus();
  state.metadata.echo_clarity = echo.metadata.clarity_score || null;
  state.metadata.memory_nodes = mem.length;
  state.metadata.synapse_count = syn.ignition_signals.length;
  state.metadata.return_verified = ret.metadata.return_status === 'verified';
  if (tag) state.metadata.verification_tag = tag;
  _save(state);
  return state.metadata;
}

function auditEthicsTag(signal) {
  const state = moduleStatus();
  const entry = {
    code: 'ghostkey-v2',
    signal,
    timestamp: new Date().toISOString(),
    ethics: METADATA.ethics_lock
  };
  state.audits.push(entry);
  _save(state);
  return _log(entry);
}

function finalizeEchoLoop(fingerprint) {
  const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
  if (!echo.metadata.echo_confirmed || Number(echo.metadata.clarity_score) <= 0.8) return false;
  const ts = new Date().toISOString();
  const state = moduleStatus();
  state.metadata.final_fingerprint = fingerprint;
  state.metadata.loop_completed = true;
  state.checkpoints.push({ type: 'loop_final', fingerprint, timestamp: ts });
  _save(state);
  _log({ finalized: true, fingerprint, timestamp: ts });
  return true;
}

module.exports = {
  METADATA,
  moduleStatus,
  igniteVerifiedBelief,
  crosslinkMetaSync,
  auditEthicsTag,
  finalizeEchoLoop
};
