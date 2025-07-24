// Reference: ethics/core.mdx
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'vaultfire-core', 'vaultfire_config.json');
const PARTNERS_PATH = path.join(__dirname, 'partners.json');

const ENS_MAP = {
  'ghostkey316.eth': '0x9abCDEF1234567890abcdefABCDEF1234567890',
  'sample.eth': '0x0000000000000000000000000000000000000001',
};

const CB_ID_MAP = {
  'bpow20.cb.id': 'cb1qexampleaddress0000000000000000000000',
};

function resolveIdentity(identifier) {
  const id = identifier.toLowerCase();
  if (id.endsWith('.eth')) {
    return ENS_MAP[id] || null;
  }
  if (id.endsWith('.cb.id')) {
    return CB_ID_MAP[id] || null;
  }
  return null;
}

function ethicsEnabled() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    return !!cfg.ethics_anchor;
  } catch {
    return false;
  }
}

function onboardPartner(partnerId, walletAddress, alignmentPhrase) {
  if (!ethicsEnabled()) {
    throw new Error('Ethics anchor disabled. Onboarding halted.');
  }

  const resolved = resolveIdentity(walletAddress);
  if (!resolved) {
    throw new Error('Unrecognized wallet identifier');
  }

  let partners = [];
  if (fs.existsSync(PARTNERS_PATH)) {
    try {
      partners = JSON.parse(fs.readFileSync(PARTNERS_PATH, 'utf8'));
    } catch {
      partners = [];
    }
  }

  if (partners.some(p => p.partner_id === partnerId)) {
    return { message: 'partner already exists', resolved_address: resolved };
  }

  partners.push({ partner_id: partnerId, wallet: walletAddress, alignment_phrase: alignmentPhrase });
  fs.writeFileSync(PARTNERS_PATH, JSON.stringify(partners, null, 2));
  return { message: 'partner onboarded', resolved_address: resolved };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const [partnerId, walletAddress, ...phraseParts] = args;
  const alignmentPhrase = phraseParts.join(' ');

  if (!partnerId || !walletAddress || !alignmentPhrase) {
    console.error('Usage: node vaultfire_partner_onboard.js <partner_id> <wallet_address> <alignment_phrase>');
    process.exit(1);
  }

  try {
    const result = onboardPartner(partnerId, walletAddress, alignmentPhrase);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = { onboardPartner, resolveIdentity, ethicsEnabled };
