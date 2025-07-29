const fs = require('fs');
const path = require('path');

const OUTBOUND_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_ghostlink_v20_status.json');
const OUTBOUND_LOG = path.join(__dirname, '..', '..', 'logs', 'ghostlink_sync_v20.log');
const ECHO_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const MEMORY_LOG = path.join(__dirname, '..', '..', 'logs', 'memorybridge_v18.log');
const SYNAPSE_STATUS = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_ghostlink_return_v21_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'ghostlink_return_v21.log');

const METADATA = {
  module: 'nano_ghostlink_return_v21',
  trail_origin: 'nano_ghostlink_v20',
  confirmed_by: 'Ghostkey-316',
  time_index: 'v21.0',
  clarity_score: 'pending',
  return_status: 'pending',
  echo_confirmed: false,
  ethical_alignment: 'in_review',
  integrity_check: true
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
  return _loadJSON(STATUS_PATH, { metadata: METADATA, returns: [] });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function verifyReturnPacket(packet) {
  if (!packet) return false;
  const outbound = _loadJSON(OUTBOUND_STATUS, { ghostlinks: [] });
  const outboundLog = _loadJSON(OUTBOUND_LOG, []);
  const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
  const mem = _loadJSON(MEMORY_LOG, []);
  const syn = _loadJSON(SYNAPSE_STATUS, { ignition_signals: [] });

  const match = outbound.ghostlinks.find(g => g.outbound_fingerprint === packet.origin_fingerprint) ||
                outboundLog.find(g => g.outbound_fingerprint === packet.origin_fingerprint);
  const ignition = syn.ignition_signals.find(s => s.spark_id === packet.ignition_signature);

  return Boolean(match && echo.metadata.echo_confirmed && mem.length && ignition);
}

function processReturnPacket(packet) {
  const state = moduleStatus();
  const verified = verifyReturnPacket(packet);
  const entry = { packet, verified, timestamp: new Date().toISOString(), ethical_tag: packet.ethical_tag || null };
  state.returns.push(entry);
  if (verified) {
    const echo = _loadJSON(ECHO_STATUS, { metadata: {} });
    state.metadata.return_status = 'verified';
    state.metadata.clarity_score = echo.metadata.clarity_score || 'pending';
    state.metadata.echo_confirmed = true;
    state.metadata.ethical_alignment = packet.ethical_tag || 'aligned';
  } else {
    state.metadata.return_status = 'rejected';
  }
  _writeJSON(STATUS_PATH, state);
  _log(entry);
  return entry;
}

module.exports = {
  METADATA,
  moduleStatus,
  processReturnPacket,
  verifyReturnPacket
};
