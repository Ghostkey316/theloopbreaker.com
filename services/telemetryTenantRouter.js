const fs = require('fs');
const path = require('path');
const MultiTierTelemetryLedger = require('./telemetryLedger');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

class TelemetryTenantRouter {
  constructor({ baseDir = path.join(__dirname, '..', 'logs', 'tenants'), ledgerFactory } = {}) {
    this.baseDir = baseDir;
    ensureDirectory(this.baseDir);
    this.ledgerFactory =
      ledgerFactory ||
      ((tenantId) =>
        new MultiTierTelemetryLedger({
          baseDir: path.join(this.baseDir, tenantId),
          partnerLog: 'partner.log',
          ethicsLog: 'ethics.log',
          auditLog: 'audit.log',
        }));
    this.tenants = new Map();
  }

  #key(tenantId) {
    return tenantId || 'public';
  }

  #getOrCreateLedger(tenantId) {
    const key = this.#key(tenantId);
    if (!this.tenants.has(key)) {
      const ledger = this.ledgerFactory(key);
      this.tenants.set(key, ledger);
    }
    return this.tenants.get(key);
  }

  record(tenantId, eventType, payload = {}, options = {}) {
    const ledger = this.#getOrCreateLedger(tenantId);
    const entry = ledger.record(eventType, { ...payload, tenantId: this.#key(tenantId) }, options);
    return entry;
  }

  readChannel(tenantId, channel = 'partner') {
    const ledger = this.tenants.get(this.#key(tenantId));
    if (!ledger) {
      return [];
    }
    return ledger.readChannel(channel);
  }

  async flushAll() {
    const ledgers = Array.from(this.tenants.values());
    await Promise.all(ledgers.map((ledger) => ledger.flushExternal()));
  }
}

function createTelemetryTenantRouter(options) {
  return new TelemetryTenantRouter(options);
}

module.exports = {
  TelemetryTenantRouter,
  createTelemetryTenantRouter,
};
