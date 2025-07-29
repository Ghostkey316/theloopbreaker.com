const ENS_MAP = {
  'ghostkey316.eth': '0x9abCDEF1234567890abcdefABCDEF1234567890',
  'sample.eth': '0x0000000000000000000000000000000000000001',
};

const CB_ID_MAP = {
  'bpow20.cb.id': 'cb1qexampleaddress0000000000000000000000',
};

const ALLOWED_DOMAINS = ['.eth', '.cb.id'];
const FALLBACK_DOMAIN = 'vaultfire.eth';

function authenticateWallet(identifier, acceptedDomains = ALLOWED_DOMAINS) {
  let name = identifier.trim().toLowerCase();
  const hasDomain = /\.[^\.\s]+$/.test(name);

  if (hasDomain) {
    if (!acceptedDomains.some(domain => name.endsWith(domain))) {
      throw new Error('Wallet domain not accepted');
    }
    return name;
  }

  if (acceptedDomains.includes('.eth')) {
    return `${name}.${FALLBACK_DOMAIN}`;
  }

  throw new Error('Wallet domain not accepted');
}

function resolveAddress(identifier) {
  const wallet = authenticateWallet(identifier);
  if (wallet.endsWith('.eth')) {
    return ENS_MAP[wallet] || (wallet === 'ghostkey316.eth' ? CB_ID_MAP['bpow20.cb.id'] : null);
  }
  if (wallet.endsWith('.cb.id')) {
    return CB_ID_MAP[wallet] || null;
  }
  return null;
}

function handleLogin(event) {
  event.preventDefault();
  const input = document.getElementById('walletInput');
  const result = document.getElementById('walletResult');
  try {
    const addr = resolveAddress(input.value);
    result.textContent = addr || 'Unknown wallet';
  } catch (err) {
    result.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('walletForm').addEventListener('submit', handleLogin);
});
