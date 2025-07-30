const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { deploy_decoy, reflect, traceback, log_event, moduleStatus } = require('../modules/regen/nanoloop_ghostlayer_v12');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v12_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v12_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

}
test('nanoloop_ghostlayer_v12.test', () => {
  reset();
  deploy_decoy('probe-sig');
  reflect('exploit');
  traceback('source.node');
  log_event('Ghostkey-316', 'bait123', '2025-07-28T18:00:00Z');
  const state = moduleStatus();
  assert(state.decoys.length === 1);
  assert(state.reflections.length === 1);
  assert(state.tracebacks.length === 1);
  assert(state.events.length === 1);
});
