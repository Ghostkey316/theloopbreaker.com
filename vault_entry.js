const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'entry_log.json');
const PARTNERS_PATH = path.join(__dirname, 'partners.json');

function _loadJSON(p, def) {
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function _writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function login(user, role = 'player') {
  const allowed = ['player', 'dev', 'admin', 'AI'];
  if (!allowed.includes(role)) throw new Error('invalid role');
  const entry = {
    user,
    role,
    session_role: role,
    time: new Date().toISOString()
  };
  const log = _loadJSON(LOG_PATH, []);
  log.push(entry);
  _writeJSON(LOG_PATH, log);
  const forks = _loadJSON(PARTNERS_PATH, []).map(p => p.partner_id);
  return { session_role: role, forks };
}

if (require.main === module) {
  const user = process.argv[2] || 'guest';
  const role = process.argv[3] || 'player';
  try {
    const out = login(user, role);
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = { login };
