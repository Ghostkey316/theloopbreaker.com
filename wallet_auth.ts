import { getDefaultIdentityResolver, IdentityResolver } from './lib/identityResolver';

const ALLOWED_DOMAINS = ['.eth', '.cb.id'];
const FALLBACK_DOMAIN = 'vaultfire.eth';

const defaultResolver = getDefaultIdentityResolver();

function isValidIdentifier(name: string): boolean {
  return /^[a-z0-9.-]+$/.test(name) && !(/[\s/]/.test(name));
}

export function authenticateWallet(identifier: string, acceptedDomains: string[] = ALLOWED_DOMAINS): string {
  let name = identifier.trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(name)) {
    return name;
  }
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

export async function resolveAddress(identifier: string, resolver: IdentityResolver = defaultResolver): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();
  if (!isValidIdentifier(normalized)) {
    return null;
  }
  const wallet = authenticateWallet(normalized);
  try {
    const resolved = await resolver.resolve(wallet);
    if (resolved) {
      return resolved;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[wallet-auth] dynamic identity resolution failed', error instanceof Error ? error.message : error);
  }
  if (wallet.startsWith('0x') && wallet.length === 42) {
    return wallet;
  }
  return null;
}
