const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { recordSignalEvent, moduleStatus } = require('../modules/regen/nano_memorybridge_v18');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_memorybridge_v18_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'memorybridge_v18.log');
const moralPath = path.join(__dirname, '..', 'logs', 'moral_mirror.json');
const paStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_pathatlas_v16_status.json');
const paLog = path.join(__dirname, '..', 'logs', 'pathatlas_consequence_v16.log');

function reset() {
  [statusPath, logPath, moralPath, paStatus, paLog].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

try {
  reset();
  recordSignalEvent('nano_echopulse_v17', 'belief1', 0.8, true, ['t1']);
  recordSignalEvent('nano_echopulse_v17', 'belief1', 0.85, true, ['t1']);
  recordSignalEvent('nano_echopulse_v17', 'belief1', 0.9, true, ['t2']);
  const state = moduleStatus();
  assert(state.nodes['belief1'].reinforcement_count === 3);
  assert(fs.existsSync(logPath));
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  assert(log.length === 1);
  assert(log[0].memory_node.origin_module === 'nano_echopulse_v17');
  assert(fs.existsSync(moralPath));
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
