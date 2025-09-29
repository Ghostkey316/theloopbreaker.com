const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeKey(key) {
  const material = key || process.env.VAULTFIRE_ENCRYPTION_KEY || 'vaultfire-default-anchor-key';
  if (material.length === 32) {
    return Buffer.from(material, 'utf8');
  }
  if (material.length === 64 && /^[0-9a-fA-F]+$/.test(material)) {
    return Buffer.from(material, 'hex');
  }
  return crypto.createHash('sha256').update(material).digest();
}

function normalizeWallet(wallet) {
  return wallet ? wallet.toLowerCase() : wallet;
}

const BANNED_METADATA_KEYS = ['externalid', 'email', 'phone', 'kyc', 'passport', 'nationalid', 'biometric'];

function ensureWalletOnlyMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }
  const stack = [metadata];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }
    for (const key of Object.keys(current)) {
      const normalized = key.toLowerCase();
      if (BANNED_METADATA_KEYS.some((banned) => normalized.includes(banned))) {
        throw new Error(`metadata field '${key}' is not permitted. Wallet/ENS only.`);
      }
      const value = current[key];
      if (typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return metadata;
}

class MemoryProvider {
  constructor() {
    this.anchors = new Map();
  }

  async init() {}

  async upsert(anchorId, record) {
    this.anchors.set(anchorId, { ...record, updatedAt: new Date().toISOString() });
    return this.anchors.get(anchorId);
  }

  async getByAnchor(anchorId) {
    return this.anchors.get(anchorId) || null;
  }

  async findByWallet(walletHash) {
    const matches = [];
    for (const record of this.anchors.values()) {
      if (record.walletHash === walletHash) {
        matches.push(record);
      }
    }
    return matches;
  }
}

function requireModule(moduleName) {
  try {
    return require(moduleName);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `${moduleName} dependency is required to use this provider. Install it or switch providers.`
      );
    }
    throw error;
  }
}

/* istanbul ignore next */
class PostgresProvider {
  constructor(options = {}) {
    const { Pool } = requireModule('pg');
    this.pool = new Pool(options.connection || {});
    this.tableName = options.tableName || 'belief_identity_anchors';
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        anchor_id TEXT PRIMARY KEY,
        wallet_hash TEXT NOT NULL,
        ens_alias_hash TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async upsert(anchorId, record) {
    const query = {
      text: `
        INSERT INTO ${this.tableName} (anchor_id, wallet_hash, ens_alias_hash, payload, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (anchor_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
        RETURNING anchor_id, wallet_hash, ens_alias_hash, payload, updated_at;
      `,
      values: [anchorId, record.walletHash, record.ensAliasHash, record.payload],
    };
    const result = await this.pool.query(query);
    return {
      anchorId: result.rows[0].anchor_id,
      walletHash: result.rows[0].wallet_hash,
      ensAliasHash: result.rows[0].ens_alias_hash,
      payload: result.rows[0].payload,
      updatedAt: result.rows[0].updated_at,
    };
  }

  async getByAnchor(anchorId) {
    const result = await this.pool.query(
      `SELECT anchor_id, wallet_hash, ens_alias_hash, payload, updated_at FROM ${this.tableName} WHERE anchor_id = $1`,
      [anchorId]
    );
    if (!result.rowCount) {
      return null;
    }
    const row = result.rows[0];
    return {
      anchorId: row.anchor_id,
      walletHash: row.wallet_hash,
      ensAliasHash: row.ens_alias_hash,
      payload: row.payload,
      updatedAt: row.updated_at,
    };
  }

  async findByWallet(walletHash) {
    const result = await this.pool.query(
      `SELECT anchor_id, wallet_hash, ens_alias_hash, payload, updated_at FROM ${this.tableName} WHERE wallet_hash = $1`,
      [walletHash]
    );
    return result.rows.map((row) => ({
      anchorId: row.anchor_id,
      walletHash: row.wallet_hash,
      ensAliasHash: row.ens_alias_hash,
      payload: row.payload,
      updatedAt: row.updated_at,
    }));
  }
}

/* istanbul ignore next */
class MongoProvider {
  constructor(options = {}) {
    const { MongoClient } = requireModule('mongodb');
    const uri = options.connection?.uri || 'mongodb://localhost:27017/vaultfire';
    this.client = new MongoClient(uri, options.connection?.options || {});
    this.dbName = options.connection?.dbName || 'vaultfire';
    this.collectionName = options.collectionName || 'belief_identity_anchors';
  }

