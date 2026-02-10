'use strict';

class MemoryNonceStore {
  constructor() {
    this._map = new Map();
  }

  /**
   * Atomically claim a nonce key.
   * @returns {Promise<boolean>} true if claimed (was unused), false if already used
   */
  async claim(key, ttlMs) {
    const now = Date.now();
    const existing = this._map.get(key);
    if (existing && existing > now) return false;

    const expiresAt = now + Math.max(1, Number(ttlMs) || 0);
    this._map.set(key, expiresAt);
    return true;
  }

  async seen(key) {
    const now = Date.now();
    const expiresAt = this._map.get(key);
    return Boolean(expiresAt && expiresAt > now);
  }

  async close() {}
}

class RedisNonceStore {
  /**
   * @param {{ url?: string, prefix?: string, client?: any }}
   */
  constructor({ url, prefix = 'vaultfire:erc8128:nonce:', client } = {}) {
    this.prefix = prefix;
    if (client) {
      this.client = client;
    } else {
      const { createClient } = require('redis');
      this.client = createClient({ url: url || process.env.VAULTFIRE_REDIS_URL || undefined });
      this._needsConnect = true;
    }
  }

  async _ensureConnected() {
    if (!this._needsConnect) return;
    if (this.client.isOpen) {
      this._needsConnect = false;
      return;
    }
    await this.client.connect();
    this._needsConnect = false;
  }

  _k(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Atomically claim a nonce key via SET NX PX.
   */
  async claim(key, ttlMs) {
    await this._ensureConnected();
    const k = this._k(key);
    const ttl = Math.max(1, Number(ttlMs) || 1);
    const res = await this.client.set(k, '1', { NX: true, PX: ttl });
    return res === 'OK';
  }

  async seen(key) {
    await this._ensureConnected();
    const k = this._k(key);
    const v = await this.client.get(k);
    return v !== null;
  }

  async close() {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
    }
  }
}

module.exports = {
  MemoryNonceStore,
  RedisNonceStore,
};
