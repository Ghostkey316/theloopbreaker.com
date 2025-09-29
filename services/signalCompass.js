const EventEmitter = require('events');

class SignalCompass extends EventEmitter {
  constructor({ telemetry, retentionLimit = 200 } = {}) {
    super();
    this.telemetry = telemetry;
    this.retentionLimit = retentionLimit;
    this.timeSeries = [];
    this.intentFrequency = new Map();
    this.ethicsTriggers = [];
    this.incoming = [];
  }

  recordPayload({ walletId, ensAlias = null, beliefScore, intents = [], ethicsFlags = [], metadata = {} }) {
    const timestamp = new Date().toISOString();
    const entry = {
      walletId,
      ensAlias,
      beliefScore,
      intents,
      ethicsFlags,
      metadata,
      timestamp,
    };
    this.incoming.unshift(entry);
    if (this.incoming.length > this.retentionLimit) {
      this.incoming.length = this.retentionLimit;
    }

    this.timeSeries.push({ timestamp, beliefScore });
    if (this.timeSeries.length > this.retentionLimit) {
      this.timeSeries.splice(0, this.timeSeries.length - this.retentionLimit);
    }

    intents.forEach((intent) => {
      const current = this.intentFrequency.get(intent) || 0;
      this.intentFrequency.set(intent, current + 1);
    });

    if (ethicsFlags.length) {
      ethicsFlags.forEach((flag) => {
        this.ethicsTriggers.push({ flag, timestamp, walletId, ensAlias });
      });
      if (this.ethicsTriggers.length > this.retentionLimit) {
        this.ethicsTriggers.splice(0, this.ethicsTriggers.length - this.retentionLimit);
      }
    }

    this.telemetry?.record('signal.compass.payload', entry, {
      tags: ['signal', 'compass'],
      visibility: { partner: true, ethics: true, audit: true },
    });

    const snapshot = this.snapshot();
    this.emit('update', snapshot);
    return snapshot;
  }

  snapshot() {
    const intents = Array.from(this.intentFrequency.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count);
    return {
      incoming: this.incoming.slice(0, 25),
      timeSeries: this.timeSeries.slice(-50),
      intentFrequency: intents,
      ethicsTriggers: this.ethicsTriggers.slice(-25),
    };
  }

  bindSocket(io) {
    this.on('update', (snapshot) => {
      io.emit('signal-compass:update', snapshot);
    });
    io.on('connection', (socket) => {
      socket.emit('signal-compass:update', this.snapshot());
    });
  }
}

module.exports = SignalCompass;
