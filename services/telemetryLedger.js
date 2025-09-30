const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createTelemetrySinkRegistry } = require('./telemetrySinks');
const { createTelemetryPersistence } = require('./telemetryPersistence');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendLine(filePath, entry) {
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

function readLastLine(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return null;
  }
  const lastNewline = content.lastIndexOf('\n');
  const lastLine = lastNewline >= 0 ? content.slice(lastNewline + 1) : content;
  try {
    return JSON.parse(lastLine);
  } catch (error) {
    return null;
  }
}

class MultiTierTelemetryLedger {
  constructor({
    baseDir = path.join(__dirname, '..', 'logs', 'telemetry'),
    partnerLog = 'partner.log',
    ethicsLog = 'ethics.log',
    auditLog = 'audit.log',
    sinks = [],
    persistence,
    telemetryFallback = false,
    fallbackFile = 'remote-fallback.jsonl',
    fallback = {},
  } = {}) {
    this.baseDir = baseDir;
    ensureDirectory(this.baseDir);
    this.partnerLogPath = path.join(this.baseDir, partnerLog);
    this.ethicsLogPath = path.join(this.baseDir, ethicsLog);
    this.auditLogPath = path.join(this.baseDir, auditLog);
    ensureDirectory(path.dirname(this.auditLogPath));
    this.lastAuditHash = this.#bootstrapAuditHash();
    const sinkFallbackEnabled = fallback?.enabled ?? telemetryFallback;
    const sinkFallbackFile = fallback?.fileName || fallbackFile;
    const sinkFallbackDir = fallback?.directory
      ? path.resolve(this.baseDir, fallback.directory)
      : this.baseDir;
    ensureDirectory(sinkFallbackDir);
    this.sinkFallbackPath = path.join(sinkFallbackDir, sinkFallbackFile);
    if (sinkFallbackEnabled && !fs.existsSync(this.sinkFallbackPath)) {
      fs.writeFileSync(this.sinkFallbackPath, '', 'utf8');
    }
    const sinkFallbackWriter = sinkFallbackEnabled
      ? (event, error) => {
          const payload = {
            eventType: event?.eventType || null,
            entry: event?.entry || null,
            visibility: event?.visibility || null,
            sinkError: error ? error.message || String(error) : null,
            capturedAt: new Date().toISOString(),
          };
          appendLine(this.sinkFallbackPath, payload);
        }
      : null;
    this.sinkRegistry = createTelemetrySinkRegistry(sinks, { fallback: sinkFallbackWriter });
    this.persistenceAdapter = null;
    this.persistenceBacklog = [];
    this.persistenceFallbackPath = path.join(this.baseDir, 'persistence-failover.jsonl');
    if (!fs.existsSync(this.persistenceFallbackPath)) {
      fs.writeFileSync(this.persistenceFallbackPath, '', 'utf8');
    }
    if (persistence) {
      try {
        this.persistenceAdapter = createTelemetryPersistence({
          ...persistence,
          telemetry: this,
        });
        if (this.persistenceAdapter?.init) {
          Promise.resolve(this.persistenceAdapter.init()).catch((error) => {
            // eslint-disable-next-line no-console
            console.warn('Telemetry persistence initialisation failed, falling back to file logs:', error.message);
            this.persistenceAdapter = null;
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Unable to create telemetry persistence adapter:', error.message);
      }
    }
  }

  #bootstrapAuditHash() {
    const lastEntry = readLastLine(this.auditLogPath);
    return lastEntry?.hash || null;
  }

  #createEntry(
    eventType,
    payload = {},
    { severity = 'info', tags = [], correlationId, config: entryConfig } = {}
  ) {
    const timestamp = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      eventType,
      timestamp,
      severity,
      tags,
      payload,
      correlationId: correlationId || crypto.randomUUID(),
      config: {
        auditPassed: Boolean(entryConfig?.auditPassed),
      },
    };
  }

  #computeAuditHash(entry) {
    const prev = this.lastAuditHash || '';
    const data = `${prev}:${entry.id}:${entry.timestamp}:${entry.eventType}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  #writeAudit(entry) {
    const auditEntry = { ...entry, hash: this.#computeAuditHash(entry), prev: this.lastAuditHash };
    appendLine(this.auditLogPath, auditEntry);
    this.lastAuditHash = auditEntry.hash;
    return auditEntry;
  }

  async #persistEntry(entry, visibility) {
    if (!this.persistenceAdapter?.persist) {
      return;
    }
    try {
      await this.persistenceAdapter.persist(entry, { visibility });
    } catch (error) {
      const failure = {
        entry,
        visibility,
        error: error?.message || String(error),
        capturedAt: new Date().toISOString(),
      };
      this.persistenceBacklog.push(failure);
      appendLine(this.persistenceFallbackPath, failure);
      throw error;
    }
  }

  async #replayBacklog() {
    if (!this.persistenceAdapter?.persist || !this.persistenceBacklog.length) {
      return;
    }
    if (typeof this.persistenceAdapter.init === 'function') {
      await this.persistenceAdapter.init();
    }
    const pending = this.persistenceBacklog.slice();
    this.persistenceBacklog.length = 0;
    for (const item of pending) {
      try {
        await this.persistenceAdapter.persist(item.entry, { visibility: item.visibility });
      } catch (error) {
        item.error = error?.message || String(error);
        item.retryAt = new Date().toISOString();
        this.persistenceBacklog.push(item);
        appendLine(this.persistenceFallbackPath, item);
      }
    }
  }

  record(eventType, payload, options = {}) {
    const entry = this.#createEntry(eventType, payload, options);
    const { visibility = { partner: true, ethics: true, audit: true } } = options;

    if (visibility.partner) {
      appendLine(this.partnerLogPath, entry);
    }
    if (visibility.ethics) {
      appendLine(this.ethicsLogPath, entry);
    }
    if (visibility.audit !== false) {
      this.#writeAudit(entry);
    }

    this.sinkRegistry?.dispatch({
      eventType,
      entry,
      visibility,
      scope: options.tags || [],
      config: entry.config,
    });

    Promise.resolve(this.#persistEntry(entry, visibility)).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Telemetry persistence error:', error.message);
    });

    return entry;
  }

  auditTrail() {
    if (!fs.existsSync(this.auditLogPath)) {
      return [];
    }
    return fs
      .readFileSync(this.auditLogPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  readChannel(channel) {
    let filePath;
    switch (channel) {
      case 'partner':
        filePath = this.partnerLogPath;
        break;
      case 'ethics':
        filePath = this.ethicsLogPath;
        break;
      case 'audit':
        filePath = this.auditLogPath;
        break;
      default:
        throw new Error(`Unknown telemetry channel: ${channel}`);
    }

    if (!fs.existsSync(filePath)) {
      return [];
    }

    return fs
      .readFileSync(filePath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  async flushExternal() {
    await this.#replayBacklog();
    const tasks = [];
    if (this.sinkRegistry) {
      tasks.push(this.sinkRegistry.flush());
    }
    if (this.persistenceAdapter?.flush) {
      tasks.push(this.persistenceAdapter.flush());
    }
    await Promise.all(tasks);
  }
}

module.exports = MultiTierTelemetryLedger;
