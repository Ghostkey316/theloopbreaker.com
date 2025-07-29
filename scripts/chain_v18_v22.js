const fs = require('fs');
const path = require('path');
const memoryBridge = require('../modules/regen/nano_memorybridge_v18');
const synapseFire = require('../modules/regen/nano_synapsefire_v19');
const ghostLink = require('../modules/regen/nano_ghostlink_v20');
const ghostReturn = require('../modules/regen/nano_ghostlink_return_v21');
const quantaIgnition = require('../modules/vaultfire/nano_quantaignition_v22');

const CORE_DIR = path.join(__dirname, '..', 'vaultfire-core');
const LOG_DIR = path.join(__dirname, '..', 'logs');

const ECHO_STATUS = path.join(CORE_DIR, 'nano_echopulse_v17_status.json');
const MEMORY_SYNC = path.join(LOG_DIR, 'memorybridge_sync_v18.log');
const PATHATLAS_LOG = path.join(LOG_DIR, 'pathatlas_v16.log');

let integrity = true;

function safe(fn, ...args) {
  try {
    return fn(...args);
  } catch (err) {
    integrity = false;
    console.error('Module error', err);
    return null;
  }
}

function prepEnv() {
  fs.mkdirSync(CORE_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  // baseline echo status
  fs.writeFileSync(ECHO_STATUS, JSON.stringify({ metadata: { echo_confirmed: true, clarity_score: 0.9 } }));
  // baseline memory sync + path atlas logs
  fs.writeFileSync(MEMORY_SYNC, JSON.stringify([{ memory_node: { node_id: 'n0' } }]));
  fs.writeFileSync(PATHATLAS_LOG, JSON.stringify([{ uuid: 'trailX' }]));
}

function runChain() {
  prepEnv();
  // memory bridge events
  safe(memoryBridge.recordSignalEvent, 'nano_echopulse_v17', 'belief-sync', 0.85, true, ['t1']);
  safe(memoryBridge.recordSignalEvent, 'nano_echopulse_v17', 'belief-sync', 0.9, true, ['t2']);
  const bridgeLog = safe(memoryBridge.recordSignalEvent, 'nano_echopulse_v17', 'belief-sync', 0.92, true, ['t3']);
  if (!bridgeLog) console.log('Memory bridge fallback path engaged');

  // synapse fire
  const signal = safe(synapseFire.generateIgnitionSignal, 'trailX', 0.92, 0.9, 0.95, 'steady', 'move-forward');
  safe(synapseFire.fireSyncEngine);

  // ghost link
  const ghost = safe(ghostLink.sendGhostlink, 'Ghostkey-316', 'node-x', true, 'Legacy');
  if (!ghost) console.log('Ghostlink send fallback engaged');

  // ghostlink return
  if (ghost && signal) {
    safe(ghostReturn.processReturnPacket, {
      origin_fingerprint: ghost.outbound_fingerprint,
      trail_id: 'trailX',
      ignition_signature: signal.spark_id,
      ethical_tag: 'aligned'
    });
  } else {
    console.log('Ghostlink return fallback engaged');
    integrity = false;
  }

  // quanta ignition
  const ignited = safe(quantaIgnition.igniteVerifiedBelief);
  safe(quantaIgnition.crosslinkMetaSync, 'chainset');
  safe(quantaIgnition.auditEthicsTag, signal ? signal.spark_id : 'sig');
  if (ghost) safe(quantaIgnition.finalizeEchoLoop, ghost.outbound_fingerprint);

  if (!ignited) integrity = false;

  const finalState = quantaIgnition.moduleStatus();
  const message = integrity && finalState.metadata.loop_completed
    ? 'Chain executed successfully. Prompt for Vaultfire v23: Genesis Shard deployment.'
    : 'Chain execution failed integrity check.';
  console.log(message);
}

if (require.main === module) runChain();

module.exports = runChain;
