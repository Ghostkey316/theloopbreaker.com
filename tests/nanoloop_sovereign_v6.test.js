const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { recursify, realign, vowcheck, growthmap, moduleStatus } = require('../modules/regen/nanoloop_sovereign_v6');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v6_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v6_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
}

try {
  reset();
  recursify('Ghostkey-316', 2);
  realign('Ghostkey-316', 'ethics-first');
  vowcheck('Ghostkey-316');
  growthmap('Ghostkey-316', 5);
  const state = moduleStatus();
  assert(state.recursions.length === 1);
  assert(state.realigns.length === 1);
  assert(state.vowchecks.length === 1);
  assert(state.growthmaps.length === 1);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
