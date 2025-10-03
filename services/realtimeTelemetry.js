const crypto = require('crypto');

function normaliseArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

class RealtimeTelemetryIngestor {
  constructor({ ledger, obfuscate = true, visibility } = {}) {
    this.ledger = ledger;
    this.obfuscate = obfuscate !== false;
    this.visibility = visibility || { partner: true, ethics: true, audit: true };
    this.lastIngestedAt = null;
    this.totalEvents = 0;
  }

  #obfuscatePayload(payload = {}) {
    if (!this.obfuscate) {
      return { ...payload };
    }
    const clone = { ...payload };
    if (clone.walletId) {
      clone.walletHash = crypto.createHash('sha256').update(String(clone.walletId)).digest('hex');
      delete clone.walletId;
    }
    if (clone.identity) {
      clone.identityHash = crypto.createHash('sha256').update(String(clone.identity)).digest('hex');
      delete clone.identity;
    }
    clone.obfuscated = true;
    return clone;
  }

  ingest(events, { channel = 'telemetry.realtime', tags = ['telemetry', 'realtime'], metadata = {} } = {}) {
    const payloads = normaliseArray(events);
    const accepted = [];
    const rejected = [];
    payloads.forEach((payload) => {
      try {
        const sanitized = this.#obfuscatePayload(payload);
        const entryPayload = {
          ...sanitized,
          metadata: { ...metadata, ...sanitized.metadata },
        };
        this.ledger?.record(channel, entryPayload, { tags, visibility: this.visibility });
        accepted.push({ originalType: payload?.type || channel, payload: entryPayload });
        this.totalEvents += 1;
        this.lastIngestedAt = new Date().toISOString();
      } catch (error) {
        rejected.push({ payload, error: error?.message || String(error) });
      }
    });
    return {
      accepted,
      rejected,
      totalAccepted: accepted.length,
      totalRejected: rejected.length,
      lastIngestedAt: this.lastIngestedAt,
    };
  }

  status() {
    return {
      lastIngestedAt: this.lastIngestedAt,
      totalEvents: this.totalEvents,
      obfuscating: this.obfuscate,
    };
  }
}

module.exports = RealtimeTelemetryIngestor;
