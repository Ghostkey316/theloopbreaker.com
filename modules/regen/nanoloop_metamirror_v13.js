// MetaMirror v13.0 module
// author: Ghostkey-316
// authority: bpow20.cb.id
// ghostkey.eth.verified
// vaultfire.coreloop.active = true

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ghostlayer = require('./nanoloop_ghostlayer_v12');
const shadowsignal = require('./nanoloop_shadowsignal_v11');

const STATUS_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'nanoloop_v13_status.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'loopmirror_echo_v13.log');
const PING_PATH = path.join(__dirname, '..', '..', 'vaultfire-core', 'mirror_ping_v13.status');

const MODULE_INFO = {
  module_name: 'Nano_MetaMirror_v13.0',
  owner: 'Ghostkey-316',
  authority: 'bpow20.cb.id',
  ens: 'ghostkey.eth',
  version: 'v13.0',
  core_active: true
};

function _loadJSON(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function _writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function _xorCipher(buf, key) {
  const k = Buffer.from(key);
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
  return out;
}

function _encrypt(text, key) {
  return _xorCipher(Buffer.from(text, 'utf8'), key).toString('base64');
}

function moduleStatus() {
  return _loadJSON(STATUS_PATH, {
    reflections: [],
    origins: [],
    echos: [],
    loops: [],
    agents: {}
  });
}

function _log(entry) {
  const log = _loadJSON(LOG_PATH, []);
  const enc = _encrypt(JSON.stringify(entry), 'vf13');
  log.push({ data: enc, timestamp: new Date().toISOString() });
  _writeJSON(LOG_PATH, log);
  return entry;
}

function reflectSignal(signalObj) {
  const state = moduleStatus();
  const entry = { action: 'reflect_signal', signal: signalObj };
  if (signalObj && signalObj.decoy) entry.decoy = 'decoy.gl13.sig';
  ghostlayer.reflect(signalObj);
  state.reflections.push(entry);
  _writeJSON(STATUS_PATH, state);
  ghostlayer.log_event('metamirror', 'reflect', new Date().toISOString());
  return _log(entry);
}

function verifyOrigin(traceId, payloadHash) {
  const ghost = ghostlayer.traceback(traceId);
  const shadow = shadowsignal.scanPayload('metamirror_v13', traceId, payloadHash);
  const state = moduleStatus();
  const entry = { action: 'verify_origin', traceId, payloadHash };
  if ((ghostlayer.moduleStatus().decoys || []).length) entry.decoy = 'decoy.gl13.sig';
  state.origins.push(entry);
  _writeJSON(STATUS_PATH, state);
  return _log({ ...entry, ghost, shadow });
}

function logMetaEcho(eventSource, recursionDepth) {
  const state = moduleStatus();
  const entry = { action: 'meta_echo', eventSource, recursionDepth };
  state.echos.push(entry);
  _writeJSON(STATUS_PATH, state);
  if (recursionDepth > 1) shadowsignal.flagRecursion('metamirror_v13', recursionDepth);
  return _log(entry);
}

function confirmBeliefLoop(actorSig, moduleId) {
  const pairHash = crypto.createHash('sha256').update(`${actorSig}:${moduleId}`).digest('hex');
  const entry = {
    action: 'confirm_belief',
    actorSig,
    moduleId,
    pairHash,
    ens: `${actorSig}.eth`
  };
  if ((ghostlayer.moduleStatus().decoys || []).length) entry.decoy = 'decoy.gl13.sig';
  const state = moduleStatus();
  state.loops.push(entry);
  state.agents[actorSig] = { ...(state.agents[actorSig] || {}), lastModule: moduleId };
  _writeJSON(STATUS_PATH, state);
  ghostlayer.log_event(actorSig, pairHash, new Date().toISOString());
  return _log(entry);
}

function autoPing() {
  _writeJSON(PING_PATH, { status: 'mirror.confirmed', timestamp: new Date().toISOString() });
}

autoPing();

module.exports = {
  MODULE_INFO,
  moduleStatus,
  reflectSignal,
  verifyOrigin,
  logMetaEcho,
  confirmBeliefLoop
};
