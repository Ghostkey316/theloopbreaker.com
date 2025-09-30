const crypto = require('crypto');

class TrustSyncVerifier {
  constructor({ telemetry, remote = {} } = {}) {
    this.telemetry = telemetry || null;
    this.remote = remote || {};
    this.fetchImpl = this.remote.fetchImpl || (typeof fetch === 'function' ? fetch : require('node-fetch'));
    this.clockSkewMs = typeof this.remote.clockSkewMs === 'number' ? this.remote.clockSkewMs : 2 * 60 * 1000;
    this.replayWindowMs = typeof this.remote.replayWindowMs === 'number' ? this.remote.replayWindowMs : 10 * 60 * 1000;
    this.maxReplayEntries = typeof this.remote.maxReplayEntries === 'number' ? this.remote.maxReplayEntries : 500;
    this.now = typeof this.remote.nowFn === 'function' ? this.remote.nowFn : () => Date.now();
    this.replayCache = new Map();
  }

  record(event, payload, options) {
    if (this.telemetry && typeof this.telemetry.record === 'function') {
      this.telemetry.record(event, payload, options);
    }
  }

  #normalizeTimestamp(timestamp) {
    if (!timestamp) {
      return null;
    }
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : parsed;
  }

  #pruneReplayCache(nowTs) {
    for (const [key, entry] of this.replayCache.entries()) {
      if (nowTs - entry.timestamp > this.replayWindowMs) {
        this.replayCache.delete(key);
      }
    }
    while (this.replayCache.size > this.maxReplayEntries) {
      const oldestKey = this.replayCache.keys().next().value;
      this.replayCache.delete(oldestKey);
    }
  }

  #makeReplayKey(anchor, context) {
    const payload = {
      wallet: anchor?.wallet || '',
      fingerprint: anchor?.originFingerprint || '',
      belief: anchor?.beliefScore ?? '',
      partner: context.partnerId || '',
      event: context.event || '',
      telemetryId: context.telemetryId || '',
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  #isReplay(key, timestamp) {
    const entry = this.replayCache.get(key);
    if (!entry) {
      return false;
    }
    if (timestamp - entry.timestamp > this.replayWindowMs) {
      return false;
    }
    return entry.status === 'accepted' || entry.status === 'rejected';
  }

  #storeReplayKey(key, timestamp, status) {
    this.replayCache.set(key, { timestamp, status });
    this.#pruneReplayCache(timestamp);
  }

  #checksum(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async verifyAnchor(anchor, context = {}) {
    if (!this.remote || !this.remote.endpoint) {
      this.record('trustSync.verification.skipped', { anchor, context }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      return { status: 'skipped', reason: 'remote_verification_disabled' };
    }

    const nowTs = this.now();
    const normalizedContext = { ...context };
    const timestampIso = normalizedContext.timestamp || new Date(nowTs).toISOString();
    normalizedContext.timestamp = timestampIso;
    const timestampMs = this.#normalizeTimestamp(timestampIso);
    if (timestampMs === null || Math.abs(timestampMs - nowTs) > this.clockSkewMs) {
      this.record(
        'trustSync.verification.rejected',
        { anchor, context: normalizedContext, reason: 'timestamp_out_of_range' },
        {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        }
      );
      return { status: 'rejected', reason: 'timestamp_out_of_range' };
    }

    const replayKey = this.#makeReplayKey(anchor, normalizedContext);
    this.#pruneReplayCache(timestampMs);
    if (this.#isReplay(replayKey, timestampMs)) {
      this.record(
        'trustSync.verification.replay',
        { anchor, context: normalizedContext },
        {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        }
      );
      this.#storeReplayKey(replayKey, timestampMs, 'rejected');
      return { status: 'rejected', reason: 'replay_detected' };
    }

    try {
      const payload = { anchor, context: normalizedContext };
      const response = await this.fetchImpl(this.remote.endpoint, {
        method: this.remote.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.remote.apiKey ? { Authorization: `Bearer ${this.remote.apiKey}` } : {}),
          ...(this.remote.headers || {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const reason = `Remote verification failed with status ${response.status}`;
        const checksum = this.#checksum(payload);
        this.#storeReplayKey(replayKey, timestampMs, 'pending');
        this.record('trustSync.verification.failed', { anchor, context: normalizedContext, status: response.status, checksum }, {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        });
        return { status: 'pending', reason, checksum };
      }

      const result = await response.json().catch(() => ({ accepted: true }));
      const accepted = result.accepted !== false;
      if (accepted) {
        this.#storeReplayKey(replayKey, timestampMs, 'accepted');
        this.record('trustSync.verification.accepted', { anchor, context: normalizedContext, result }, {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        });
        return { status: 'accepted', result };
      }

      this.#storeReplayKey(replayKey, timestampMs, 'rejected');
      this.record('trustSync.verification.rejected', { anchor, context: normalizedContext, result }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      return { status: 'rejected', result };
    } catch (error) {
      const payload = { anchor, context: normalizedContext };
      const checksum = this.#checksum(payload);
      this.#storeReplayKey(replayKey, timestampMs, 'pending');
      this.record('trustSync.verification.deferred', { anchor, context: normalizedContext, error: error.message, checksum }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      // TODO(trust-sync-remote-migration): swap to async job queue when partner RPC exposes dedicated verification windows.
      return { status: 'deferred', reason: error.message, checksum };
    }
  }
}

module.exports = TrustSyncVerifier;
