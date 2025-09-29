import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Vaultfire codex ledger', () => {
  let tempDir: string;
  let ledgerPath: string;
  let ledger: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-ledger-'));
    ledgerPath = path.join(tempDir, 'ledger.jsonl');
    process.env.VAULTFIRE_CODEX_LEDGER = ledgerPath;
    if (fs.existsSync(ledgerPath)) {
      fs.unlinkSync(ledgerPath);
    }
    jest.resetModules();
    ledger = require('../codex/ledger');
  });

  afterEach(() => {
    delete process.env.VAULTFIRE_CODEX_LEDGER;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates belief proof signatures anchored to ENS', () => {
    const payload = { walletId: '0xabc', ensAlias: 'demo.eth', beliefScore: 0.9 };
    const proof = ledger.createBeliefProof({ payload, wallet: '0xabc', ens: 'demo.eth' });
    expect(proof.hash).toHaveLength(64);
    expect(proof.signature).toHaveLength(64);
    expect(proof.fingerprint).toHaveLength(64);
  });

  it('records CLI events with hash chaining', () => {
    const first = ledger.recordCliEvent({ command: 'init', wallet: '0xabc', ens: 'demo.eth', status: 'success' });
    const second = ledger.recordCliEvent({ command: 'push', wallet: '0xabc', ens: 'demo.eth', status: 'success', proof: { hash: 'abc', signature: 'def' } });
    const log = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    expect(log).toHaveLength(2);
    expect(first.hash).toBe(log[0].hash);
    expect(second.prev).toBe(first.hash);
    expect(log[1].proof.hash).toBe('abc');
  });
});
