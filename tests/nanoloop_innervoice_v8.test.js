const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { echo, listen, biascheck, whisper, resolve, moduleStatus } = require('../modules/regen/nanoloop_innervoice_v8');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v8_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v8_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
}

try {
  reset();
  echo('Ghostkey-316', 'internal thought');
  listen('Ghostkey-316');
  biascheck('Ghostkey-316');
  whisper('Ghostkey-316', 'remember this');
  resolve('Ghostkey-316');
  const state = moduleStatus();
  assert(state.echoes.length === 1);
  assert(state.listens.length === 1);
  assert(state.biaschecks.length === 1);
  assert(state.whispers.length === 1);
  assert(state.resolves.length === 1);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
