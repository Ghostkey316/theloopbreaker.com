const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { generateIgnitionSignal, fireSyncEngine, moduleStatus } = require('../modules/regen/nano_synapsefire_v19');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');
const syncLogPath = path.join(__dirname, '..', 'logs', 'synapsefire_v19.log');
const auditLogPath = path.join(__dirname, '..', 'logs', 'synapsefire_v19_audit.log');
const echoStatusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const memorySyncPath = path.join(__dirname, '..', 'logs', 'memorybridge_sync_v18.log');
const pathatlasLog = path.join(__dirname, '..', 'logs', 'pathatlas_v16.log');

function reset() {
  [statusPath, syncLogPath, auditLogPath, echoStatusPath, memorySyncPath, pathatlasLog].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
}

try {
  reset();
  fs.mkdirSync(path.dirname(echoStatusPath), { recursive: true });
  fs.writeFileSync(echoStatusPath, JSON.stringify({ metadata: { echo_confirmed: true, clarity_score: 0.85 } }));
  fs.mkdirSync(path.dirname(memorySyncPath), { recursive: true });
  fs.writeFileSync(memorySyncPath, JSON.stringify([{ memory_node: { node_id: 'n1' } }]));
  fs.writeFileSync(pathatlasLog, JSON.stringify([{ uuid: 'trail1' }]));

  generateIgnitionSignal('trail1', 0.9, 0.9, 0.9, 'stable', 'continue');
  const state = moduleStatus();
  assert(state.ignition_signals.length === 1);

  fireSyncEngine();
  const syncLog = JSON.parse(fs.readFileSync(syncLogPath, 'utf8'));
  const auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
  assert(syncLog.length === 1);
  assert(syncLog[0].verified === true);
  assert(auditLog[0].verified_by_ethics === true);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
