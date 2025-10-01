'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../nodeConsentStore');

describe('node consent store', () => {
  let tempDir;
  let filePath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-consent-'));
    filePath = path.join(tempDir, 'consent.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('normalises wallets and persists opt-in state', () => {
    expect(store.normalizeWallet(' 0xABC ')).toBe('0xabc');
    expect(store.hasOptIn('0xabc', { filePath })).toBe(false);
    const result = store.setOptIn('0xABC', true, { filePath });
    expect(result.enabled).toBe(true);
    expect(store.hasOptIn('0xabc', { filePath })).toBe(true);
    store.setOptIn('0xabc', false, { filePath });
    expect(store.hasOptIn('0xabc', { filePath })).toBe(false);
  });

  it('handles missing or corrupted consent stores gracefully', () => {
    fs.writeFileSync(filePath, '{broken json');
    expect(store.hasOptIn('0xabc', { filePath })).toBe(false);
    expect(store.setOptIn('', true, { filePath })).toBeNull();
  });
});
