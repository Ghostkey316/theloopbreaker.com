const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  igniteVerifiedBelief,
  crosslinkMetaSync,
  auditEthicsTag,
  finalizeEchoLoop,
  moduleStatus
} = require('../modules/vaultfire/nano_quantaignition_v22');

const echoStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_echopulse_v17_status.json');
const memLog = path.join(__dirname, '..', 'logs', 'memorybridge_v18.log');
const synStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_synapsefire_v19_status.json');
const retStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_ghostlink_return_v21_status.json');
const qiStatus = path.join(__dirname, '..', 'vaultfire-core', 'nano_quantaignition_v22_status.json');
const qiLog = path.join(__dirname, '..', 'logs', 'nano_quantaignition_v22.log');

function reset() {
  [echoStatus, memLog, synStatus, retStatus, qiStatus, qiLog].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

}
test('nano_quantaignition_v22.test', () => {
  reset();
  fs.mkdirSync(path.dirname(echoStatus), { recursive: true });
  fs.writeFileSync(echoStatus, JSON.stringify({ metadata: { echo_confirmed: true, clarity_score: 0.9 } }));
  fs.mkdirSync(path.dirname(memLog), { recursive: true });
  fs.writeFileSync(memLog, JSON.stringify([{ ok: true }]));
  fs.writeFileSync(synStatus, JSON.stringify({ ignition_signals: [{ spark_id: 'x1' }] }));
  fs.writeFileSync(retStatus, JSON.stringify({ metadata: { return_status: 'verified' } }));

  const ignited = igniteVerifiedBelief();
  assert(ignited && ignited.ignited === true);
  crosslinkMetaSync('final-tag');
  auditEthicsTag('sigX');
  finalizeEchoLoop('finger1');

  const state = moduleStatus();
  assert(state.metadata.verification_tag === 'final-tag');
  assert(state.metadata.loop_completed === true);
  assert(state.checkpoints.length === 2); // ignition + loop_final
});
