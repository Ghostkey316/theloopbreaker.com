const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const fetch = require('node-fetch');
const { logger } = require('../logging');

const ALERT_LOG = path.join(__dirname, '..', '..', 'status', 'alerts.jsonl');
const WEBHOOKS_FILE = path.join(__dirname, '..', '..', 'status', 'webhooks.json');
const MAX_ALERTS = 200;

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadWebhooks() {
  try {
    const raw = fs.readFileSync(WEBHOOKS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return new Map(parsed.map((entry) => [entry.partnerId, entry]));
  } catch (error) {
    return new Map();
  }
}

class AlertCenter extends EventEmitter {
  constructor({ retentionDays = 30 } = {}) {
    super();
    this.retentionDays = retentionDays;
    this.alerts = [];
    this.webhooks = loadWebhooks();
    ensureParent(ALERT_LOG);
    this.#loadHistoricalAlerts();
  }

  #loadHistoricalAlerts() {
    if (!fs.existsSync(ALERT_LOG)) {
      return;
    }
    try {
      const lines = fs.readFileSync(ALERT_LOG, 'utf-8').trim().split('\n').filter(Boolean);
      const now = Date.now();
      const cutoff = now - this.retentionDays * 24 * 60 * 60 * 1000;
      const parsed = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean)
        .filter((entry) => new Date(entry.timestamp || 0).getTime() >= cutoff);
      this.alerts.push(...parsed.slice(-MAX_ALERTS));
    } catch (error) {
      logger.warn('alertCenter.history.load_failed', { error: error.message });
    }
  }

  async record(alert) {
    const entry = this.#normalize(alert);
    this.alerts.push(entry);
    if (this.alerts.length > MAX_ALERTS) {
      this.alerts.splice(0, this.alerts.length - MAX_ALERTS);
    }
    this.#persist(entry);
    this.emit('alert', entry);
    await this.#broadcast(entry);
    return entry;
  }

  #normalize(alert) {
    const timestamp = alert.timestamp ? new Date(alert.timestamp).toISOString() : new Date().toISOString();
    return {
      type: alert.type || 'error',
      module: alert.module || 'unknown',
      message: alert.message || 'unexpected error',
      severity: alert.severity || 'critical',
      timestamp,
      details: alert.details || {},
    };
  }

  #persist(entry) {
    ensureParent(ALERT_LOG);
    fs.appendFileSync(ALERT_LOG, `${JSON.stringify(entry)}\n`);
  }

  async #broadcast(entry) {
    const tasks = [];
    for (const { partnerId, url, headers = {} } of this.webhooks.values()) {
      tasks.push(
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(entry),
        }).catch((error) => {
          logger.warn('partner.alert.webhook_failed', { partnerId, url, error: error.message });
        })
      );
    }
    await Promise.all(tasks);
  }

  getRecentAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  registerWebhook({ partnerId, url, headers }) {
    if (!partnerId || !url) {
      throw new Error('partnerId and url are required');
    }
    this.webhooks.set(partnerId, { partnerId, url, headers });
    ensureParent(WEBHOOKS_FILE);
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(Array.from(this.webhooks.values()), null, 2));
    return { partnerId, url };
  }

  #resolveEnvironment() {
    const metaEnv =
      (typeof globalThis !== 'undefined' &&
        (globalThis.__VAULTFIRE_IMPORT_META__?.env || globalThis.__VAULTFIRE_DASHBOARD_ENV__)) ||
      null;
    if (metaEnv && (metaEnv.MODE || metaEnv.mode)) {
      return metaEnv.MODE || metaEnv.mode;
    }
    return process.env.NODE_ENV || 'unknown';
  }

  getStatus() {
    const alerts = this.getRecentAlerts();
    return {
      healthy: true,
      environment: this.#resolveEnvironment(),
      alerts,
      webhooks: Array.from(this.webhooks.values()).map((entry) => ({ partnerId: entry.partnerId, url: entry.url })),
    };
  }
}

module.exports = new AlertCenter();
