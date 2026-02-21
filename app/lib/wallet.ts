/**
 * Vaultfire Wallet — Browser-compatible wallet management.
 * Uses ethers.js v6 for keypair generation.
 * Private key stored in localStorage (with warning — not as secure as native).
 */

const STORAGE_KEYS = {
  PRIVATE_KEY: 'vaultfire_wallet_pk',
  MNEMONIC: 'vaultfire_wallet_mnemonic',
  ADDRESS: 'vaultfire_wallet_address',
  WALLET_CREATED: 'vaultfire_wallet_created',
};

// ─── Storage helpers ──────────────────────────────────────────────────────────
function storageSet(key: string, value: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or unavailable
    }
  }
}

function storageGet(key: string): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function storageDelete(key: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

// ─── Wallet operations ────────────────────────────────────────────────────────
export interface WalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

export async function createWallet(): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic?.phrase || '';
  const address = wallet.address;
  const privateKey = wallet.privateKey;

  storageSet(STORAGE_KEYS.PRIVATE_KEY, privateKey);
  storageSet(STORAGE_KEYS.MNEMONIC, mnemonic);
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');

  return { address, mnemonic, privateKey };
}

export async function importFromMnemonic(phrase: string): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.fromPhrase(phrase.trim());
  const address = wallet.address;
  const privateKey = wallet.privateKey;

  storageSet(STORAGE_KEYS.PRIVATE_KEY, privateKey);
  storageSet(STORAGE_KEYS.MNEMONIC, phrase.trim());
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');

  return { address, mnemonic: phrase.trim(), privateKey };
}

export async function importFromPrivateKey(pk: string): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const key = pk.startsWith('0x') ? pk : `0x${pk}`;
  const wallet = new ethers.Wallet(key);
  const address = wallet.address;

  storageSet(STORAGE_KEYS.PRIVATE_KEY, key);
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');

  return { address, mnemonic: '', privateKey: key };
}

export function isWalletCreated(): boolean {
  return storageGet(STORAGE_KEYS.WALLET_CREATED) === 'true';
}

export function getWalletAddress(): string | null {
  return storageGet(STORAGE_KEYS.ADDRESS);
}

export function getWalletMnemonic(): string | null {
  return storageGet(STORAGE_KEYS.MNEMONIC);
}

export function deleteWallet(): void {
  Object.values(STORAGE_KEYS).forEach(storageDelete);
}
