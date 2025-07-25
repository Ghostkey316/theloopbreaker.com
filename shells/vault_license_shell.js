const fs = require('fs');
const path = require('path');

const FUSED_PATH = path.join(__dirname, '..', 'fused_signals.json');
const PARTNERS_PATH = path.join(__dirname, '..', 'partners.json');
const OUT_PATH = path.join(__dirname, '..', 'license_shell_log.json');

function loadJSON(p, def){
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function writeJSON(p, data){
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function validateLicense(){
  const fused = loadJSON(FUSED_PATH, []);
  const partners = loadJSON(PARTNERS_PATH, []).map(p => p.partner_id);
  const aligned = fused.every(f => partners.includes('sandbox_partner') || partners.includes(f.ghost_id));
  const overlaySync = fused.length > 0;
  const entry = {
    timestamp: new Date().toISOString(),
    aligned,
    overlay_sync: overlaySync
  };
  const log = loadJSON(OUT_PATH, []);
  log.push(entry);
  writeJSON(OUT_PATH, log);
  return entry;
}

if(require.main === module){
  const result = validateLicense();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { validateLicense };