  async init() {
    if (!this.client.topology?.isConnected()) {
      await this.client.connect();
    }
    const collection = this.client.db(this.dbName).collection(this.collectionName);
    await collection.createIndex({ anchorId: 1 }, { unique: true });
    await collection.createIndex({ walletHash: 1 });
  }

  async upsert(anchorId, record) {
    const collection = this.client.db(this.dbName).collection(this.collectionName);
    const update = {
      $set: {
        walletHash: record.walletHash,
        ensAliasHash: record.ensAliasHash || null,
        payload: record.payload,
        updatedAt: new Date(),
      },
    };
    await collection.updateOne({ anchorId }, update, { upsert: true });
    return {
      anchorId,
      walletHash: record.walletHash,
      ensAliasHash: record.ensAliasHash || null,
      payload: record.payload,
      updatedAt: new Date().toISOString(),
    };
  }

  async getByAnchor(anchorId) {
    const collection = this.client.db(this.dbName).collection(this.collectionName);
    const doc = await collection.findOne({ anchorId });
    return doc;
  }

  async findByWallet(walletHash) {
    const collection = this.client.db(this.dbName).collection(this.collectionName);
    return collection.find({ walletHash }).toArray();
  }
}

class EncryptedIdentityStore {
  constructor({ provider = 'memory', encryptionKey, ...options } = {}, telemetry) {
    this.encryptionKey = normalizeKey(encryptionKey);
    this.telemetry = telemetry;
    switch (provider) {
      case 'postgres':
        this.provider = new PostgresProvider(options.postgres || {});
        break;
      case 'mongo':
      case 'mongodb':
        this.provider = new MongoProvider(options.mongo || options.mongodb || {});
        break;
      case 'memory':
      default:
        this.provider = new MemoryProvider();
    }
  }

  async init() {
    if (typeof this.provider.init === 'function') {
      await this.provider.init();
    }
  }

  #encrypt(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const json = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      content: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  #decrypt(blob) {
    const iv = Buffer.from(blob.iv, 'base64');
    const content = Buffer.from(blob.content, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  #anchorId(wallet, ensAlias) {
    const normalizedWallet = normalizeWallet(wallet);
    const normalizedEns = ensAlias ? ensAlias.toLowerCase() : 'anonymous';
    return sha256(`${normalizedWallet}:${normalizedEns}`);
  }

  async linkWallet({ wallet, ensAlias = null, beliefScore, metadata = {} }) {
    const normalizedWallet = normalizeWallet(wallet);
    if (!normalizedWallet) {
      throw new Error('wallet is required');
    }
    const normalizedEns = ensAlias ? ensAlias.toLowerCase() : null;
    const filteredMetadata = ensureWalletOnlyMetadata(metadata);
    const anchorId = this.#anchorId(normalizedWallet, normalizedEns);
    const payload = this.#encrypt({
      wallet: normalizedWallet,
      ensAlias: normalizedEns,
      beliefScore,
      metadata: filteredMetadata,
      updatedAt: new Date().toISOString(),
    });
    await this.provider.upsert(anchorId, {
      walletHash: sha256(normalizedWallet),
      ensAliasHash: normalizedEns ? sha256(normalizedEns) : null,
      payload,
    });

    const entry = { anchorId, wallet: normalizedWallet, ensAlias: normalizedEns, beliefScore, metadata: filteredMetadata };
    this.telemetry?.record('identity.anchor.linked', entry, {
      tags: ['identity', 'belief'],
      visibility: { partner: true, ethics: true, audit: true },
    });
    return entry;
  }

  async getWalletAnchor({ wallet, ensAlias = null }) {
    const normalizedWallet = normalizeWallet(wallet);
    if (!normalizedWallet) {
      return null;
    }
    const anchorId = this.#anchorId(normalizedWallet, ensAlias ? ensAlias.toLowerCase() : null);
    const record = await this.provider.getByAnchor(anchorId);
    if (!record) {
      return null;
    }
    const decrypted = this.#decrypt(record.payload);
    return { ...decrypted, anchorId };
  }

  async listByWallet(wallet) {
    const normalizedWallet = normalizeWallet(wallet);
    if (!normalizedWallet) {
      return [];
    }
    const walletHash = sha256(normalizedWallet);
    const records = await this.provider.findByWallet(walletHash);
    return records.map((record) => ({ ...this.#decrypt(record.payload), anchorId: record.anchorId || record.anchor_id }));
  }
}

module.exports = EncryptedIdentityStore;
