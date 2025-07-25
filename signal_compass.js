const fs = require('fs');
const path = require('path');

const MEM_PATH = path.join(__dirname, 'memory_log.json');
const OUT_PATH = path.join(__dirname, 'signal_compass.json');

const WORD_MAP = {
  trust: ['trust', 'confidence', 'loyalty'],
  doubt: ['doubt', 'uncertain', 'skeptical'],
  conviction: ['conviction', 'belief', 'certain'],
  fear: ['fear', 'concern', 'worry'],
};

function loadJSON(p, def){
  try{ return JSON.parse(fs.readFileSync(p, 'utf8')); }catch{ return def; }
}

function writeJSON(p, data){
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function tokenize(text){
  return text.toLowerCase().split(/[^a-z0-9]+/);
}

function detectSignals(){
  const mem = loadJSON(MEM_PATH, []);
  const bySession = {};
  mem.forEach(e => {
    const key = `${e.ghost_id}|${e.session_id}`;
    const text = `${e.action} ${JSON.stringify(e.details)}`;
    bySession[key] = (bySession[key] || '') + ' ' + text;
  });

  const results = [];
  for(const key of Object.keys(bySession)){
    const [ghost, session] = key.split('|');
    const text = bySession[key];
    const counts = ['trust','doubt','conviction','fear'].map(k => {
      const tokens = tokenize(text);
      return WORD_MAP[k].reduce((sum,w)=> sum + tokens.filter(t=>t===w).length,0);
    });
    const total = counts.reduce((a,b)=>a+b,0) || 1;
    const vec = counts.map(c => +(c/total).toFixed(3));
    results.push({ ghost_id: ghost, session_id: session, vector: vec });
  }
  writeJSON(OUT_PATH, results);
  return results;
}

if(require.main === module){
  const data = detectSignals();
  console.log(JSON.stringify(data, null, 2));
}

module.exports = { detectSignals };
