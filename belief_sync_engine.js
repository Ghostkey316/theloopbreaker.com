const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const GLOBAL_BUS = new EventEmitter();

const LOG_PATH = path.join(__dirname, 'fork_log.json');

function _loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function _writeLog(data) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
}

class BeliefSyncEngine extends EventEmitter {
  constructor(session_id, ghost_id) {
    super();
    this.session_id = session_id;
    this.ghost_id = ghost_id;
    GLOBAL_BUS.on('sync', e => {
      if (e.session_id === this.session_id && e.ghost_id !== this.ghost_id) {
        this.emit('sync', e);
      }
    });
  }

  syncChoice(belief_fork_id, choice) {
    const entry = {
      session_id: this.session_id,
      ghost_id: this.ghost_id,
      belief_fork_id,
      choice,
      timestamp: Date.now()
    };
    const log = _loadLog();
    log.push(entry);
    _writeLog(log);
    GLOBAL_BUS.emit('sync', entry);
    return entry;
  }

  getStats() {
    const log = _loadLog();
    const counts = {};
    for (const entry of log) {
      counts[entry.choice] = (counts[entry.choice] || 0) + 1;
    }
    return counts;
  }
}

module.exports = { BeliefSyncEngine };
