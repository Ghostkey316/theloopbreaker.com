const ALLOWED_DOMAINS = ['.eth', '.cb.id'];
const FALLBACK_DOMAIN = 'vaultfire.eth';
const ROSTER_URL = '../data/partner-roster.json';

let rosterPromise = null;

async function loadRoster() {
  if (!rosterPromise) {
    rosterPromise = fetch(ROSTER_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load pilot roster');
        }
        return response.json();
      })
      .then((payload) => {
        if (!Array.isArray(payload)) {
          return [];
        }
        return payload
          .map((entry) => ({
            identifier: typeof entry.identifier === 'string' ? entry.identifier.toLowerCase() : null,
            address: entry.address || null,
          }))
          .filter((entry) => entry.identifier && entry.address);
      })
      .catch((error) => {
        console.warn('[live-pilot] failed to load roster', error); // staging log only
        return [];
      });
  }
  return rosterPromise;
}

function authenticateWallet(identifier, acceptedDomains = ALLOWED_DOMAINS) {
  let name = identifier.trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(name)) {
    return name;
  }
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

async function resolveAddress(identifier) {
  const wallet = authenticateWallet(identifier);
  if (wallet.startsWith('0x')) {
    return wallet;
  }
  const roster = await loadRoster();
  const match = roster.find((entry) => entry.identifier === wallet);
  return match ? match.address : null;
}

async function handleLogin(event) {
  event.preventDefault();
  const input = document.getElementById('walletInput');
  const result = document.getElementById('walletResult');
  try {
    const addr = await resolveAddress(input.value);
    result.textContent = addr || 'Unknown wallet';
  } catch (err) {
    result.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('walletForm').addEventListener('submit', handleLogin);
});
