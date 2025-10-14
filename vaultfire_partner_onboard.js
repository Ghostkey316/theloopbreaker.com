// Reference: ethics/core.mdx
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadJson, writeJson } = require('./node_storage');

const CONFIG_PATH = path.join(__dirname, 'vaultfire_config.json');
const CORE_CONFIG_PATH = path.join(__dirname, 'vaultfire-core', 'vaultfire_config.json');
const PARTNERS_PATH = path.join(__dirname, 'partners.json');
const MODULE_TIERS_PATH = path.join(__dirname, 'vaultfire', 'module_tiers.json');
const ALIGNMENT_PHRASE = 'Morals Before Metrics.';

const ENS_MAP = {
  'ghostkey316.eth': '0x9abCDEF1234567890abcdefABCDEF1234567890',
  'sample.eth': '0x0000000000000000000000000000000000000001',
  'atlantech.eth': '0x1111111111111111111111111111111111111111',
  'luminetwork.eth': '0x2222222222222222222222222222222222222222',
  'ethicallens.eth': '0x3333333333333333333333333333333333333333',
  'civicforge.eth': '0x4444444444444444444444444444444444444444',
  'harmonics.eth': '0x5555555555555555555555555555555555555555',
};

const CB_ID_MAP = {
  'bpow20.cb.id': 'cb1qexampleaddress0000000000000000000000',
  'atlantech.cb.id': 'cb1qatlantech0000000000000000000000000',
  'luminetwork.cb.id': 'cb1qluminetwork00000000000000000000000',
  'ethicallens.cb.id': 'cb1qethicallens0000000000000000000000',
  'civicforge.cb.id': 'cb1qcivicforge00000000000000000000000',
  'harmonics.cb.id': 'cb1qharmonics000000000000000000000000',
};

function alignmentSignature(phrase) {
  return crypto.createHash('sha256').update(phrase.trim().toLowerCase()).digest('hex');
}

function normalizeEns(name) {
  return name.toLowerCase();
}

function resolveIdentity(identifier) {
  const id = identifier.toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(id)) {
    return id;
  }
  if (id.endsWith('.eth')) {
    return ENS_MAP[normalizeEns(id)] || null;
  }
  if (id.endsWith('.cb.id')) {
    return CB_ID_MAP[id] || null;
  }
  return null;
}

function readConfig(pathname) {
  try {
    const raw = fs.readFileSync(pathname, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readModuleTiers() {
  try {
    const raw = fs.readFileSync(MODULE_TIERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { core: [], optional: [], advanced: [] };
  }
}

function flattenModuleSets(tiers) {
  const seen = new Set();
  const ordered = [];
  tiers.forEach((tier) => {
    tier.forEach((entry) => {
      const name = entry?.name;
      if (!name || seen.has(name)) {
        return;
      }
      ordered.push({ name, status: entry.status || 'pending_audit' });
      seen.add(name);
    });
  });
  return ordered;
}

function normalizeMode(mode) {
  const normalized = (mode || '').toString().trim().toLowerCase();
  if (!normalized || normalized === 'full' || normalized === 'full_stack') {
    return 'full stack';
  }
  if (normalized === 'lite' || normalized === 'light') {
    return 'lite';
  }
  if (normalized === 'full stack') {
    return normalized;
  }
  throw new Error(`Unsupported onboarding mode: ${mode}`);
}

function resolveModulesForMode(mode) {
  const tiers = readModuleTiers();
  const normalized = normalizeMode(mode);
  if (normalized === 'lite') {
    return flattenModuleSets([tiers.core || []]);
  }
  return flattenModuleSets([tiers.core || [], tiers.optional || [], tiers.advanced || []]);
}

function ethicsEnabled() {
  const primary = readConfig(CONFIG_PATH);
  const fallback = readConfig(CORE_CONFIG_PATH);
  const config = { ...fallback, ...primary };
  return Boolean(config.ethics_anchor && config.partner_hooks_enabled !== false);
}

function validateAlignmentPhrase(phrase) {
  return phrase && phrase.trim().toLowerCase() === ALIGNMENT_PHRASE.toLowerCase();
}

async function onboardPartner(partnerId, walletAddress, alignmentPhrase, options = {}) {
  if (!partnerId) {
    throw new Error('partner_id missing');
  }
  if (!validateAlignmentPhrase(alignmentPhrase)) {
    throw new Error('Alignment phrase mismatch');
  }
  if (!ethicsEnabled()) {
    throw new Error('Ethics anchor disabled. Onboarding halted.');
  }

  const resolved = resolveIdentity(walletAddress);
  if (!resolved) {
    throw new Error('Unrecognized wallet identifier');
  }

  const partners = await loadJson(PARTNERS_PATH, []);
  if (partners.some((p) => p.partner_id === partnerId)) {
    return { message: 'partner already exists', resolved_address: resolved };
  }

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const onboardingMode = normalizeMode(options.mode || 'full_stack');
  const moduleRoster = resolveModulesForMode(onboardingMode);
  const entry = {
    partner_id: partnerId,
    wallet: resolved,
    wallet_alias: walletAddress,
    resolved_wallet: resolved,
    alignment_signature: alignmentSignature(alignmentPhrase),
    onboarded_at: timestamp,
    onboarding_mode: onboardingMode,
    module_roster: moduleRoster,
  };
  partners.push(entry);
  await writeJson(PARTNERS_PATH, partners);

  return {
    message: 'partner onboarded',
    resolved_address: resolved,
    alignment_signature: entry.alignment_signature,
    onboarding_mode: onboardingMode,
    modules: moduleRoster,
  };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const modeFlagIndex = args.findIndex((value) => value === '--mode');
    let onboardingMode = 'full_stack';
    if (modeFlagIndex !== -1) {
      onboardingMode = args[modeFlagIndex + 1] || onboardingMode;
      args.splice(modeFlagIndex, 2);
    }
    const [partnerId, walletAddress, ...phraseParts] = args;
    const alignmentPhrase = phraseParts.join(' ');

    if (!partnerId || !walletAddress || !alignmentPhrase) {
      console.error('Usage: node vaultfire_partner_onboard.js <partner_id> <wallet_address> <alignment_phrase> [--mode <lite|full_stack>]');
      process.exit(1);
    }

    try {
      const result = await onboardPartner(partnerId, walletAddress, alignmentPhrase, { mode: onboardingMode });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  ALIGNMENT_PHRASE,
  onboardPartner,
  resolveIdentity,
  ethicsEnabled,
  alignmentSignature,
  resolveModulesForMode,
};
