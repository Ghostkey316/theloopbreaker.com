const { MongoClient } = require('mongodb');
const { logger } = require('../logging');

class MongoWalletStore {
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
    if (!this.client.topology || !this.client.topology.isConnected()) {
      await this.client.connect();
    }
    const collection = this.client.db(this.dbName).collection(this.collectionName);
    await collection.createIndex({ wallet: 1 }, { unique: true });
    await collection.createIndex({ lastSeen: -1 });
    this.initialised = true;
  }

  #collection() {
    if (!this.initialised) {
      throw new Error('MongoWalletStore not initialised');
    }
    return this.client.db(this.dbName).collection(this.collectionName);
  }

  async getWallet(walletId) {
    try {
      const collection = this.#collection();
      const normalized = walletId.toLowerCase();
      return collection.findOne({ wallet: normalized });
    } catch (error) {
      logger.error('identity.store.mongo_failure', { walletId, error: error.message });
      throw error;
    }
  }

  async upsertWallet(wallet) {
    const collection = this.#collection();
    const normalized = wallet.wallet.toLowerCase();
    await collection.updateOne({ wallet: normalized }, { $set: { ...wallet, wallet: normalized } }, { upsert: true });
    return this.getWallet(normalized);
  }

  async close() {
    if (this.client && this.client.topology && this.client.topology.isConnected()) {
      await this.client.close();
    }
  }
}

module.exports = {
  MongoWalletStore,
};
