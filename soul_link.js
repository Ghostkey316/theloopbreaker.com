// SoulLink module: enable verified users to secure AI co-ownership pacts
// Reference: ethics/core.mdx

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCORECARD_PATH = path.join(__dirname, 'user_scorecard.json');
const EVENT_LOG_PATH = path.join(__dirname, 'event_log.json');
const PACT_PATH = path.join(__dirname, 'soul_pacts.json');
const EMOTION_DIR = path.join(__dirname, 'logs', 'emotion_state');

function _loadJSON(p, def) {
  if (!fs.existsSync(p)) return def;
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

function isVerified(userId) {
  const scorecard = _loadJSON(SCORECARD_PATH, {});
  const user = scorecard[userId];
  if (!user) return false;
  return Number(user.contributor_score) >= 10;
}

function completedBeliefLoop(userId) {
  const events = _loadJSON(EVENT_LOG_PATH, []);
  let submitted = false;
  let completed = false;
  for (const e of events) {
    if (e.user_id !== userId) continue;
    if (e.action === 'submit_belief') submitted = true;
    if (e.action === 'mission_complete') completed = true;
  }
  return submitted && completed;
}

function _hashId(id) {
  return crypto.createHash('sha256').update(id).digest('hex');
}

function emotionHistory(userId) {
  const file = path.join(EMOTION_DIR, `${_hashId(userId)}.json`);
  const data = _loadJSON(file, { entries: [] });
  return data.entries || [];
}

function issuePact(userId) {
  const scorecard = _loadJSON(SCORECARD_PATH, {});
  const info = scorecard[userId] || {};
  const pactStore = _loadJSON(PACT_PATH, []);
  const found = pactStore.find(p => p.user_id === userId);
  if (found) return found;
  const timestamp = new Date().toISOString();
  const pactId = _hashId(userId + timestamp);
  const pact = {
    user_id: userId,
    wallet: info.wallet || null,
    timestamp,
    pact_id: pactId,
    extended_memory: true,
    custom_protocol: true,
    private_logs: []
  };
  pactStore.push(pact);
  _writeJSON(PACT_PATH, pactStore);
  return pact;
}

function reflectionMessage(userId) {
  const emotions = emotionHistory(userId);
  const last = emotions.length ? emotions[emotions.length - 1].emotion : 'neutral';
  return `Your recent mood is ${last}. Stay true to your purpose.`;
}

function createSoulLink(userId) {
  if (!isVerified(userId)) {
    throw new Error('Access denied: user not verified');
  }
  if (!completedBeliefLoop(userId)) {
    throw new Error('Belief loop incomplete');
  }
  const pact = issuePact(userId);
  const reflection = reflectionMessage(userId);
  return { pact, reflection };
}

if (require.main === module) {
  const [uid] = process.argv.slice(2);
  if (!uid) {
    console.error('Usage: node soul_link.js <user_id>');
    process.exit(1);
  }
  try {
    const result = createSoulLink(uid);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = {
  isVerified,
  completedBeliefLoop,
  issuePact,
  reflectionMessage,
  createSoulLink,
};

