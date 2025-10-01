const { MongoClient } = require('mongodb');
const { logger } = require('../logging');

class MongoWalletStore {
  #connectPromise = null;
  #setupPromise = null;

  constructor(options = {}) {
    const {
      uri = process.env.VAULTFIRE_IDENTITY_MONGO_URI || 'mongodb://localhost:27017/vaultfire',
      dbName = process.env.VAULTFIRE_IDENTITY_DB || 'vaultfire',
      collection = process.env.VAULTFIRE_IDENTITY_COLLECTION || 'identity_wallets',
    } = options;
    this.client = options.client || new MongoClient(uri, options.clientOptions || {});
    this.dbName = dbName;
    this.collectionName = collection;
    this.initialised = false;
  }

  async init() {
    if (!this.#connectPromise) {
      this.#connectPromise = this.client.connect().catch((error) => {
        this.#connectPromise = null;
        throw error;
      });
    }

    await this.#connectPromise;

    if (!this.#setupPromise) {
      this.#setupPromise = (async () => {
        const collection = this.client.db(this.dbName).collection(this.collectionName);
        await Promise.all([
          collection.createIndex({ wallet: 1 }, { unique: true }),
          collection.createIndex({ lastSeen: -1 }),
        ]);

        this.initialised = true;
      })().catch((error) => {
        this.#setupPromise = null;
        throw error;
      });
    }

    await this.#setupPromise;
  }

  #normalizeWalletId(walletId) {
    if (typeof walletId !== 'string') {
      throw new TypeError('walletId must be a non-empty string');
    }

    const trimmed = walletId.trim();
    if (!trimmed) {
      throw new TypeError('walletId must be a non-empty string');
    }

    return trimmed.toLowerCase();
  }

  #collection() {
    if (!this.initialised) {
      throw new Error('MongoWalletStore not initialised');
    }
    return this.client.db(this.dbName).collection(this.collectionName);
  }

  async getWallet(walletId) {
    const normalized = this.#normalizeWalletId(walletId);

    try {
      const collection = this.#collection();
      return await collection.findOne({ wallet: normalized });
    } catch (error) {
      logger.error('identity.store.mongo_failure', { walletId: normalized, error: error.message });
      throw error;
    }
  }

  async upsertWallet(wallet) {
    if (!wallet || typeof wallet.wallet === 'undefined') {
      throw new TypeError('wallet payload must include a wallet identifier');
    }

    const normalized = this.#normalizeWalletId(wallet.wallet);
    const collection = this.#collection();

    await collection.updateOne(
      { wallet: normalized },
      { $set: { ...wallet, wallet: normalized } },
      { upsert: true },
    );

    return this.getWallet(normalized);
  }

  async close() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.close();
    } finally {
      this.initialised = false;
      this.#connectPromise = null;
      this.#setupPromise = null;
    }
  }
}

module.exports = {
  MongoWalletStore,
};
