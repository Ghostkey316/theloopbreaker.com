const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'memory_log.json');
const ETHICS_WORDS = ['truth', 'loyalty', 'wisdom', 'service', 'humanity'];

function _loadJSON(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function _writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function logAction(ghostId, sessionId, action, details = {}) {
  const log = _loadJSON(LOG_PATH, []);
  const entry = {
    ghost_id: ghostId,
    session_id: sessionId,
    action,
    details,
    timestamp: Date.now(),
  };
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  return entry;
}

function _vectorize(text, words) {
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/);
  return words.map(w => tokens.filter(t => t === w).length);
}

function _cosine(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
}

function alignmentScore(ghostId) {
  const log = _loadJSON(LOG_PATH, []);
  const text = log
    .filter(e => e.ghost_id === ghostId)
    .map(e => `${e.action} ${JSON.stringify(e.details)}`)
    .join(' ');
  const vec = _vectorize(text, ETHICS_WORDS);
  const ref = ETHICS_WORDS.map(() => 1);
  return _cosine(vec, ref);
}

module.exports = {
  logAction,
  alignmentScore,
  _loadJSON,
  _writeJSON,
};
