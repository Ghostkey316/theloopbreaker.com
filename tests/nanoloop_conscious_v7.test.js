const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { reflect, mirror, remind, checkloop, moduleStatus } = require('../modules/regen/nanoloop_conscious_v7');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v7_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v7_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

}
test('nanoloop_conscious_v7.test', () => {
  reset();
  reflect('Ghostkey-316', 4, 'ghostkey316.ethics_core');
  mirror('Ghostkey-316');
  remind('Ghostkey-316');
  checkloop('Ghostkey-316');
  const state = moduleStatus();
  assert(state.reflections.length === 1);
  assert(state.reflections[0].depth === 3);
  assert(state.mirrors.length === 1);
  assert(state.reminders.length === 1);
  assert(state.checkloops.length === 1);
});
