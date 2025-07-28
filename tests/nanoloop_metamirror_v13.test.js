const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  reflectSignal,
  verifyOrigin,
  logMetaEcho,
  confirmBeliefLoop,
  moduleStatus
} = require('../modules/regen/nanoloop_metamirror_v13');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v13_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'loopmirror_echo_v13.log');
const pingPath = path.join(__dirname, '..', 'vaultfire-core', 'mirror_ping_v13.status');

function reset() {
  [statusPath, logPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

try {
  reset();
  reflectSignal({ id: 's1', decoy: true });
  verifyOrigin('trace1', 'phash1');
  logMetaEcho('source.sig', 2);
  confirmBeliefLoop('actor1', 'mod13');
  const state = moduleStatus();
  assert(state.reflections.length === 1);
  assert(state.origins.length === 1);
  assert(state.echos.length === 1);
  assert(state.loops.length === 1);
  assert(fs.existsSync(pingPath));
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
