/**
 * Vaultfire Auth — Session persistence layer.
 *
 * Strategy:
 * - The AES-256-GCM encrypted vault lives in localStorage (survives browser close).
 * - On unlock, we cache the decrypted private key in:
 *     1. In-memory module variable (fastest, cleared on page unload)
 *     2. sessionStorage as a short-lived encrypted blob (survives tab refresh,
 *        cleared when the tab/browser is closed — NOT localStorage).
 *
 * The sessionStorage blob is encrypted with a random ephemeral key that is
 * itself stored in sessionStorage. This means:
 * - Refreshing the page: session restored automatically (no password re-entry).
 * - Closing the tab/browser: session cleared, password required next time.
 * - Explicit logout: both in-memory and sessionStorage cleared.
 *
 * This matches the UX of apps like Coinbase Wallet and Rainbow.
 */

const SESSION_KEYS = {
  BLOB: 'vf_session_blob',
  KEY: 'vf_session_key',
  ADDRESS: 'vf_session_address',
};

// ─── In-memory cache (fastest path) ──────────────────────────────────────────
let _sessionPK: string | null = null;
let _sessionMnemonic: string | null = null;
let _sessionAddress: string | null = null;

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function buf2b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function b642buf(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

async function genKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return buf2b64(raw);
}

async function importKey(b64: string): Promise<CryptoKey> {
  const raw = b642buf(b64);
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSession(data: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, enc.encode(data));
  return JSON.stringify({ iv: buf2b64(iv), ct: buf2b64(ct) });
}

async function decryptSession(blob: string, key: CryptoKey): Promise<string> {
  const { iv, ct } = JSON.parse(blob);
  const dec = new TextDecoder();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b642buf(iv).buffer as ArrayBuffer },
    key,
    b642buf(ct).buffer as ArrayBuffer
  );
  return dec.decode(plain);
}

function ss(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function ssSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, value); } catch { /* quota */ }
}

function ssDel(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called after successful wallet unlock or creation.
 * Caches in memory AND persists to sessionStorage for tab-refresh survival.
 */
export async function persistSession(pk: string, mnemonic: string, address: string): Promise<void> {
  _sessionPK = pk;
  _sessionMnemonic = mnemonic;
  _sessionAddress = address;

  // Persist to sessionStorage with ephemeral encryption
  try {
    const key = await genKey();
    const keyB64 = await exportKey(key);
    const payload = JSON.stringify({ pk, mnemonic, address });
    const blob = await encryptSession(payload, key);
    ssSet(SESSION_KEYS.KEY, keyB64);
    ssSet(SESSION_KEYS.BLOB, blob);
    ssSet(SESSION_KEYS.ADDRESS, address);
  } catch {
    // sessionStorage encryption failed — in-memory still works
  }
}

/**
 * Attempt to restore session from sessionStorage (called on app boot).
 * Returns true if session was successfully restored.
 */
export async function restoreSession(): Promise<boolean> {
  // Already in memory
  if (_sessionPK) return true;

  const keyB64 = ss(SESSION_KEYS.KEY);
  const blob = ss(SESSION_KEYS.BLOB);
  if (!keyB64 || !blob) return false;

  try {
    const key = await importKey(keyB64);
    const plain = await decryptSession(blob, key);
    const { pk, mnemonic, address } = JSON.parse(plain);
    _sessionPK = pk;
    _sessionMnemonic = mnemonic;
    _sessionAddress = address;
    return true;
  } catch {
    // Corrupted or tampered — clear
    clearSession();
    return false;
  }
}

/**
 * Clear all session data (logout).
 */
export function clearSession(): void {
  _sessionPK = null;
  _sessionMnemonic = null;
  _sessionAddress = null;
  ssDel(SESSION_KEYS.KEY);
  ssDel(SESSION_KEYS.BLOB);
  ssDel(SESSION_KEYS.ADDRESS);
}

export function getSessionPK(): string | null { return _sessionPK; }
export function getSessionMnemonic(): string | null { return _sessionMnemonic; }
export function getSessionAddress(): string | null { return _sessionAddress || ss(SESSION_KEYS.ADDRESS); }
export function isSessionActive(): boolean { return _sessionPK !== null; }
