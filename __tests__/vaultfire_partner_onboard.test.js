const path = require('path');
const fs = require('fs');

jest.mock('fs', () => {
  let files = {};
  const mock = {
    readFileSync: jest.fn((p) => {
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
    mkdirSync: jest.fn(() => {}),
    __setFile: (p, data) => {
      files[p] = data;
    },
    __getFile: (p) => files[p],
    __reset: () => { files = {}; mock.__lastWrite = undefined; }
  };
  return mock;
});

jest.mock('../node_storage', () => {
  const fs = require('fs');
  const store = new Map();
  return {
    __store: store,
    loadJson: jest.fn(async (key, defaultValue) => (
      store.has(key) ? store.get(key) : defaultValue
    )),
    writeJson: jest.fn(async (key, value) => {
      store.set(key, value);
      fs.writeFileSync(key, JSON.stringify(value, null, 2));
    }),
    shouldUseDatabase: jest.fn(() => false),
    configureForTests: jest.fn(),
    resetForTests: jest.fn(() => store.clear()),
  };
});

const storage = require('../node_storage');
const {
  ALIGNMENT_PHRASE,
  alignmentSignature,
  onboardPartner,
  resolveIdentity,
  ethicsEnabled,
} = require('../vaultfire_partner_onboard');

const CORE_CONFIG_PATH = path.join(__dirname, '..', 'vaultfire-core', 'vaultfire_config.json');
const ROOT_CONFIG_PATH = path.join(__dirname, '..', 'vaultfire_config.json');
const PARTNERS_PATH = path.join(__dirname, '..', 'partners.json');

beforeEach(() => {
  fs.__reset();
  storage.__store.clear();
  fs.__setFile(CORE_CONFIG_PATH, JSON.stringify({ ethics_anchor: true, partner_hooks_enabled: true }));
  fs.__setFile(ROOT_CONFIG_PATH, JSON.stringify({ ethics_anchor: true, partner_hooks_enabled: true, use_database: false }));
});

test('resolveIdentity validates ENS, cb.id, and raw addresses', () => {
  expect(resolveIdentity('ghostkey316.eth')).toBe('0x9abCDEF1234567890abcdefABCDEF1234567890');
  expect(resolveIdentity('GhostKey316.ETH')).toBe('0x9abCDEF1234567890abcdefABCDEF1234567890');
  expect(resolveIdentity('bpow20.cb.id')).toBe('cb1qexampleaddress0000000000000000000000');
  expect(resolveIdentity('BPOW20.CB.ID')).toBe('cb1qexampleaddress0000000000000000000000');
  expect(resolveIdentity('unknown.eth')).toBeNull();
  expect(resolveIdentity('0x000000000000000000000000000000000000dead')).toBe('0x000000000000000000000000000000000000dead');
  expect(resolveIdentity('atlantech.eth')).toBe('0x1111111111111111111111111111111111111111');
});

test('ethicsEnabled reads config flag', () => {
  expect(ethicsEnabled()).toBe(true);
  fs.__setFile(ROOT_CONFIG_PATH, JSON.stringify({ ethics_anchor: false, partner_hooks_enabled: true }));
  expect(ethicsEnabled()).toBe(false);
});

test('onboardPartner enforces phrase and stores hashed signature', async () => {
  const result = await onboardPartner('demo', 'ghostkey316.eth', ALIGNMENT_PHRASE);
  expect(result).toEqual({
    message: 'partner onboarded',
    resolved_address: '0x9abCDEF1234567890abcdefABCDEF1234567890',
    alignment_signature: alignmentSignature(ALIGNMENT_PHRASE),
  });
  const saved = storage.__store.get(PARTNERS_PATH);
  expect(saved[0].alignment_signature).toBe(alignmentSignature(ALIGNMENT_PHRASE));
  expect(saved[0].wallet_alias).toBe('ghostkey316.eth');
});

test('onboardPartner checks for existing partner', async () => {
  storage.__store.set(PARTNERS_PATH, [{ partner_id: 'demo', wallet: 'ghostkey316.eth' }]);
  const result = await onboardPartner('demo', 'ghostkey316.eth', ALIGNMENT_PHRASE);
  expect(result.message).toBe('partner already exists');
});

test('onboardPartner timestamps writes near now', async () => {
  const before = Date.now();
  await onboardPartner('demo2', 'sample.eth', ALIGNMENT_PHRASE);
  const after = Date.now();
  const writeTime = fs.__lastWrite.time;
  expect(writeTime).toBeGreaterThanOrEqual(before);
  expect(writeTime).toBeLessThanOrEqual(after);
});

test('rejects incorrect alignment phrase', async () => {
  await expect(onboardPartner('demo3', 'sample.eth', 'Different Phrase')).rejects.toThrow('Alignment phrase mismatch');
});

