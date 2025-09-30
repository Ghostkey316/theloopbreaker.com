const crypto = require('crypto');

const MAX_ATTESTATION_CACHE = 5;

class TrustSyncVerifier {
  constructor({ telemetry, remote = {}, externalValidationEndpoint } = {}) {
    this.telemetry = telemetry || null;
    this.remote = remote || {};
    this.fetchImpl = this.remote.fetchImpl || (typeof fetch === 'function' ? fetch : require('node-fetch'));
    this.clockSkewMs = typeof this.remote.clockSkewMs === 'number' ? this.remote.clockSkewMs : 2 * 60 * 1000;
    this.replayWindowMs = typeof this.remote.replayWindowMs === 'number' ? this.remote.replayWindowMs : 10 * 60 * 1000;
    this.maxReplayEntries = typeof this.remote.maxReplayEntries === 'number' ? this.remote.maxReplayEntries : 500;
    this.now = typeof this.remote.nowFn === 'function' ? this.remote.nowFn : () => Date.now();
    this.replayCache = new Map();
    this.externalValidationEndpoint =
      externalValidationEndpoint || this.remote.externalValidationEndpoint || null;
    this.attestationCache = [];
    this.maxAttestationCacheEntries =
      typeof this.remote.maxAttestationCacheEntries === 'number'
        ? Math.max(1, this.remote.maxAttestationCacheEntries)
        : MAX_ATTESTATION_CACHE;
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

  #resolveTelemetryHash() {
    if (!this.telemetry || typeof this.telemetry.auditTrail !== 'function') {
      return null;
    }
    try {
      const trail = this.telemetry.auditTrail();
      if (!Array.isArray(trail) || !trail.length) {
        return null;
      }
      const latest = trail[trail.length - 1];
      return latest?.hash || null;
    } catch (error) {
      this.record(
        'trustSync.telemetry.hash_failed',
        { error: error.message },
        { tags: ['trust-sync', 'telemetry'], visibility: { partner: false, ethics: true, audit: true } }
      );
      return null;
    }
  }

