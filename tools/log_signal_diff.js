const fs = require('fs');
const path = require('path');

const FUSED_PATH = path.join(__dirname, '..', 'fused_signals.json');
const LOG_PATH = path.join(__dirname, '..', 'signal_diff_log.json');

function loadJSON(p, def){
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function writeJSON(p, data){
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function diffSignals(){
  const fused = loadJSON(FUSED_PATH, []);
  const log = loadJSON(LOG_PATH, []);
  const last = log.length ? log[log.length - 1].data : [];
  const diff = fused.filter(x => !last.find(y => y.ghost_id === x.ghost_id && y.session_id === x.session_id));
  const entry = {
    timestamp: new Date().toISOString(),
    new_signals: diff,
    data: fused
  };
  log.push(entry);
  writeJSON(LOG_PATH, log);
  return entry;
}

if(require.main === module){
  console.log(JSON.stringify(diffSignals(), null, 2));
}

module.exports = { diffSignals };
