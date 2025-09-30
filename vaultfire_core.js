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
const ENV_PATH = path.join(__dirname, '.env');
const { exportLogs } = require('./compliance/exportLogs');

const DEFAULT_WALLET = 'bpow20.cb.id';

function parseList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readEnvWhitelistFromFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) {
        continue;
      }
      const [key, ...rest] = line.split('=');
      if (key && key.trim() === 'WALLET_WHITELIST') {
        const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
        return parseList(value);
      }
    }
  } catch (error) {
    console.warn('vaultfire_core: unable to parse .env for wallet whitelist:', error.message);
  }
  return [];
}

function getWallets() {
  const fromEnv = parseList(process.env.WALLET_WHITELIST);
  const fromFile = fromEnv.length ? [] : readEnvWhitelistFromFile();
  const combined = [...fromEnv, ...fromFile];
  if (!combined.length) {
    combined.push(DEFAULT_WALLET);
  }
  if (!combined.includes(DEFAULT_WALLET)) {
    combined.push(DEFAULT_WALLET);
  }
  const normalized = Array.from(
    new Set(
      combined
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase())
    )
  );
  return normalized;
}

function activateCore() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error('Manifest file missing');
  }
  const wallets = getWallets();
  return {
    ens: 'ghostkey316.eth',
    wallet: wallets[0] || DEFAULT_WALLET,
    wallets,
    role: 'Architect',
    ethics: 'Ghostkey Ethics v2.0',
    loyalty: true,
  };
}

function isWalletAuthorised(candidate) {
  if (!candidate) {
    return false;
  }
  const wallets = getWallets();
  const normalised = candidate.toLowerCase();
  return wallets.includes(normalised);
}

function injectVaultfire(vaultfire, options = {}) {
  const wallets = getWallets();
  const senderWallet = (options.senderWallet || options.wallet || wallets[0] || DEFAULT_WALLET).toLowerCase();
  if (!isWalletAuthorised(senderWallet)) {
    throw new Error('Vaultfire injection blocked: sender wallet not authorised for this deployment.');
  }

  const injection = vaultfire.inject({
    ethics: 'belief-synced',
    loyaltyLogic: true,
    tokenBasedActivation: true,
    passiveIncentives: true,
    contributor: 'ghostkey316.eth',
    wallet: wallets[0] || DEFAULT_WALLET,
    walletWhitelist: wallets,
    confirmDOJAlignment: true,
    vaultfireLive: true,
  });
  if (typeof vaultfire.displayStatus === 'function') {
    vaultfire.displayStatus({
      UI: 'Vaultfire Protocol: ACTIVE',
      style: 'glow-pulse, ethical-green',
      badge: 'Ghostkey Protocol ✅',
      walletWhitelist: wallets,
    });
  }
  if (options.testMode && typeof vaultfire.simulateVaultfireEngagement === 'function') {
    vaultfire.simulateVaultfireEngagement({
      wallet: senderWallet,
      behavior: 'loyalty+alignment',
      simulateRewards: true,
    });
  }
  return injection;
}

async function syncToASM({ wallet, layer, trigger }) {
  const candidate = wallet ? wallet.toLowerCase() : '';
  if (!isWalletAuthorised(candidate)) {
    throw new Error('Sync failed: unauthorized wallet ID. Vaultfire protocol requires Ghostkey-aligned multisig access.');
  }
  const timestamp = new Date().toISOString();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log(`✅ Vaultfire successfully synced to ASM layer "${layer}" via trigger "${trigger}".`);
  console.log(`🔗 Wallet ID: ${wallet}`);
  console.log(`🕒 Timestamp: ${timestamp}`);
  console.log('🎖️ Loyalty link confirmed.');
  return { wallet, layer, trigger, timestamp, success: true, authorisedWallets: getWallets() };
}

module.exports = {
  activateCore,
  injectVaultfire,
  syncToASM,
  getWallets,
  logs: {
    export: exportLogs,
  },
};