  #findCachedAttestation(digest, telemetryHash) {
    return this.attestationCache.find(
      (entry) => entry.digest === digest && entry.telemetryHash === telemetryHash
    );
  }

  #cacheAttestation(digest, telemetryHash, attestation) {
    this.attestationCache.unshift({
      digest,
      telemetryHash,
      attestation,
      storedAt: this.now(),
    });
    if (this.attestationCache.length > this.maxAttestationCacheEntries) {
      this.attestationCache.length = this.maxAttestationCacheEntries;
    }
  }

  async #requestExternalAttestation({ anchor, context, digest, telemetryHash, cached }) {
    if (!this.externalValidationEndpoint) {
      return { status: 'skipped' };
    }

    const cachedEntry = cached || this.#findCachedAttestation(digest, telemetryHash);
    if (cachedEntry) {
      this.record(
        'trustSync.attestation.cached',
        { digest, telemetryHash, attestation: cachedEntry.attestation },
        { tags: ['trust-sync', 'verification'], visibility: { partner: false, ethics: true, audit: true } }
      );
      return { status: 'accepted', attestation: cachedEntry.attestation, source: 'cache' };
    }

    const payload = {
      anchor: anchor || null,
      context,
      digest,
      telemetryHash,
    };

    try {
      const response = await this.fetchImpl(this.externalValidationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.remote.attestationApiKey ? { Authorization: `Bearer ${this.remote.attestationApiKey}` } : {}),
          ...(this.remote.attestationHeaders || {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const reason = `external_attestation_http_${response.status}`;
        this.record(
          'trustSync.attestation.failed',
          { digest, telemetryHash, status: response.status },
          { tags: ['trust-sync', 'verification'], visibility: { partner: false, ethics: true, audit: true } }
        );
        return { status: 'failed', reason };
      }

      const attestation = await response.json();
      if (!attestation || typeof attestation.signature !== 'string') {
        const reason = 'invalid_attestation_payload';
        this.record(
          'trustSync.attestation.failed',
          { digest, telemetryHash, reason },
          { tags: ['trust-sync', 'verification'], visibility: { partner: false, ethics: true, audit: true } }
        );
        return { status: 'failed', reason };
      }

      this.#cacheAttestation(digest, telemetryHash, attestation);
      this.record(
        'trustSync.attestation.accepted',
        { digest, telemetryHash, attestation },
        { tags: ['trust-sync', 'verification'], visibility: { partner: false, ethics: true, audit: true } }
      );
      return { status: 'accepted', attestation, source: 'remote' };
    } catch (error) {
      this.record(
        'trustSync.attestation.failed',
        { digest, telemetryHash, error: error.message },
        { tags: ['trust-sync', 'verification'], visibility: { partner: false, ethics: true, audit: true } }
      );
      return { status: 'failed', reason: error.message };
    }
  }

  async verifyAnchor(anchor, context = {}) {
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

    const telemetryHash = this.#resolveTelemetryHash();
    const payloadEnvelope = { anchor, context: normalizedContext };
    const digest = this.#checksum(payloadEnvelope);
    const replayKey = this.#makeReplayKey(anchor, normalizedContext);
    this.#pruneReplayCache(timestampMs);
    const cachedAttestation = this.externalValidationEndpoint
      ? this.#findCachedAttestation(digest, telemetryHash)
      : null;
    if (this.#isReplay(replayKey, timestampMs)) {
      if (cachedAttestation) {
        this.#storeReplayKey(replayKey, timestampMs, 'accepted');
        this.record(
          'trustSync.verification.replay-cache',
          { anchor, context: normalizedContext, digest },
          {
            tags: ['trust-sync', 'verification'],
            visibility: { partner: false, ethics: true, audit: true },
          }
        );
        return {
          status: 'accepted',
          result: { cached: true },
          digest,
          telemetryHash,
          attestation: cachedAttestation.attestation,
          attestationSource: 'cache',
        };
      }
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

    const remoteEnabled = Boolean(this.remote && this.remote.endpoint);
    let remoteOutcome = { status: 'skipped', reason: 'remote_verification_disabled', digest };

    if (remoteEnabled) {
      try {
        const payload = { ...payloadEnvelope, digest, telemetryHash };
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
          this.#storeReplayKey(replayKey, timestampMs, 'pending');
          this.record(
            'trustSync.verification.failed',
            { anchor, context: normalizedContext, status: response.status, digest },
            {
              tags: ['trust-sync', 'verification'],
              visibility: { partner: false, ethics: true, audit: true },
            }
          );
          remoteOutcome = { status: 'pending', reason, digest };
        } else {
          const result = await response.json().catch(() => ({ accepted: true }));
          const accepted = result.accepted !== false;
          if (accepted) {
            this.#storeReplayKey(replayKey, timestampMs, 'accepted');
            this.record(
              'trustSync.verification.accepted',
              { anchor, context: normalizedContext, result, digest },
              {
                tags: ['trust-sync', 'verification'],
                visibility: { partner: false, ethics: true, audit: true },
              }
            );
            remoteOutcome = { status: 'accepted', result, digest };
          } else {
            this.#storeReplayKey(replayKey, timestampMs, 'rejected');
            this.record(
              'trustSync.verification.rejected',
              { anchor, context: normalizedContext, result, digest },
              {
                tags: ['trust-sync', 'verification'],
                visibility: { partner: false, ethics: true, audit: true },
              }
            );
            remoteOutcome = { status: 'rejected', result, digest };
          }
        }
      } catch (error) {
        this.#storeReplayKey(replayKey, timestampMs, 'pending');
        this.record(
          'trustSync.verification.deferred',
          { anchor, context: normalizedContext, error: error.message, digest },
          {
            tags: ['trust-sync', 'verification'],
            visibility: { partner: false, ethics: true, audit: true },
          }
        );
        remoteOutcome = { status: 'deferred', reason: error.message, digest };
      }
    } else {
      this.record(
        'trustSync.verification.skipped',
        { anchor, context: normalizedContext },
        {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        }
      );
    }

    if (!this.externalValidationEndpoint) {
      return remoteOutcome;
    }

    if (!['accepted', 'skipped'].includes(remoteOutcome.status)) {
      return remoteOutcome;
    }

    const attestation = await this.#requestExternalAttestation({
      anchor,
      context: normalizedContext,
      digest,
      telemetryHash,
      cached: cachedAttestation,
    });

    if (attestation.status === 'accepted') {
      return {
        status: 'accepted',
        result: remoteOutcome.result,
        digest,
        telemetryHash,
        attestation: attestation.attestation,
        attestationSource: attestation.source,
      };
    }

    const fallbackStatus = remoteOutcome.status === 'accepted' ? 'pending_attestation' : attestation.status;
    return {
      status: fallbackStatus,
      reason: attestation.reason,
      digest,
      telemetryHash,
      result: remoteOutcome.result,
    };
  }

}

module.exports = TrustSyncVerifier;
