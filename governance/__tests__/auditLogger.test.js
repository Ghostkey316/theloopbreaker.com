'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { createAuditLogger, AuditLogger } = require('../auditLogger');

describe('governance audit logger', () => {
  let tempDir;
  let filePath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-audit-'));
    filePath = path.join(tempDir, 'audit.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initialises audit file and appends decisions', () => {
    const logger = new AuditLogger({ filePath, now: () => new Date('2024-01-01T00:00:00Z') });
    const entry = logger.logDecision({ decisionType: 'config.update', actorWallet: '0xabc', notes: 'updated quorum' });
    expect(entry.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(logger.getEntries()).toHaveLength(1);
    const stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(stored[0].decisionType).toBe('config.update');
  });

  it('recovers gracefully when audit file becomes corrupted', () => {
    fs.writeFileSync(filePath, '{invalid json');
    const logger = createAuditLogger({ filePath });
    expect(logger.getEntries()).toEqual([]);
    const entry = logger.logDecision({ decisionType: 'repair' });
    expect(entry.decisionType).toBe('repair');
    expect(logger.getEntries()).toHaveLength(1);
  });
});
