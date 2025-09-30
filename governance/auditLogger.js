'use strict';

const fs = require('fs');
const path = require('path');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '[]\n', 'utf8');
  }
}

function safeRead(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

class AuditLogger {
  constructor({ filePath = path.join(__dirname, 'auditLog.json'), now } = {}) {
    this.filePath = filePath;
    this.now = typeof now === 'function' ? now : () => new Date();
    ensureFile(this.filePath);
  }

  logDecision({ decisionType, actorWallet, policyChange, notes } = {}) {
    const entry = {
      timestamp: this.now().toISOString(),
      decisionType: decisionType || 'unspecified',
      actorWallet: actorWallet || null,
      policyChange: policyChange || null,
      notes: notes || null,
    };
    const history = safeRead(this.filePath);
    history.push(entry);
    fs.writeFileSync(this.filePath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    return entry;
  }

  getEntries() {
    return safeRead(this.filePath);
  }
}

function createAuditLogger(options = {}) {
  return new AuditLogger(options);
}

module.exports = {
  AuditLogger,
  createAuditLogger,
};

