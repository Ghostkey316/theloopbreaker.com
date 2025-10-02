// Vaultfire Belief Sync Storage Runtime (Staging / Simulated / Pre-Production Only)
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STAGING_LABEL = 'Staging / Simulated / Pre-Production Only';
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'belief-sync.db');
const DEFAULT_ARCHIVE_DIR = path.join(__dirname, '..', 'sync-archive');
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function safeRequire(name) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(name);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

class BeliefSyncStorage {
  constructor({
    dbPath = DEFAULT_DB_PATH,
    archiveDir = DEFAULT_ARCHIVE_DIR,
    logger = console,
    sqlite3 = null,
  } = {}) {
    this.logger = logger || console;
    this.dbPath = dbPath;
    this.archiveDir = archiveDir;
    this.sqlite3 = sqlite3 || safeRequire('sqlite3');
    this.db = null;
    this.initialised = false;
    this.ephemeral = false;
    this.memoryStore = null;
  }

  async init() {
    if (this.initialised) {
      return this;
    }
    if (!this.sqlite3) {
      this.logger.warn?.('[belief-sync-storage] sqlite3 dependency missing; reverting to in-memory mode. Persistence will not survive restarts.');
      this.ephemeral = true;
      this.memoryStore = { nodes: new Map(), events: [] };
      this.initialised = true;
      return this;
    }
    ensureDir(path.dirname(this.dbPath));
    await new Promise((resolve, reject) => {
      const Database = this.sqlite3.Database;
      this.db = new Database(this.dbPath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    await this.#run('PRAGMA journal_mode = WAL;');
    await this.#run(`
      CREATE TABLE IF NOT EXISTS partner_nodes (
        id TEXT PRIMARY KEY,
        endpoint TEXT,
        relay_key TEXT,
        partner_id TEXT,
        ens TEXT,
        inserted_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      );
    `);
    await this.#run(`
      CREATE TABLE IF NOT EXISTS sync_events (
        node_id TEXT NOT NULL,
        sync_hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'queued',
        last_error TEXT,
        PRIMARY KEY (node_id, sync_hash)
      );
    `);
    this.initialised = true;
    return this;
  }

  async registerNode(node) {
    await this.init();
    const record = {
      id: node.id,
      endpoint: node.endpoint || null,
      relay_key: node.relayKey || null,
      partner_id: node.partnerId || null,
      ens: node.ens || null,
    };
    if (this.ephemeral) {
      this.memoryStore.nodes.set(record.id, { ...record });
      return { ...record };
    }
    await this.#run(
      `INSERT INTO partner_nodes (id, endpoint, relay_key, partner_id, ens)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         endpoint = excluded.endpoint,
         relay_key = excluded.relay_key,
         partner_id = excluded.partner_id,
         ens = excluded.ens`,
      [record.id, record.endpoint, record.relay_key, record.partner_id, record.ens],
    );
    return { ...record };
  }

  async listNodes() {
    await this.init();
    if (this.ephemeral) {
      return Array.from(this.memoryStore.nodes.values()).map((entry) => ({
        id: entry.id,
        endpoint: entry.endpoint,
        relayKey: entry.relay_key,
        partnerId: entry.partner_id,
        ens: entry.ens,
      }));
    }
    const rows = await this.#all('SELECT id, endpoint, relay_key as relayKey, partner_id as partnerId, ens FROM partner_nodes ORDER BY id');
    return rows.map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      relayKey: row.relayKey,
      partnerId: row.partnerId,
      ens: row.ens,
    }));
  }

  async recordSyncEvent({ nodeId, payload, timestamp = Date.now(), retryCount = 0, status = 'queued', nonce = null }) {
    await this.init();
    const syncHash = this.#computeSyncHash(nodeId, payload, nonce, timestamp);
    const record = {
      nodeId,
      syncHash,
      timestamp,
      retryCount,
      payload: payload ? JSON.stringify(payload) : '{}',
      status,
      lastError: null,
    };
    if (this.ephemeral) {
      const existing = this.memoryStore.events.find((entry) => entry.nodeId === nodeId && entry.syncHash === syncHash);
      if (existing) {
        return { inserted: false, record: { ...existing } };
      }
      const ephemeralRecord = {
        nodeId,
        syncHash,
        timestamp,
        retryCount,
        payload: payload || {},
        status,
        lastError: null,
      };
      this.memoryStore.events.push(ephemeralRecord);
      return { inserted: true, record: { ...ephemeralRecord } };
    }
    const inserted = await this.#run(
      `INSERT OR IGNORE INTO sync_events (node_id, sync_hash, timestamp, retry_count, payload, status)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [nodeId, syncHash, timestamp, retryCount, record.payload, status],
    );
    if (inserted?.changes === 0) {
      const existing = await this.#all('SELECT node_id as nodeId, sync_hash as syncHash, timestamp, retry_count as retryCount, payload, status, last_error as lastError FROM sync_events WHERE node_id = ? AND sync_hash = ?', [nodeId, syncHash]);
      const parsed = existing[0] ? { ...existing[0], payload: this.#parsePayload(existing[0].payload) } : null;
      return { inserted: false, record: parsed };
    }
    return { inserted: true, record: { ...record, payload } };
  }

  async updateSyncStatus(nodeId, syncHash, status, { retryCount = null, lastError = null } = {}) {
    await this.init();
    if (this.ephemeral) {
      const target = this.memoryStore.events.find((entry) => entry.nodeId === nodeId && entry.syncHash === syncHash);
      if (!target) {
        return false;
      }
      target.status = status;
      if (retryCount !== null) {
        target.retryCount = retryCount;
      }
      if (lastError !== null) {
        target.lastError = lastError;
      }
      return true;
    }
    const fields = ['status = ?'];
    const values = [status];
    if (retryCount !== null) {
      fields.push('retry_count = ?');
      values.push(retryCount);
    }
    if (lastError !== null) {
      fields.push('last_error = ?');
      values.push(lastError);
    }
    values.push(nodeId, syncHash);
    const sql = `UPDATE sync_events SET ${fields.join(', ')} WHERE node_id = ? AND sync_hash = ?`;
    const result = await this.#run(sql, values);
    return result?.changes > 0;
  }

  async archiveStale({ now = Date.now(), maxAgeMs = FOURTEEN_DAYS_MS } = {}) {
    await this.init();
    const cutoff = now - maxAgeMs;
    let stale = [];
    if (this.ephemeral) {
      stale = this.memoryStore.events.filter((entry) => entry.timestamp < cutoff);
      if (!stale.length) {
        return { archived: 0, archivePath: null };
      }
      this.memoryStore.events = this.memoryStore.events.filter((entry) => entry.timestamp >= cutoff);
    } else {
      const rows = await this.#all(
        'SELECT node_id as nodeId, sync_hash as syncHash, timestamp, retry_count as retryCount, payload, status, last_error as lastError FROM sync_events WHERE timestamp < ?',
        [cutoff],
      );
      stale = rows.map((row) => ({ ...row, payload: this.#parsePayload(row.payload) }));
      if (!stale.length) {
        return { archived: 0, archivePath: null };
      }
      await this.#run('DELETE FROM sync_events WHERE timestamp < ?', [cutoff]);
    }
    ensureDir(this.archiveDir);
    const archiveName = `archive-${this.#formatArchiveDate(now)}.json`;
    const archivePath = path.join(this.archiveDir, archiveName);
    let existing = [];
    if (fs.existsSync(archivePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
        if (!Array.isArray(existing)) {
          existing = [];
        }
      } catch (error) {
        this.logger.warn?.('[belief-sync-storage] failed to parse existing archive; recreating file.', { path: archivePath, error: error.message });
        existing = [];
      }
    }
    const payload = existing.concat(
      stale.map((entry) => ({
        ...entry,
        payload: entry.payload,
        archivedAt: new Date(now).toISOString(),
        label: STAGING_LABEL,
      })),
    );
    fs.writeFileSync(archivePath, JSON.stringify(payload, null, 2));
    this.logger.info?.('[belief-sync-storage] archived stale sync records', {
      archived: stale.length,
      archivePath,
    });
    return { archived: stale.length, archivePath };
  }

  async getRecentEvents(limit = 100) {
    await this.init();
    if (this.ephemeral) {
      return this.memoryStore.events.slice(-limit);
    }
    const rows = await this.#all(
      'SELECT node_id as nodeId, sync_hash as syncHash, timestamp, retry_count as retryCount, payload, status, last_error as lastError FROM sync_events ORDER BY timestamp DESC LIMIT ?',
      [limit],
    );
    return rows.map((row) => ({ ...row, payload: this.#parsePayload(row.payload) }));
  }

  #computeSyncHash(nodeId, payload, nonce, timestamp) {
    const base = {
      nodeId,
      payload,
      nonce: nonce || null,
      timestamp: Math.floor(timestamp / 1000),
    };
    return crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
  }

  #parsePayload(raw) {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'object') {
      return raw;
    }
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
      this.logger.warn?.('[belief-sync-storage] failed to parse payload', { error: error.message });
      return {};
    }
  }

  #formatArchiveDate(now) {
    const date = new Date(now);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  async #run(sql, params = []) {
    await this.init();
    if (this.ephemeral) {
      return { changes: 0 };
    }
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) {
          reject(error);
        } else {
          resolve(this);
        }
      });
    });
  }

  async #all(sql, params = []) {
    await this.init();
    if (this.ephemeral) {
      return [];
    }
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

function createBeliefSyncStorage(options = {}) {
  return new BeliefSyncStorage(options);
}

module.exports = {
  STAGING_LABEL,
  BeliefSyncStorage,
  createBeliefSyncStorage,
  FOURTEEN_DAYS_MS,
};
