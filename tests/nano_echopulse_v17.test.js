const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  matchBeliefEcho,
  measureSignalClarity,
  syncMetaFeedback,
  moduleStatus
} = require('../modules/regen/nano_echopulse_v17');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'echopulse_feedback_v17.log');

function reset() {
  [statusPath, logPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

}
test('nano_echopulse_v17.test', () => {
  reset();
  matchBeliefEcho('belief', 'belief');
  measureSignalClarity('intent', 'intentional');
  syncMetaFeedback('finger1', 'trailA');
  const state = moduleStatus();
  assert(state.metadata.belief_alignment === 'Aligned');
  assert(typeof state.metadata.clarity_score === 'number');
  assert(state.metadata.echo_confirmed === true);
  const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  assert(logs.length === 1);
  assert(logs[0].fingerprint === 'finger1');
});
