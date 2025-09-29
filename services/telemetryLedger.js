const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  } = {}) {
    this.baseDir = baseDir;
    ensureDirectory(this.baseDir);
    this.partnerLogPath = path.join(this.baseDir, partnerLog);
    this.ethicsLogPath = path.join(this.baseDir, ethicsLog);
    this.auditLogPath = path.join(this.baseDir, auditLog);
    ensureDirectory(path.dirname(this.auditLogPath));
    this.lastAuditHash = this.#bootstrapAuditHash();
  }

  #bootstrapAuditHash() {
    const lastEntry = readLastLine(this.auditLogPath);
    return lastEntry?.hash || null;
  }

  #createEntry(eventType, payload = {}, { severity = 'info', tags = [], correlationId } = {}) {
    const timestamp = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      eventType,
      timestamp,
      severity,
      tags,
      payload,
      correlationId: correlationId || crypto.randomUUID(),
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
}

module.exports = MultiTierTelemetryLedger;
