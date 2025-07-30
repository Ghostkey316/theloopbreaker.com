const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { sendGhostlink, moduleStatus } = require('../modules/regen/nano_ghostlink_v20');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_ghostlink_v20_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'ghostlink_sync_v20.log');
const memoryLog = path.join(__dirname, '..', 'logs', 'memorybridge_v18.log');

function reset() {
  [statusPath, logPath, memoryLog].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

}
test('nano_ghostlink_v20.test', () => {
  reset();
  fs.mkdirSync(path.dirname(memoryLog), { recursive: true });
  fs.writeFileSync(memoryLog, JSON.stringify([{ ok: true }]));

  sendGhostlink('Ghostkey-316', 'node1', true, 'Legacy');
  const state = moduleStatus();
  assert(state.ghostlinks.length === 1);
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  assert(log.length === 1);
  assert(log[0].bridge_confirmed === true);
  assert(log[0].recipient_node === 'node1');
});
