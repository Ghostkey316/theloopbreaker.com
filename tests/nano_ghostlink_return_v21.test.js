const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { sendGhostlink } = require('../modules/regen/nano_ghostlink_v20');
const { processReturnPacket, moduleStatus } = require('../modules/regen/nano_ghostlink_return_v21');

const gl20Status = path.join(__dirname, '..', 'vaultfire-core', 'nano_ghostlink_v20_status.json');
const gl20Log = path.join(__dirname, '..', 'logs', 'ghostlink_sync_v20.log');
const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_ghostlink_return_v21_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'ghostlink_return_v21.log');
const memLog = path.join(__dirname, '..', 'logs', 'memorybridge_v18.log');
const echoStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const synStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');

function reset() {
  [gl20Status, gl20Log, statusPath, logPath, memLog, echoStatus, synStatus].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

try {
  reset();
  fs.mkdirSync(path.dirname(memLog), { recursive: true });
  fs.writeFileSync(memLog, JSON.stringify([{ ok: true }]));
  const outbound = sendGhostlink('Ghostkey-316', 'node1', true, 'Legacy');

  fs.writeFileSync(echoStatus, JSON.stringify({ metadata: { echo_confirmed: true, clarity_score: 0.9 } }));
  fs.writeFileSync(synStatus, JSON.stringify({ ignition_signals: [{ spark_id: 'sig1' }] }));

  processReturnPacket({
    origin_fingerprint: outbound.outbound_fingerprint,
    trail_id: 't1',
    ignition_signature: 'sig1',
    ethical_tag: 'aligned'
  });

  const state = moduleStatus();
  assert(state.returns.length === 1);
  assert(state.metadata.return_status === 'verified');
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  assert(log[0].verified === true);
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
