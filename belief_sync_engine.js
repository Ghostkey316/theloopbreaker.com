const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

const { createFingerprint } = require('./services/originFingerprint');
const { RetryRelayHandler } = require('./services/retryRelayHandler');
const { createSignalRelay } = require('./services/signalRelay');

const GLOBAL_BUS = new EventEmitter();

const LOG_PATH = path.join(__dirname, 'fork_log.json');
const PARTNER_NODE_PATH = path.join(__dirname, 'partner_port', 'external_nodes.json');
const RELAY_DIR = path.join(__dirname, 'logs', 'partner_relays');
const RETRY_SCHEDULE_PATH = path.join(RELAY_DIR, 'retry-schedule.json');

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

function _loadPartnerNodes() {
  if (!fs.existsSync(PARTNER_NODE_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PARTNER_NODE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function _writePartnerNodes(nodes) {
  const dir = path.dirname(PARTNER_NODE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PARTNER_NODE_PATH, JSON.stringify(nodes, null, 2));
}

function _ensureRelayDir() {
  if (!fs.existsSync(RELAY_DIR)) {
    fs.mkdirSync(RELAY_DIR, { recursive: true });
  }
}

function _encryptRelayPayload(entry, key) {
  if (!key) {
    return { mode: 'plain', payload: Buffer.from(JSON.stringify(entry)).toString('base64') };
  }
  try {
    const secret = crypto.createHash('sha256').update(String(key)).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(entry), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      mode: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      payload: ciphertext.toString('base64'),
    };
  } catch (error) {
    return { mode: 'plain', payload: Buffer.from(JSON.stringify(entry)).toString('base64') };
  }
}

function _writeRelayFallback(node, entry) {
  _ensureRelayDir();
  const relayPath = path.join(RELAY_DIR, `${node.id || node.partnerId || 'partner'}.jsonl`);
  const record = {
    timestamp: new Date().toISOString(),
    node: node.id || node.partnerId || 'unknown',
    encrypted: _encryptRelayPayload(entry, node.relayKey),
  };
  fs.appendFileSync(relayPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
  return record;
}

class BeliefSyncEngine extends EventEmitter {
  constructor(session_id, ghost_id) {
    super();
    this.session_id = session_id;
    this.ghost_id = ghost_id;
    this.partnerNodes = _loadPartnerNodes();
    this.signalRelay = createSignalRelay({
      queueFilePath: RETRY_SCHEDULE_PATH,
      fallbackWriter: (node, payload) => {
        try {
          _writeRelayFallback(node, payload);
        } catch (error) {
          // ignore fallback write errors to keep relay attempts non-blocking
        }
      },
      nowFn: () => Date.now(),
      retryHandler: new RetryRelayHandler({
        maxAttempts: 3,
        baseDelayMs: 30_000,
        maxDelayMs: 15 * 60 * 1000,
        scheduler: (cb) => cb(),
      }),
    });
    GLOBAL_BUS.on('sync', e => {
      if (e.session_id === this.session_id && e.ghost_id !== this.ghost_id) {
        this.emit('sync', e);
      }
    });
  }

  registerExternalNode(node) {
    const nodes = _loadPartnerNodes();
    const sanitized = {
      id: node.id || node.partnerId || crypto.randomUUID(),
      endpoint: node.endpoint || null,
      relayKey: node.relayKey || null,
      partnerId: node.partnerId || null,
      ens: node.ens || null,
    };
    const existingIndex = nodes.findIndex(n => n.id === sanitized.id);
    if (existingIndex >= 0) {
      nodes[existingIndex] = sanitized;
    } else {
      nodes.push(sanitized);
    }
    _writePartnerNodes(nodes);
    this.partnerNodes = nodes;
    return sanitized;
  }

  #originPayload(options = {}) {
    const ensAlias = options.originEns || null;
    const fingerprint = createFingerprint({ wallet: this.ghost_id, ens: ensAlias });
    return {
      wallet: this.ghost_id,
      ens: ensAlias,
      fingerprint: fingerprint.fingerprint,
      method: fingerprint.method,
    };
  }

  async #broadcast(entry) {
    const payload = { ...entry };
    if (!this.partnerNodes.length) {
      return;
    }
    await Promise.all(
      this.partnerNodes.map(async (node) => {
        await this.signalRelay.dispatch(node, payload, {
          telemetryId: entry.session_id,
        });
      })
    );
  }

  syncChoice(belief_fork_id, choice, options = {}) {
    const entry = {
      session_id: this.session_id,
      ghost_id: this.ghost_id,
      belief_fork_id,
      choice,
      origin: this.#originPayload(options),
      timestamp: Date.now()
    };
    const log = _loadLog();
    log.push(entry);
    _writeLog(log);
    GLOBAL_BUS.emit('sync', entry);
    this.#broadcast(entry).catch(() => {});
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

  async processRetryQueue({ now = Date.now(), maxAttempts = 5 } = {}) {
    return this.signalRelay.retry({ now, maxAttempts });
  }
}

module.exports = { BeliefSyncEngine };
