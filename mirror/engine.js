const fs = require('fs');
const path = require('path');
const { computeBeliefMultiplier, determineTier } = require('./belief-weight');

class BeliefMirrorEngine {
  constructor({ telemetryPath } = {}) {
    this.telemetryPath =
      telemetryPath || path.join(__dirname, '..', 'telemetry', 'belief-log.json');
    this.ensureTelemetryFile();
  }

  ensureTelemetryFile() {
    if (!fs.existsSync(path.dirname(this.telemetryPath))) {
      fs.mkdirSync(path.dirname(this.telemetryPath), { recursive: true });
    }

    if (!fs.existsSync(this.telemetryPath)) {
      fs.writeFileSync(this.telemetryPath, JSON.stringify([], null, 2));
    }
  }

  readLog() {
    const raw = fs.readFileSync(this.telemetryPath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Unable to parse belief telemetry: ${error.message}`);
    }
  }

  async appendEntry(entry) {
    const log = this.readLog();
    log.push(entry);
    fs.writeFileSync(this.telemetryPath, JSON.stringify(log, null, 2));
    return entry;
  }

  calculateEntry(action) {
    const timestamp = new Date().toISOString();
    const type = action.type || 'partnerSync';
    const metrics = action.metrics || {};
    const multiplier = computeBeliefMultiplier(type, metrics);
    const tier = determineTier(multiplier);

    return {
      wallet: action.wallet,
      ens: action.ens || null,
      type,
      multiplier,
      tier,
      metrics,
      origin: action.origin || 'mirror-engine',
      timestamp,
    };
  }

  async processAction(action) {
    const entry = this.calculateEntry(action);
    await this.appendEntry(entry);
    return entry;
  }

  async run(actions = []) {
    const processed = [];
    for (const action of actions) {
      const entry = await this.processAction(action);
      processed.push(entry);
    }
    return processed;
  }

  async loadFromSources() {
    const sourcesDir = path.join(__dirname, 'sources');
    if (!fs.existsSync(sourcesDir)) {
      return [];
    }

    const files = fs.readdirSync(sourcesDir).filter((file) => file.endsWith('.json'));
    const actions = [];

    for (const file of files) {
      const fullPath = path.join(sourcesDir, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          actions.push(...parsed);
        }
      } catch (error) {
        console.warn(`Skipping invalid source ${file}: ${error.message}`);
      }
    }

    return actions;
  }

  scheduleHourly(loader) {
    const resolveActions = async () => {
      if (loader) {
        return loader();
      }
      return this.loadFromSources();
    };

    const runCycle = async () => {
      const actions = await resolveActions();
      if (actions && actions.length) {
        await this.run(actions);
      }
    };

    runCycle().catch((error) => {
      console.error('Belief mirror initial run failed', error);
    });

    const intervalId = setInterval(() => {
      runCycle().catch((error) => {
        console.error('Belief mirror scheduled run failed', error);
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }

  getLatestEntryForWallet(wallet) {
    if (!wallet) return null;
    const normalized = wallet.toLowerCase();
    const log = this.readLog();
    for (let index = log.length - 1; index >= 0; index -= 1) {
      const entry = log[index];
      if (entry.wallet && entry.wallet.toLowerCase() === normalized) {
        return entry;
      }
    }
    return null;
  }
}

module.exports = {
  BeliefMirrorEngine,
};
