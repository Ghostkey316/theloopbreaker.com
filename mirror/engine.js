const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { computeBeliefMultiplier, determineTier } = require('./belief-weight');
const { assertWalletOnlyData } = require('../utils/identityGuards');

class BeliefMirrorEngine {
  constructor({ telemetryPath, rotationDays = 7, archiveDir } = {}) {
    this.telemetryPath =
      telemetryPath || path.join(__dirname, '..', 'telemetry', 'belief-log.json');
    this.ensureTelemetryFile();
    this.archiveDir = archiveDir || path.join(path.dirname(this.telemetryPath), 'archive');
    this.rotationWindowMs = rotationDays * 24 * 60 * 60 * 1000;
  }

  ensureTelemetryFile() {
    if (!fs.existsSync(path.dirname(this.telemetryPath))) {
      fs.mkdirSync(path.dirname(this.telemetryPath), { recursive: true });
    }

    if (!fs.existsSync(this.telemetryPath)) {
      fs.writeFileSync(this.telemetryPath, JSON.stringify([], null, 2));
    }
  }

  #writeLog(entries) {
    fs.writeFileSync(this.telemetryPath, JSON.stringify(entries, null, 2));
  }

  #archiveLog(entries) {
    if (!entries.length) {
      return;
    }
    const oldest = Date.parse(entries[0].timestamp);
    const latest = Date.parse(entries[entries.length - 1].timestamp);
    if (!Number.isFinite(oldest) || !Number.isFinite(latest)) {
      return;
    }
    const serialized = JSON.stringify(entries, null, 2);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
    const start = new Date(oldest).toISOString().split('T')[0];
    const end = new Date(latest).toISOString().split('T')[0];
    fs.mkdirSync(this.archiveDir, { recursive: true });
    const archivePath = path.join(this.archiveDir, `${start}_${end}_${hash}.json.gz`);
    fs.writeFileSync(archivePath, zlib.gzipSync(serialized));
  }

  #rotateIfNeeded(entries, currentTimestamp) {
    if (!entries.length) {
      return entries;
    }
    const firstTimestamp = Date.parse(entries[0].timestamp);
    const latestTimestamp = Date.parse(currentTimestamp || entries[entries.length - 1].timestamp);
    if (!Number.isFinite(firstTimestamp) || !Number.isFinite(latestTimestamp)) {
      return entries;
    }

    if (latestTimestamp - firstTimestamp >= this.rotationWindowMs) {
      this.#archiveLog(entries);
      this.#writeLog([]);
      return [];
    }
    return entries;
  }

  readLog() {
    const raw = fs.readFileSync(this.telemetryPath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Unable to parse belief telemetry: ${error.message}`);
    }
  }

  readRecentEntries(limit = 50) {
    const log = this.readLog();
    if (!limit || limit >= log.length) {
      return log;
    }
    return log.slice(-limit);
  }

  async appendEntry(entry) {
    const log = this.readLog();
    const rotatedLog = this.#rotateIfNeeded(log, entry.timestamp);
    rotatedLog.push(entry);
    this.#writeLog(rotatedLog);
    return entry;
  }

  calculateEntry(action) {
    const timestamp = new Date().toISOString();
    const type = action.type || 'partnerSync';
    const metrics = action.metrics || {};
    assertWalletOnlyData({ wallet: action.wallet, ens: action.ens }, { context: 'action.identity' });

    const result = computeBeliefMultiplier(type, metrics, action.scoringConfig);
    const multiplier = result.multiplier;
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
      configOverrides: result.overridesDetected,
      scoring: {
        weights: result.weights,
        baseline: result.baseline,
        overrides: result.overrides,
      },
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

  exportLogs(filters = {}) {
    const {
      from,
      to,
      wallet,
      ens,
      type,
      limit = 200,
    } = filters;
    const lowerWallet = wallet ? wallet.toLowerCase() : null;
    const lowerEns = ens ? ens.toLowerCase() : null;
    const fromTime = from ? Date.parse(from) : null;
    const toTime = to ? Date.parse(to) : null;

    const entries = this.readLog().filter((entry) => {
      const entryTime = Date.parse(entry.timestamp);
      if (Number.isFinite(fromTime) && (!Number.isFinite(entryTime) || entryTime < fromTime)) {
        return false;
      }
      if (Number.isFinite(toTime) && (!Number.isFinite(entryTime) || entryTime > toTime)) {
        return false;
      }
      if (lowerWallet && entry.wallet?.toLowerCase() !== lowerWallet) {
        return false;
      }
      if (lowerEns && (!entry.ens || entry.ens.toLowerCase() !== lowerEns)) {
        return false;
      }
      if (type && entry.type !== type) {
        return false;
      }
      return true;
    });

    const sliced = limit ? entries.slice(-limit) : entries;
    return sliced.map((entry) => ({
      wallet: entry.wallet,
      ens: entry.ens,
      multiplier: entry.multiplier,
      tier: entry.tier,
      type: entry.type,
      timestamp: entry.timestamp,
      metrics: entry.metrics,
      configOverrides: Boolean(entry.configOverrides),
      overrides: entry.scoring?.overrides || [],
    }));
  }
}

module.exports = {
  BeliefMirrorEngine,
};
