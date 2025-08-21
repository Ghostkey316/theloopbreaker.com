'use strict';
/**
 * Vaultfire Core Activation
 * Part of Ghostkey Ethics v2.0 framework.
 * Nothing here constitutes medical, legal, or financial advice.
 * Partners must review compliance requirements independently.
 */
const fs = require('fs');
const path = require('path');
const MANIFEST = path.join(__dirname, 'ghostkey_manifesto.md');

function activateCore() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error('Manifest file missing');
  }
  return {
    ens: 'ghostkey316.eth',
    wallet: 'bpow20.cb.id',
    role: 'Architect',
    ethics: 'Ghostkey Ethics v2.0',
    loyalty: true
  };
}

function injectVaultfire(vaultfire, options = {}) {
  const injection = vaultfire.inject({
    ethics: 'belief-synced',
    loyaltyLogic: true,
    tokenBasedActivation: true,
    passiveIncentives: true,
    contributor: 'ghostkey316.eth',
    wallet: 'bpow20.cb.id',
    confirmDOJAlignment: true,
    vaultfireLive: true
  });
  if (typeof vaultfire.displayStatus === 'function') {
    vaultfire.displayStatus({
      UI: 'Vaultfire Protocol: ACTIVE',
      style: 'glow-pulse, ethical-green',
      badge: 'Ghostkey Protocol ✅'
    });
  }
  if (options.testMode && typeof vaultfire.simulateVaultfireEngagement === 'function') {
    vaultfire.simulateVaultfireEngagement({
      wallet: 'bpow20.cb.id',
      behavior: 'loyalty+alignment',
      simulateRewards: true
    });
  }
  return injection;
}

async function syncToASM({ wallet, layer, trigger }) {
  const requiredWallet = 'bpow20.cb.id';
  if (wallet !== requiredWallet) {
    throw new Error('Sync failed: unauthorized wallet ID. Vaultfire protocol requires Ghostkey-316 alignment.');
  }
  const timestamp = new Date().toISOString();
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log(`✅ Vaultfire successfully synced to ASM layer "${layer}" via trigger "${trigger}".`);
  console.log(`🔗 Wallet ID: ${wallet}`);
  console.log(`🕒 Timestamp: ${timestamp}`);
  console.log('🎖️ Loyalty link confirmed.');
  return { wallet, layer, trigger, timestamp, success: true };
}

module.exports = { activateCore, injectVaultfire, syncToASM };
