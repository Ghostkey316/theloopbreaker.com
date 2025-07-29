const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pathatlas = require('./nano_pathatlas_v16');
const metamirror = require('./nanoloop_metamirror_v13');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nano_memorybridge_v18_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'memorybridge_v18.log');

const MODULE_INFO = {
  module_name: 'Nano_MemoryBridge_v18.0',
  deployed_by: 'Ghostkey-316',
  time_index: 'v18.0',
  version: 'v18.0'
};

const METADATA = {
  module: 'nano_memorybridge_v18',
  deployed_by: 'Ghostkey-316',
  time_index: 'v18.0',
  memory_node: true,
  linked_modules: ['nano_echopulse_v17', 'nano.pathatlas_v16'],
  sync_ready: true
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
  return _loadJSON(STATUS_PATH, { nodes: {} });
}

function _logBridge(entry) {
  const log = _loadJSON(LOG_PATH, []);
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function recordSignalEvent(origin_module, belief_pattern, clarity_score, echo_confirmed, trail_ids = []) {
  const state = moduleStatus();
  const node = state.nodes[belief_pattern] || {
    node_id: crypto.randomUUID(),
    origin_module,
    reinforcement_count: 0,
    last_seen_timestamp: null
  };
  node.reinforcement_count += 1;
  node.last_seen_timestamp = new Date().toISOString();
  state.nodes[belief_pattern] = node;
  _writeJSON(STATUS_PATH, state);

  if (node.reinforcement_count >= 3 && clarity_score > 0.75 && echo_confirmed) {
    const entry = {
      memory_node: { ...node },
      linked_trail_ids: trail_ids,
      bridge_timestamp: new Date().toISOString()
    };
    _logBridge(entry);
    try {
      pathatlas.assignConsequenceTrail(origin_module, belief_pattern, node.node_id);
    } catch {}
    try {
      metamirror.confirmBeliefLoop(node.node_id, MODULE_INFO.module_name);
    } catch {}
    return entry;
  }

  return null;
}

module.exports = {
  MODULE_INFO,
  METADATA,
  moduleStatus,
  recordSignalEvent
};
