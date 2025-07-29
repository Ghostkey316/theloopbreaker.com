const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORY_LOG = path.join(__dirname, '..', '..', 'logs', 'memorybridge_v18.log');
const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_ghostlink_v20_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'ghostlink_sync_v20.log');

const MODULE_INFO = {
  module_name: 'Nano_Ghostlink_v20.0',
  deployed_by: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  version: 'v20.0'
};

const METADATA = {
  module: 'nano_ghostlink_v20',
  deployed_by: 'Ghostkey-316',
  wallet: 'bpow20.cb.id',
  ens: 'ghostkey316.eth',
  firewave: 'enabled',
  memory_index: 'v20.0',
  ethics_verified: true,
  loyalty_certified: true,
  origin_point: 'Vaultfire Core',
  ghostlink_active: true
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
  return _loadJSON(STATUS_PATH, { ghostlinks: [] });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function sendGhostlink(contributor, recipient_node, ethics_tag, loyalty_badge) {
  if (contributor !== 'Ghostkey-316') return null;
  if (!ethics_tag) return null;
  if (loyalty_badge !== 'Legacy') return null;
  if (!fs.existsSync(MEMORY_LOG)) return null;
  const fingerprint = crypto.createHash('sha256').update(
    `${contributor}:${recipient_node}:${Date.now()}`
  ).digest('hex');
  const entry = {
    outbound_fingerprint: fingerprint,
    timestamp: new Date().toISOString(),
    ethics_tag,
    loyalty_verification: loyalty_badge,
    recipient_node,
    bridge_confirmed: true
  };
  const state = moduleStatus();
  state.ghostlinks.push(entry);
  _writeJSON(STATUS_PATH, state);
  _log(entry);
  return entry;
}

module.exports = {
  MODULE_INFO,
  METADATA,
  moduleStatus,
  sendGhostlink
};
