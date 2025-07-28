const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  captureBeliefEvent,
  assignConsequenceTrail,
  generateAdaptivePrediction,
  moduleStatus
} = require('../modules/regen/nano_pathatlas_v16');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_pathatlas_v16_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'pathatlas_consequence_v16.log');
const moralPath = path.join(__dirname, '..', 'logs', 'moral_mirror.json');

function reset() {
  [statusPath, logPath, moralPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
}

try {
  reset();
  captureBeliefEvent('user1', 'beliefX', { type: 'click' });
  assignConsequenceTrail('user1', 'beliefX', 'success');
  generateAdaptivePrediction();
  const state = moduleStatus();
  assert(state.actions.length === 1);
  assert(state.trails.length === 1);
  assert(state.predictions.length === 1);
  assert(fs.existsSync(moralPath));
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
