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

module.exports = { activateCore };
