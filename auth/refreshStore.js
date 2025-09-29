const crypto = require('crypto');

class RefreshStore {
  constructor({ ttlMinutes = 60 } = {}) {
    this.tokens = new Map();
    this.ttlMinutes = ttlMinutes;
  }

  create(wallet, meta = {}) {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = Date.now() + this.ttlMinutes * 60 * 1000;
    this.tokens.set(token, { wallet, meta, expiresAt });
    return { token, expiresAt };
  }

  verify(token) {
    const entry = this.tokens.get(token);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    return entry;
  }

  revoke(token) {
    this.tokens.delete(token);
  }

  revokeByWallet(wallet) {
    for (const [token, entry] of this.tokens.entries()) {
      if (entry.wallet === wallet) {
        this.tokens.delete(token);
      }
    }
  }
}

module.exports = RefreshStore;
