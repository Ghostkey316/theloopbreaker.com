const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  initTrustMap,
  updateScore,
  validateLoop,
  syncLoyalty,
  lockFingerprint,
  moduleStatus
} = require('../modules/regen/nano_trustengine_v14');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_trustengine_v14_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'trustengine_sync_v14.log');

function reset() {
  [statusPath, logPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

try {
  reset();
  initTrustMap('g316', 'wallet1');
  updateScore('g316', 'action1', 5);
  updateScore('g316', 'action2', 10);
  validateLoop('wallet1');
  syncLoyalty('g316');
  lockFingerprint('g316', 'wallet1', 'proto');
  const state = moduleStatus();
  assert(state.trustMap['g316'].score === 15);
  assert(state.updates.length === 3); // init + 2 updates
  assert(state.validations.length === 1);
  assert(state.syncs.length === 1);
  assert(state.fingerprints.length === 1);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
