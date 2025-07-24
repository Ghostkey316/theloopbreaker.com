const path = require('path');
const fs = require('fs');

jest.mock('fs', () => {
  let files = {};
  const mock = {
    readFileSync: jest.fn((p, enc) => {
      if (!files[p]) {
        throw new Error(`File not found: ${p}`);
      }
      return files[p];
    }),
    writeFileSync: jest.fn((p, data) => {
      files[p] = data;
      mock.__lastWrite = { path: p, data, time: Date.now() };
    }),
    existsSync: jest.fn((p) => Object.prototype.hasOwnProperty.call(files, p)),
    __setFile: (p, data) => {
      files[p] = data;
    },
    __getFile: (p) => files[p],
    __reset: () => { files = {}; mock.__lastWrite = undefined; }
  };
  return mock;
});

const { onboardPartner, resolveIdentity, ethicsEnabled } = require('../vaultfire_partner_onboard');

const CONFIG_PATH = path.join(__dirname, '..', 'vaultfire-core', 'vaultfire_config.json');
const PARTNERS_PATH = path.join(__dirname, '..', 'partners.json');

beforeEach(() => {
  fs.__reset();
  fs.__setFile(CONFIG_PATH, JSON.stringify({ ethics_anchor: true }));
});

test('resolveIdentity validates ENS and cb.id addresses', () => {
  expect(resolveIdentity('ghostkey316.eth')).toBe('0x9abCDEF1234567890abcdefABCDEF1234567890');
  expect(resolveIdentity('GhostKey316.ETH')).toBe('0x9abCDEF1234567890abcdefABCDEF1234567890');
  expect(resolveIdentity('bpow20.cb.id')).toBe('cb1qexampleaddress0000000000000000000000');
  expect(resolveIdentity('BPOW20.CB.ID')).toBe('cb1qexampleaddress0000000000000000000000');
  expect(resolveIdentity('unknown.eth')).toBeNull();
});

test('ethicsEnabled reads config flag', () => {
  expect(ethicsEnabled()).toBe(true);
  fs.__setFile(CONFIG_PATH, JSON.stringify({ ethics_anchor: false }));
  expect(ethicsEnabled()).toBe(false);
});

test('onboardPartner records phrase and returns structure', () => {
  const phrase = 'Morals Before Metrics.';
  const result = onboardPartner('demo', 'ghostkey316.eth', phrase);
  expect(result).toEqual({
    message: 'partner onboarded',
    resolved_address: '0x9abCDEF1234567890abcdefABCDEF1234567890'
  });
  const saved = JSON.parse(fs.__getFile(PARTNERS_PATH));
  expect(saved[0].alignment_phrase).toBe(phrase);
});

test('onboardPartner checks for existing partner', () => {
  const phrase = 'Morals Before Metrics.';
  fs.__setFile(PARTNERS_PATH, JSON.stringify([{ partner_id: 'demo', wallet: 'ghostkey316.eth' }]));
  const result = onboardPartner('demo', 'ghostkey316.eth', phrase);
  expect(result.message).toBe('partner already exists');
});

test('onboardPartner timestamps writes near now', () => {
  const before = Date.now();
  onboardPartner('demo2', 'sample.eth', 'ok');
  const after = Date.now();
  const writeTime = fs.__lastWrite.time;
  expect(writeTime).toBeGreaterThanOrEqual(before);
  expect(writeTime).toBeLessThanOrEqual(after);
});

