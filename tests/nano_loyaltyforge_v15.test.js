const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  initLoyaltyProfile,
  updateBeliefScore,
  applyMultiplierTier,
  syncWithVaultfire,
  mintLoyaltyToken,
  moduleStatus
} = require('../modules/regen/nano_loyaltyforge_v15');

const statusPath = path.join(__dirname, '..', 'vaultfire-core', 'nano_loyaltyforge_v15_status.json');
const logPath = path.join(__dirname, '..', 'logs', 'nano_loyaltyforge_v15.log');

function reset() {
  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

}
test('nano_loyaltyforge_v15.test', () => {
  reset();
  initLoyaltyProfile('g316', 'wallet1');
  updateBeliefScore('g316', 'action1', 10);
  updateBeliefScore('g316', 'action2', 5);
  applyMultiplierTier('g316', 'Tier3');
  syncWithVaultfire('g316', { trigger: 't', payload: 'p', bonus: 'b' });
  mintLoyaltyToken('g316', 'wallet1', { timestamp: 'now', signature: 'sig' });
  const state = moduleStatus();
  assert(state.profiles['g316'].loyalty === 15);
  assert(state.profiles['g316'].tier === 'Tier3');
  assert(state.syncs.length === 1);
  assert(state.minted.length === 1);
});
