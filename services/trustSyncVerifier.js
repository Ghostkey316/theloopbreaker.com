class TrustSyncVerifier {
  constructor({ telemetry, remote = {} } = {}) {
    this.telemetry = telemetry || null;
    this.remote = remote;
    this.fetchImpl = remote.fetchImpl || (typeof fetch === 'function' ? fetch : require('node-fetch'));
  }

  record(event, payload, options) {
    if (this.telemetry && typeof this.telemetry.record === 'function') {
      this.telemetry.record(event, payload, options);
    }
  }

  async verifyAnchor(anchor, context = {}) {
    if (!this.remote || !this.remote.endpoint) {
      this.record('trustSync.verification.skipped', { anchor, context }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      return { status: 'skipped', reason: 'remote_verification_disabled' };
    }

    try {
      const response = await this.fetchImpl(this.remote.endpoint, {
        method: this.remote.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.remote.apiKey ? { Authorization: `Bearer ${this.remote.apiKey}` } : {}),
          ...(this.remote.headers || {}),
        },
        body: JSON.stringify({ anchor, context }),
      });

      if (!response.ok) {
        const reason = `Remote verification failed with status ${response.status}`;
        this.record('trustSync.verification.failed', { anchor, context, status: response.status }, {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        });
        return { status: 'pending', reason };
      }

      const result = await response.json().catch(() => ({ accepted: true }));
      const accepted = result.accepted !== false;
      if (accepted) {
        this.record('trustSync.verification.accepted', { anchor, context, result }, {
          tags: ['trust-sync', 'verification'],
          visibility: { partner: false, ethics: true, audit: true },
        });
        return { status: 'accepted', result };
      }

      this.record('trustSync.verification.rejected', { anchor, context, result }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      return { status: 'rejected', result };
    } catch (error) {
      this.record('trustSync.verification.deferred', { anchor, context, error: error.message }, {
        tags: ['trust-sync', 'verification'],
        visibility: { partner: false, ethics: true, audit: true },
      });
      // TODO(trust-sync-remote-migration): swap to async job queue when partner RPC exposes dedicated verification windows.
      return { status: 'deferred', reason: error.message };
    }
  }
}

module.exports = TrustSyncVerifier;
