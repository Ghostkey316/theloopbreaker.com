const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { predict, shield, audit } = require('../modules/regen/nanoloop_predictive_v3');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v3_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v3_log.json');

function reset(){
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

}
test('nanoloop_v3_predictive.test', () => {
  reset();
  predict('Ghostkey-316', 'sys', 0.8);
  shield('Ghostkey-316', 'sys');
  const state = audit();
  assert(state.predictions.length === 1);
  assert(state.shields.length === 1);
});
