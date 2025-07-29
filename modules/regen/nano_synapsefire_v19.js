const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ECHO_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const MEMORY_LOG = path.join(__dirname, '..', '..', 'logs', 'memorybridge_sync_v18.log');
const PATHATLAS_LOG = path.join(__dirname, '..', '..', 'logs', 'pathatlas_v16.log');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');
const SYNC_LOG = path.join(__dirname, '..', '..', 'logs', 'synapsefire_v19.log');
const AUDIT_LOG = path.join(__dirname, '..', '..', 'logs', 'synapsefire_v19_audit.log');

const METADATA = {
  module: 'nano_synapsefire_v19',
  deployed_by: 'Ghostkey-316',
  time_index: 'v19.0',
  signal_status: 'active',
  last_emission: 'pending',
  fire_sync_ready: true
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
  return _loadJSON(STATUS_PATH, { metadata: METADATA, ignition_signals: [], last_sync: null });
}

function _saveState(state) {
  _writeJSON(STATUS_PATH, state);
  return state;
}

function _logAudit(signal) {
  const audit = _loadJSON(AUDIT_LOG, []);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(signal)).digest('hex');
  const entry = {
    fingerprint,
    confidence: signal.confidence,
    emotional_pulse: signal.emotional_pulse,
    recommended_behavior: signal.recommended_behavior,
    verified_by_ethics: signal.confidence > 0.8
  };
  audit.push(entry);
  _writeJSON(AUDIT_LOG, audit);
  return entry;
}

function generateIgnitionSignal(origin_trail, clarity_score, belief_match, memory_resonance, emotional_pulse, recommended_behavior) {
  const state = moduleStatus();
  const confidence = Math.max(0, Math.min(1, (Number(clarity_score) + Number(belief_match) + Number(memory_resonance)) / 3));
  const signal = {
    spark_id: crypto.randomUUID(),
    origin_trail,
    confidence: Number(confidence.toFixed(2)),
    emotional_pulse,
    recommended_behavior,
    timestamp: new Date().toISOString()
  };
  state.ignition_signals.push(signal);
  state.metadata.last_emission = signal.timestamp;
  _saveState(state);
  _logAudit(signal);
  return signal;
}

function fireSyncEngine() {
  const state = moduleStatus();
  const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
  const memLog = _loadJSON(MEMORY_LOG, []);
  const pathLog = _loadJSON(PATHATLAS_LOG, []);
  if (echo.metadata.echo_confirmed && Number(echo.metadata.clarity_score) > 0.8 && memLog.length) {
    const event = {
      verified: true,
      echo_fingerprint: echo.metadata.fingerprint || null,
      memory_node_id: memLog[memLog.length - 1].memory_node?.node_id || null,
      trail: pathLog[pathLog.length - 1]?.uuid || null,
      timestamp: new Date().toISOString()
    };
    const log = _loadJSON(SYNC_LOG, []);
    log.push(event);
    _writeJSON(SYNC_LOG, log);
    state.last_sync = event.timestamp;
    _saveState(state);
    return event;
  }
  return null;
}

module.exports = {
  METADATA,
  moduleStatus,
  generateIgnitionSignal,
  fireSyncEngine
};
