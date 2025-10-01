const ENS_MAP: Record<string, string> = {
  'ghostkey316.eth': '0x9abCDEF1234567890abcdefABCDEF1234567890',
  'sample.eth': '0x0000000000000000000000000000000000000001',
};

const CB_ID_MAP: Record<string, string> = {
  'bpow20.cb.id': 'cb1qexampleaddress0000000000000000000000',
};

const ALLOWED_DOMAINS = ['.eth', '.cb.id'];
const FALLBACK_DOMAIN = 'vaultfire.eth';

function isValidIdentifier(name: string): boolean {
  return /^[a-z0-9.-]+$/.test(name) && !(/[\s/]/.test(name));
}

export function authenticateWallet(identifier: string, acceptedDomains: string[] = ALLOWED_DOMAINS): string {
  let name = identifier.trim().toLowerCase();
  const hasDomain = /\.[^\.\s]+$/.test(name);

  if (!isValidIdentifier(name)) {
    throw new Error('Invalid wallet identifier');
  }

  if (hasDomain) {
    if (!acceptedDomains.some(domain => name.endsWith(domain))) {
      throw new Error('Wallet domain not accepted');
    }
    return name;
  }

  // fallback to default ENS domain
  if (acceptedDomains.includes('.eth')) {
    return `${name}.${FALLBACK_DOMAIN}`;
  }

  throw new Error('Wallet domain not accepted');
}

export function resolveAddress(identifier: string): string | null {
  if (!isValidIdentifier(identifier.trim().toLowerCase())) {
    return null;
  }
  const wallet = authenticateWallet(identifier);
  if (wallet.endsWith('.eth')) {
    return ENS_MAP[wallet] || null;
  }
  if (wallet.endsWith('.cb.id')) {
    return CB_ID_MAP[wallet] || null;
  }
  return null;
}
