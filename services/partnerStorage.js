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

function recordPartnerSaved(telemetry, provider, wallet) {
  if (telemetry && typeof telemetry.record === 'function') {
    telemetry.record('storage.partner.saved', { provider, wallet });
  }
}

class PostgresPartnerStorage extends BasePartnerStorage {
  constructor(options = {}) {
    super({ readOnly: false });
    this.tableName = options.tableName || 'vaultfire_partner_sync';
    this.connectionString =
      options.connectionString || options.url || process.env.VAULTFIRE_POSTGRES_URL || null;
    this.poolOptions = options.poolOptions || {};
    this.telemetry = options.telemetry || null;
    this.pg = options.pg || safeRequire('pg');
    if (!this.pg) {
      throw new Error('pg dependency is required for PostgresPartnerStorage.');
    }
    this.Pool = this.pg.Pool || this.pg;
    this.pool = null;
  }

  async init() {
    if (this.pool) {
      return;
    }
    const config = { ...this.poolOptions };
    if (this.connectionString) {
      config.connectionString = this.connectionString;
    }
    this.pool = new this.Pool(config);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        wallet TEXT PRIMARY KEY,
        ens TEXT,
        last_sync TIMESTAMPTZ,
        multiplier NUMERIC NOT NULL,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        config_overrides BOOLEAN DEFAULT FALSE,
        inserted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async listPartners() {
    await this.init();
    const result = await this.pool.query(
      `SELECT wallet, ens, last_sync, multiplier, tier, status, payload, config_overrides FROM ${this.tableName} ORDER BY last_sync DESC NULLS LAST`
    );
    return result.rows.map((row) => ({
      wallet: normalizeWallet(row.wallet),
      ens: row.ens,
      lastSync: row.last_sync || row.lastSync || null,
      multiplier: Number(row.multiplier),
      tier: row.tier,
      status: row.status,
      payload: row.payload || {},
      configOverrides: Boolean(row.config_overrides ?? row.configOverrides),
    }));
  }

  async savePartner(record) {
    await this.init();
    const normalizedWallet = normalizeWallet(record.wallet);
    const payload = JSON.stringify(record.payload || {});
    await this.pool.query(
      `
        INSERT INTO ${this.tableName} (wallet, ens, last_sync, multiplier, tier, status, payload, config_overrides)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        ON CONFLICT (wallet)
        DO UPDATE SET
          ens = EXCLUDED.ens,
          last_sync = EXCLUDED.last_sync,
          multiplier = EXCLUDED.multiplier,
          tier = EXCLUDED.tier,
          status = EXCLUDED.status,
          payload = EXCLUDED.payload,
          config_overrides = EXCLUDED.config_overrides
      `,
      [
        normalizedWallet,
        record.ens || null,
        record.lastSync || null,
        record.multiplier,
        record.tier,
        record.status,
        payload,
        Boolean(record.configOverrides),
      ]
    );
    recordPartnerSaved(this.telemetry, 'postgres', normalizeWallet(record.wallet));
    return {
      ...record,
      wallet: normalizedWallet,
    };
  }
}

class SupabasePartnerStorage extends BasePartnerStorage {
  constructor(options = {}) {
    super({ readOnly: false });
    this.tableName = options.tableName || 'vaultfire_partner_sync';
    this.url = options.url || process.env.SUPABASE_URL;
    this.serviceKey = options.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.telemetry = options.telemetry || null;
    const supabase = options.supabase || safeRequire('@supabase/supabase-js');
    this.createClient = options.createClient || supabase?.createClient || null;
    if (!this.url || !this.serviceKey) {
      throw new Error('Supabase URL and service key are required for SupabasePartnerStorage.');
    }
    if (typeof this.createClient !== 'function') {
      throw new Error('Supabase dependency is required for SupabasePartnerStorage.');
    }
    this.client = null;
  }

  async init() {
    if (this.client) {
      return;
    }
    this.client = this.createClient(this.url, this.serviceKey, { auth: { persistSession: false } });
  }

  async listPartners() {
    await this.init();
    const query = this.client
      .from(this.tableName)
      .select('wallet, ens, last_sync, multiplier, tier, status, payload, config_overrides')
      .order('last_sync', { ascending: false });
    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase listPartners failed: ${error.message}`);
    }
    return (data || []).map((row) => ({
      wallet: normalizeWallet(row.wallet),
      ens: row.ens,
      lastSync: row.last_sync || null,
      multiplier: Number(row.multiplier),
      tier: row.tier,
      status: row.status,
      payload: row.payload || {},
      configOverrides: Boolean(row.config_overrides),
    }));
  }

  async savePartner(record) {
    await this.init();
    const normalizedWallet = normalizeWallet(record.wallet);
    const payload = {
      wallet: normalizedWallet,
      ens: record.ens || null,
      last_sync: record.lastSync || null,
      multiplier: record.multiplier,
      tier: record.tier,
      status: record.status,
      payload: record.payload || {},
      config_overrides: Boolean(record.configOverrides),
    };
    const { error } = await this.client.from(this.tableName).upsert(payload, { onConflict: 'wallet' });
    if (error) {
      throw new Error(`Supabase savePartner failed: ${error.message}`);
    }
    recordPartnerSaved(this.telemetry, 'supabase', normalizedWallet);
    return {
      ...record,
      wallet: normalizedWallet,
    };
  }
}

function createPartnerStorage(options = {}) {
  const adapter = options.adapter || options.provider || null;
  if (adapter === 'memory') {
    return new MemoryPartnerStorage({ readOnly: !!options.readOnly });
  }

  if (adapter === 'postgres') {
    try {
      return new PostgresPartnerStorage({ ...options, ...(options.postgres || {}) });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Postgres adapter unavailable, falling back to memory partner storage:', error.message);
      return new MemoryPartnerStorage({ readOnly: true });
    }
  }

  if (adapter === 'supabase') {
    try {
      return new SupabasePartnerStorage({ ...options, ...(options.supabase || {}) });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Supabase adapter unavailable, falling back to memory partner storage:', error.message);
      return new MemoryPartnerStorage({ readOnly: true });
    }
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
  PostgresPartnerStorage,
  SupabasePartnerStorage,
};
