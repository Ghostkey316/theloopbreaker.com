'use strict';

const crypto = require('crypto');

class DriftLogger {
  constructor({ clock = () => new Date() } = {}) {
    this._clock = clock;
    this._entries = new Map();
    this._aliases = new Map();
  }

  _identifierKey({ userId, wallet }) {
    if (!userId && !wallet) {
      throw new Error('Either userId or wallet must be provided for drift logging.');
    }

    if (userId && wallet) {
      return `user:${userId}|wallet:${wallet}`;
    }

    if (userId) {
      return `user:${userId}`;
    }

    return `wallet:${wallet}`;
  }

  _hashIdentifier(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  _alias(identifier, hash) {
    if (!identifier) return;
    this._aliases.set(identifier, hash);
  }

  _ensureEntry(hash, { userId, wallet }) {
    if (!this._entries.has(hash)) {
      this._entries.set(hash, {
        identifierHash: hash,
        userId: userId || null,
        wallet: wallet || null,
        lastInteraction: null,
        lastInteractionType: null,
        driftTimeMs: 0,
        driftTimeHours: 0,
        history: [],
      });
    }

    return this._entries.get(hash);
  }

  logInteraction({ userId, wallet, interactionType, timestamp }) {
    const key = this._identifierKey({ userId, wallet });
    const hash = this._hashIdentifier(key);
    const entry = this._ensureEntry(hash, { userId, wallet });
    const eventTime = this._coerceTimestamp(timestamp);

    const deltaMs = entry.lastInteraction
      ? Math.max(0, eventTime.getTime() - entry.lastInteraction.getTime())
      : 0;

    entry.driftTimeMs = deltaMs;
    entry.driftTimeHours = Number((deltaMs / 3_600_000).toFixed(6));
    entry.lastInteraction = eventTime;
    entry.lastInteractionType = interactionType || null;

    entry.history.push({
      interactionType: interactionType || 'unknown',
      timestamp: eventTime.toISOString(),
      driftTimeHours: entry.driftTimeHours,
    });

    this._alias(`user:${userId}`, hash);
    this._alias(`wallet:${wallet}`, hash);

    return this._cloneEntry(entry);
  }

  calculateDriftSince({ userId, wallet, referenceTime }) {
    const entry = this.getEntry({ userId, wallet });
    if (!entry || !entry.lastInteraction) {
      return 0;
    }

    const reference = this._coerceTimestamp(referenceTime ?? this._clock());
    const deltaMs = Math.max(0, reference.getTime() - new Date(entry.lastInteraction).getTime());
    return Number((deltaMs / 3_600_000).toFixed(6));
  }

  getEntry({ userId, wallet }) {
    const identifiers = [];
    if (userId) identifiers.push(`user:${userId}`);
    if (wallet) identifiers.push(`wallet:${wallet}`);

    for (const identifier of identifiers) {
      const hash = this._aliases.get(identifier);
      if (hash && this._entries.has(hash)) {
        return this._cloneEntry(this._entries.get(hash));
      }
    }

    return null;
  }

  entries() {
    return Array.from(this._entries.values()).map((entry) => this._cloneEntry(entry));
  }

  toJSON() {
    return this.entries();
  }

  _coerceTimestamp(input) {
    if (!input) {
      return this._clock();
    }

    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid timestamp provided to DriftLogger.');
    }

    return date;
  }

  _cloneEntry(entry) {
    return {
      identifierHash: entry.identifierHash,
      userId: entry.userId,
      wallet: entry.wallet,
      lastInteraction: entry.lastInteraction ? entry.lastInteraction.toISOString() : null,
      lastInteractionType: entry.lastInteractionType,
      driftTimeMs: entry.driftTimeMs,
      driftTimeHours: entry.driftTimeHours,
      history: entry.history.map((item) => ({ ...item })),
    };
  }
}

module.exports = { DriftLogger };
