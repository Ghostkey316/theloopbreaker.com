const { activateCore } = require('../vaultfire_core');
const { initLoyalty } = require('../vaultfire_loyalty');

test('activateCore returns partner metadata', () => {
  const meta = activateCore();
  expect(meta.ens).toBe('ghostkey316.eth');
  expect(meta.wallet).toBe('bpow20.cb.id');
  expect(meta.role).toBe('Architect');
  expect(meta.loyalty).toBe(true);
});

test('initLoyalty returns loyalty record', () => {
  const record = initLoyalty('alice');
  expect(record.user).toBe('alice');
  expect(record.loyaltyProtocol).toBe(true);
  expect(typeof record.timestamp).toBe('string');
});

