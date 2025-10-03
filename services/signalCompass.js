const EventEmitter = require('events');

class SignalCompass extends EventEmitter {
  constructor({ telemetry, retentionLimit = 200, interpreter = null, deployment } = {}) {
    super();
    this.telemetry = telemetry;
    this.retentionLimit = retentionLimit;
    this.timeSeries = [];
    this.intentFrequency = new Map();
    this.ethicsTriggers = [];
    this.incoming = [];
    this.interpreter = interpreter;
    this.deployment = deployment;
    this.trustWeights = new Map();
  }

  recordPayload({
    walletId,
    ensAlias = null,
    beliefScore,
    originFingerprint = null,
    intents = [],
    ethicsFlags = [],
    metadata = {},
  }) {
    const timestamp = new Date().toISOString();
    const entry = {
      walletId,
      ensAlias,
      beliefScore,
      originFingerprint,
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

    const weight = Number((beliefScore * (1 + intents.length * 0.05)).toFixed(4));
    const current = this.trustWeights.get(walletId) || {
      walletId,
      weight: 0,
      samples: 0,
      dominantIntent: null,
      lastEntry: null,
    };
    const updatedWeight = Number(((current.weight * current.samples + weight) / (current.samples + 1)).toFixed(4));
    const dominantIntent = intents.length ? intents[0] : current.dominantIntent;
    this.trustWeights.set(walletId, {
      walletId,
      weight: updatedWeight,
      samples: current.samples + 1,
      dominantIntent,
      lastEntry: entry,
    });

    this.telemetry?.record('signal.compass.payload', entry, {
      tags: ['signal', 'compass'],
      visibility: { partner: true, ethics: true, audit: true },
    });

    const snapshot = this.snapshot();
    this.emit('update', snapshot);
    this.emit('trust-map:update', this.trustMap());
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

  trustMap() {
    const nodes = {};
    this.trustWeights.forEach((value, walletId) => {
      const interpreterSummary = this.interpreter?.interpret(value.lastEntry) || null;
      nodes[walletId] = {
        weight: value.weight,
        samples: value.samples,
        confidence: value.lastEntry?.beliefScore ?? null,
        dominantIntent: value.dominantIntent,
        interpreterSummary,
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      mode: this.deployment?.getStatus().mode || 'simulated',
      indicator: this.deployment?.getStatus().indicator || { color: 'amber', label: 'SIMULATED' },
      nodes,
    };
  }

  bindSocket(io) {
    this.on('update', (snapshot) => {
      io.emit('signal-compass:update', snapshot);
    });
    this.on('mode', () => {
      io.emit('trust-map:update', this.trustMap());
    });
    this.on('trust-map:update', () => {
      io.emit('trust-map:update', this.trustMap());
    });
    io.on('connection', (socket) => {
      socket.emit('signal-compass:update', this.snapshot());
      socket.emit('trust-map:update', this.trustMap());
    });
  }
}

module.exports = SignalCompass;
