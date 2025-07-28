const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { graft, bind, lock, audit, moduleStatus } = require('../modules/regen/nanoloop_memory_v10');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v10_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v10_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
}

try {
  reset();
  graft('override.log', 'ctx', 123);
  bind('ghostkey316.eth', 'ethics_foundation');
  lock('ethics_foundation', 'abc123');
  const state = moduleStatus();
  assert(state.grafts.length === 1);
  assert(state.bindings.length === 1);
  assert(state.locks.length === 1);
  const report = audit();
  assert(report.grafts.length === 1);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
