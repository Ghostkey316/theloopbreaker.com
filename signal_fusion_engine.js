const fs = require('fs');
const path = require('path');

function loadJSON(p, def){
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function writeJSON(p, data){
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function normalize(vec){
  const sum = vec.reduce((a,b) => a + b, 0) || 1;
  return vec.map(v => +(v / sum).toFixed(3));
}

function fuseSignals(){
  const compass = loadJSON(path.join(__dirname, 'signal_compass.json'), []);
  const partner = loadJSON(path.join(__dirname, 'partner_signals.json'), []);
  const ghost = loadJSON(path.join(__dirname, 'ghost_test_sim.json'), []);
  const combined = compass.concat(partner, ghost);
  const map = {};
  combined.forEach(sig => {
    const key = `${sig.ghost_id}|${sig.session_id}`;
    const vec = normalize(sig.vector || [0,0,0,0]);
    if(!map[key]){
      map[key] = { ghost_id: sig.ghost_id, session_id: sig.session_id, vectors: [] };
    }
    map[key].vectors.push(vec);
  });
  const fused = Object.values(map).map(entry => {
    const len = entry.vectors.length;
    const dims = entry.vectors[0].length;
    const sum = Array(dims).fill(0);
    entry.vectors.forEach(v => v.forEach((n,i) => sum[i] += n));
    const avg = sum.map(n => +(n / len).toFixed(3));
    return { ghost_id: entry.ghost_id, session_id: entry.session_id, vector: avg };
  });
  writeJSON(path.join(__dirname, 'fused_signals.json'), fused);
  return fused;
}

if(require.main === module){
  const data = fuseSignals();
  console.log(JSON.stringify(data, null, 2));
}

module.exports = { fuseSignals };
