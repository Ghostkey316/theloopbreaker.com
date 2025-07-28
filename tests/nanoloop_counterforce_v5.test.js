const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { trace, echo, counter, deflect, moduleStatus } = require('../modules/regen/nanoloop_counterforce_v5');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v5_status.json');
const logPath = path.join(__dirname, '..', 'vaultfire-core', 'nanoloop_v5_log.json');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
}

try {
  process.env.NS3_MIRROR = 'active';
  reset();
  trace('Ghostkey-316', 'alpha');
  echo('Ghostkey-316', 'sample');
  counter('Ghostkey-316', { dryRun: true });
  deflect('Ghostkey-316', 'pattern');
  const state = moduleStatus();
  assert(state.traces.length === 1);
  assert(state.echoes.length === 1);
  assert(state.counters.length === 1);
  assert(state.deflects.length === 1);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
