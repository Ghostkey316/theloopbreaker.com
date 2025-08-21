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

module.exports = { activateCore, injectVaultfire };
