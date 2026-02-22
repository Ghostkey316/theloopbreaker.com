/**
 * Vaultfire Wallet — Browser-compatible wallet management.
 * Uses ethers.js v6 for keypair generation.
 *
 * SECURITY: Private keys and mnemonics are encrypted with AES-256-GCM
 * using a user-provided password via PBKDF2 key derivation (100,000 iterations).
 * The password is NEVER stored — only the encrypted ciphertext is persisted.
 * Even if localStorage is compromised, keys are useless without the password.
 */

const STORAGE_KEYS = {
  ENCRYPTED_VAULT: 'vaultfire_wallet_vault_v2',  // encrypted {pk, mnemonic}
  ADDRESS: 'vaultfire_wallet_address',
  WALLET_CREATED: 'vaultfire_wallet_created',
  // Legacy keys (v1) — for migration detection only, never read as plaintext
  LEGACY_PK: 'vaultfire_wallet_pk',
  LEGACY_MNEMONIC: 'vaultfire_wallet_mnemonic',
};

// ─── Crypto helpers (Web Crypto API — built into all modern browsers) ─────────

interface EncryptedVault {
  salt: string;   // base64 — random 16 bytes for PBKDF2
  iv: string;     // base64 — random 12 bytes for AES-GCM
  ct: string;     // base64 — AES-256-GCM ciphertext + auth tag
  v: number;      // vault version
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBuf(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(
  data: { pk: string; mnemonic: string },
  password: string
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(JSON.stringify(data))
  );
  return {
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    ct: bufToBase64(ct),
    v: 2,
  };
}

async function decryptVault(
  vault: EncryptedVault,
  password: string
): Promise<{ pk: string; mnemonic: string }> {
  const salt = base64ToBuf(vault.salt);
  const iv = base64ToBuf(vault.iv);
  const ct = base64ToBuf(vault.ct);
  const key = await deriveKey(password, salt);
  const dec = new TextDecoder();
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ct.buffer as ArrayBuffer);
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('Incorrect password or corrupted vault');
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageSet(key: string, value: string): void {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(key, value); } catch { /* Storage full */ }
  }
}

function storageGet(key: string): string | null {
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return null;
}

function storageDelete(key: string): void {
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

// ─── Session key cache (in-memory only, never persisted) ─────────────────────
// Cleared automatically when the page is unloaded.
// This avoids re-prompting for password on every operation during a session.
let sessionPrivateKey: string | null = null;
let sessionMnemonic: string | null = null;

export function setSessionKey(pk: string, mnemonic: string): void {
  sessionPrivateKey = pk;
  sessionMnemonic = mnemonic;
}

export function clearSession(): void {
  sessionPrivateKey = null;
  sessionMnemonic = null;
}

export function getSessionPrivateKey(): string | null {
  return sessionPrivateKey;
}

export function getSessionMnemonic(): string | null {
  return sessionMnemonic;
}

// ─── Legacy migration detection ───────────────────────────────────────────────

export function hasLegacyUnencryptedWallet(): boolean {
  // v1 wallets stored raw private keys — detect and prompt migration
  return !!storageGet(STORAGE_KEYS.LEGACY_PK) && !storageGet(STORAGE_KEYS.ENCRYPTED_VAULT);
}

export async function migrateLegacyWallet(password: string): Promise<void> {
  const pk = storageGet(STORAGE_KEYS.LEGACY_PK);
  const mnemonic = storageGet(STORAGE_KEYS.LEGACY_MNEMONIC) || '';
  if (!pk) throw new Error('No legacy wallet found');
  const vault = await encryptVault({ pk, mnemonic }, password);
  storageSet(STORAGE_KEYS.ENCRYPTED_VAULT, JSON.stringify(vault));
  // Securely remove legacy unencrypted keys
  storageDelete(STORAGE_KEYS.LEGACY_PK);
  storageDelete(STORAGE_KEYS.LEGACY_MNEMONIC);
  // Cache in session
  setSessionKey(pk, mnemonic);
}

// ─── Wallet types ─────────────────────────────────────────────────────────────

export interface WalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

// ─── Wallet creation & import ─────────────────────────────────────────────────

export async function createWallet(password: string): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic?.phrase || '';
  const address = wallet.address;
  const privateKey = wallet.privateKey;
  // Encrypt with user password before storing
  const vault = await encryptVault({ pk: privateKey, mnemonic }, password);
  storageSet(STORAGE_KEYS.ENCRYPTED_VAULT, JSON.stringify(vault));
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');
  // Cache in session memory
  setSessionKey(privateKey, mnemonic);
  return { address, mnemonic, privateKey };
}

export async function importFromMnemonic(phrase: string, password: string): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.fromPhrase(phrase.trim());
  const address = wallet.address;
  const privateKey = wallet.privateKey;
  const vault = await encryptVault({ pk: privateKey, mnemonic: phrase.trim() }, password);
  storageSet(STORAGE_KEYS.ENCRYPTED_VAULT, JSON.stringify(vault));
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');
  setSessionKey(privateKey, phrase.trim());
  return { address, mnemonic: phrase.trim(), privateKey };
}

export async function importFromPrivateKey(pk: string, password: string): Promise<WalletData> {
  const { ethers } = await import('ethers');
  const key = pk.startsWith('0x') ? pk : `0x${pk}`;
  const wallet = new ethers.Wallet(key);
  const address = wallet.address;
  const vault = await encryptVault({ pk: key, mnemonic: '' }, password);
  storageSet(STORAGE_KEYS.ENCRYPTED_VAULT, JSON.stringify(vault));
  storageSet(STORAGE_KEYS.ADDRESS, address);
  storageSet(STORAGE_KEYS.WALLET_CREATED, 'true');
  setSessionKey(key, '');
  return { address, mnemonic: '', privateKey: key };
}

// ─── Wallet unlock ────────────────────────────────────────────────────────────

export async function unlockWallet(password: string): Promise<WalletData> {
  const vaultJson = storageGet(STORAGE_KEYS.ENCRYPTED_VAULT);
  if (!vaultJson) throw new Error('No encrypted wallet found');
  const vault: EncryptedVault = JSON.parse(vaultJson);
  const { pk, mnemonic } = await decryptVault(vault, password);
  const address = storageGet(STORAGE_KEYS.ADDRESS) || '';
  setSessionKey(pk, mnemonic);
  return { address, mnemonic, privateKey: pk };
}

// ─── Status & accessors ───────────────────────────────────────────────────────

export function isWalletCreated(): boolean {
  return storageGet(STORAGE_KEYS.WALLET_CREATED) === 'true';
}

export function getWalletAddress(): string | null {
  return storageGet(STORAGE_KEYS.ADDRESS);
}

/**
 * Get private key from session cache ONLY.
 * Returns null if wallet is locked (session not yet unlocked).
 * NEVER reads from localStorage — private key is only in memory.
 */
export function getWalletPrivateKey(): string | null {
  return sessionPrivateKey;
}

/**
 * Get mnemonic from session cache ONLY.
 * Returns null if wallet is locked.
 */
export function getWalletMnemonic(): string | null {
  return sessionMnemonic;
}

export function isWalletUnlocked(): boolean {
  return sessionPrivateKey !== null;
}

export function deleteWallet(): void {
  Object.values(STORAGE_KEYS).forEach(storageDelete);
  clearSession();
}
