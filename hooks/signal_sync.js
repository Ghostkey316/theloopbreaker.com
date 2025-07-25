const fs = require('fs');
const path = require('path');
const { detectSignals } = require('../signal_compass');

const FEEDBACK_PATH = path.join(__dirname, '..', 'agent_feedback.json');
const OUT_PATH = path.join(__dirname, '..', 'partner_signals.json');

function loadJSON(p, def){
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function writeJSON(p, data){
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function syncSignals(){
  const compass = detectSignals();
  const feedback = loadJSON(FEEDBACK_PATH, []);
  const merged = compass.concat(feedback);
  writeJSON(OUT_PATH, merged);
  return merged;
}

if(require.main === module){
  const data = syncSignals();
  console.log(JSON.stringify(data, null, 2));
}

module.exports = { syncSignals };
