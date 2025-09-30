const fs = require('fs');
const path = require('path');
const { normalizeWallet } = require('../utils/walletAuth');

function safeRequire(moduleName) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(moduleName);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

class BasePartnerStorage {
  constructor({ readOnly = false } = {}) {
    this.readOnly = readOnly;
  }

  async init() {
    return undefined;
  }

  async listPartners() {
    throw new Error('listPartners not implemented');
  }

  async getPartner(wallet) {
    const partners = await this.listPartners();
    return partners.find((item) => item.wallet.toLowerCase() === wallet.toLowerCase()) || null;
  }

  async savePartner() {
    throw new Error('savePartner not implemented');
  }
}

class MemoryPartnerStorage extends BasePartnerStorage {
  constructor({ readOnly = true } = {}) {
    super({ readOnly });
    this.partners = new Map();
    this.warned = false;
  }

  #warnIfEphemeral() {
    if (!this.readOnly || this.warned) {
      return;
    }
    this.warned = true;
    // eslint-disable-next-line no-console
    console.warn('Vaultfire partner storage running in read-only memory mode. State will not persist.');
  }

  async listPartners() {
    return Array.from(this.partners.values());
  }

  async savePartner(record) {
    this.#warnIfEphemeral();
    this.partners.set(record.wallet.toLowerCase(), { ...record });
    return record;
  }
}

class SQLitePartnerStorage extends BasePartnerStorage {
  constructor(options = {}) {
    super({ readOnly: false });
    this.dbPath = options.dbPath || path.join(__dirname, '..', 'data', 'partner-sync.db');
    this.sqlite3 = safeRequire('sqlite3');
    if (!this.sqlite3) {
      throw new Error('sqlite3 dependency is required for SQLitePartnerStorage.');
    }
    this.db = null;
  }

  async init() {
    if (this.db) return;
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    await new Promise((resolve, reject) => {
      const Database = this.sqlite3.Database;
      this.db = new Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await this.#run('PRAGMA journal_mode = WAL;');
    await this.#run(`
      CREATE TABLE IF NOT EXISTS partners (
        wallet TEXT PRIMARY KEY,
        ens TEXT,
        last_sync TEXT,
        multiplier REAL NOT NULL,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        config_overrides INTEGER DEFAULT 0,
        inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async #run(sql, params = []) {
    await this.init();
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async #all(sql, params = []) {
    await this.init();
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async listPartners() {
    const rows = await this.#all(
      'SELECT wallet, ens, last_sync as lastSync, multiplier, tier, status, payload, config_overrides as configOverrides FROM partners ORDER BY datetime(last_sync) DESC'
    );
    return rows.map((row) => ({
      wallet: row.wallet,
      ens: row.ens,
      lastSync: row.lastSync,
      multiplier: Number(row.multiplier),
      tier: row.tier,
      status: row.status,
      payload: JSON.parse(row.payload),
      configOverrides: Boolean(row.configOverrides),
    }));
  }

  async savePartner(record) {
    const normalizedWallet = normalizeWallet(record.wallet);
    const payload = JSON.stringify(record.payload || {});
    await this.#run(
      `
        INSERT INTO partners (wallet, ens, last_sync, multiplier, tier, status, payload, config_overrides)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(wallet)
        DO UPDATE SET
          ens = excluded.ens,
          last_sync = excluded.last_sync,
          multiplier = excluded.multiplier,
          tier = excluded.tier,
          status = excluded.status,
          payload = excluded.payload,
          config_overrides = excluded.config_overrides
      `,
      [
        normalizedWallet,
        record.ens || null,
        record.lastSync,
        record.multiplier,
        record.tier,
        record.status,
        payload,
        record.configOverrides ? 1 : 0,
      ]
    );
    return {
      ...record,
      wallet: normalizedWallet,
    };
  }
}

class LocalForagePartnerStorage extends BasePartnerStorage {
  constructor(options = {}) {
    super({ readOnly: false });
    const localforage = safeRequire('localforage');
    if (!localforage) {
      throw new Error('localforage dependency is required for browser storage.');
    }
    this.store = localforage.createInstance({
      name: options.name || 'vaultfire',
      storeName: options.storeName || 'partnerSync',
    });
  }

  async listPartners() {
    const partners = (await this.store.getItem('partners')) || {};
    return Object.values(partners);
  }

  async savePartner(record) {
    const partners = (await this.store.getItem('partners')) || {};
    partners[record.wallet.toLowerCase()] = { ...record };
    await this.store.setItem('partners', partners);
    return record;
  }
}

function createPartnerStorage(options = {}) {
  const adapter = options.adapter || options.provider || null;
  if (adapter === 'memory') {
    return new MemoryPartnerStorage({ readOnly: !!options.readOnly });
  }

  if (adapter === 'localforage' || (typeof window !== 'undefined' && window.indexedDB)) {
    try {
      return new LocalForagePartnerStorage(options.localforage || {});
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Falling back to memory partner storage:', error.message);
      return new MemoryPartnerStorage({ readOnly: true });
    }
  }

  try {
    return new SQLitePartnerStorage(options.sqlite || {});
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('SQLite adapter unavailable, falling back to memory partner storage:', error.message);
    return new MemoryPartnerStorage({ readOnly: true });
  }
}

module.exports = {
  createPartnerStorage,
  MemoryPartnerStorage,
  SQLitePartnerStorage,
  LocalForagePartnerStorage,
};
