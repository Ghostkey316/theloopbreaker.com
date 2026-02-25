/**
 * Vaultfire Auth — Comprehensive Authentication & Session System
 *
 * Provides:
 * 1. Session-based auth using wallet address (session tokens generated on wallet unlock)
 * 2. API key support for external SDK developers
 * 3. Request signing verification (HMAC-SHA256)
 * 4. Rate limiting per session (sliding window, burst protection)
 * 5. CORS protection with origin allowlisting
 * 6. Proper error responses with status codes (401, 403, 429)
 *
 * Strategy:
 * - On wallet unlock, a session token is generated and cached
 * - The AES-256-GCM encrypted vault lives in localStorage (survives browser close)
 * - sessionStorage holds ephemeral encrypted blobs (survives tab refresh only)
 * - API keys are hashed and stored server-side in memory (Map) for SDK access
 * - Request signing uses HMAC-SHA256 for tamper detection
 */

/* ═══════════════════════════════════════════════════════
   CONSTANTS & TYPES
   ═══════════════════════════════════════════════════════ */

const SESSION_KEYS = {
  BLOB: 'vf_session_blob',
  KEY: 'vf_session_key',
  ADDRESS: 'vf_session_address',
  TOKEN: 'vf_session_token',
};

export interface SessionData {
  address: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
}

export interface APIKeyData {
  keyHash: string;
  ownerAddress: string;
  label: string;
  permissions: APIPermission[];
  createdAt: number;
  expiresAt: number;
  rateLimit: number; // requests per minute
  lastUsed: number;
  usageCount: number;
  active: boolean;
}

export type APIPermission = 'read' | 'write' | 'admin';

export interface AuthResult {
  authenticated: boolean;
  method: 'session' | 'apikey' | 'none';
  address: string | null;
  permissions: APIPermission[];
  error?: string;
  statusCode: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

/* ═══════════════════════════════════════════════════════
   IN-MEMORY CACHES (fastest path)
   ═══════════════════════════════════════════════════════ */

let _sessionPK: string | null = null;
let _sessionMnemonic: string | null = null;
let _sessionAddress: string | null = null;
let _sessionToken: string | null = null;

/* ═══════════════════════════════════════════════════════
   SERVER-SIDE SESSION & API KEY STORES
   ═══════════════════════════════════════════════════════ */

// Session store: token → SessionData
const sessionStore = new Map<string, SessionData>();

// API key store: keyHash → APIKeyData
const apiKeyStore = new Map<string, APIKeyData>();

// Rate limit store: key → timestamps[]
const rateLimitStore = new Map<string, number[]>();

// Session config
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours idle
const API_KEY_PREFIX = 'vf_';

// Rate limit config
const DEFAULT_RATE_LIMIT = 30; // requests per minute
const DEFAULT_BURST_LIMIT = 5; // max burst in 5 seconds
const RATE_LIMIT_WINDOW_MS = 60_000;
const BURST_WINDOW_MS = 5_000;

/* ═══════════════════════════════════════════════════════
   CRYPTO HELPERS
   ═══════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════
   TOKEN GENERATION
   ═══════════════════════════════════════════════════════ */

/**
 * Generate a cryptographically secure session token.
 */
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'vfs_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an API key for SDK developers.
 */
function generateAPIKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return API_KEY_PREFIX + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash an API key for storage (never store raw keys).
 */
async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ═══════════════════════════════════════════════════════
   HMAC REQUEST SIGNING
   ═══════════════════════════════════════════════════════ */

/**
 * Create HMAC-SHA256 signature for request verification.
 */
export async function signRequest(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify HMAC-SHA256 request signature.
 */
export async function verifyRequestSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await signRequest(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/* ═══════════════════════════════════════════════════════
   CLIENT-SIDE SESSION MANAGEMENT
   ═══════════════════════════════════════════════════════ */

/**
 * Called after successful wallet unlock or creation.
 * Generates a session token and caches everything.
 */
export async function persistSession(pk: string, mnemonic: string, address: string): Promise<string> {
  const token = generateSessionToken();

  _sessionPK = pk;
  _sessionMnemonic = mnemonic;
  _sessionAddress = address;
  _sessionToken = token;

  // Register session server-side
  const now = Date.now();
  const session: SessionData = {
    address: address.toLowerCase(),
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastActivity: now,
  };
  sessionStore.set(token, session);

  // Persist to sessionStorage with ephemeral encryption
  try {
    const key = await genKey();
    const keyB64 = await exportKey(key);
    const payload = JSON.stringify({ pk, mnemonic, address, token });
    const blob = await encryptSession(payload, key);
    ssSet(SESSION_KEYS.KEY, keyB64);
    ssSet(SESSION_KEYS.BLOB, blob);
    ssSet(SESSION_KEYS.ADDRESS, address);
    ssSet(SESSION_KEYS.TOKEN, token);
  } catch {
    // sessionStorage encryption failed — in-memory still works
  }

  return token;
}

/**
 * Attempt to restore session from sessionStorage (called on app boot).
 */
export async function restoreSession(): Promise<boolean> {
  if (_sessionPK) return true;

  const keyB64 = ss(SESSION_KEYS.KEY);
  const blob = ss(SESSION_KEYS.BLOB);
  if (!keyB64 || !blob) return false;

  try {
    const key = await importKey(keyB64);
    const plain = await decryptSession(blob, key);
    const parsed = JSON.parse(plain);
    _sessionPK = parsed.pk;
    _sessionMnemonic = parsed.mnemonic;
    _sessionAddress = parsed.address;
    _sessionToken = parsed.token || null;

    // Re-register session if token exists
    if (_sessionToken && _sessionAddress) {
      const now = Date.now();
      if (!sessionStore.has(_sessionToken)) {
        sessionStore.set(_sessionToken, {
          address: _sessionAddress.toLowerCase(),
          token: _sessionToken,
          createdAt: now,
          expiresAt: now + SESSION_TTL_MS,
          lastActivity: now,
        });
      }
    }
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/**
 * Clear all session data (logout).
 */
export function clearSession(): void {
  if (_sessionToken) {
    sessionStore.delete(_sessionToken);
  }
  _sessionPK = null;
  _sessionMnemonic = null;
  _sessionAddress = null;
  _sessionToken = null;
  ssDel(SESSION_KEYS.KEY);
  ssDel(SESSION_KEYS.BLOB);
  ssDel(SESSION_KEYS.ADDRESS);
  ssDel(SESSION_KEYS.TOKEN);
}

export function getSessionPK(): string | null { return _sessionPK; }
export function getSessionMnemonic(): string | null { return _sessionMnemonic; }
export function getSessionAddress(): string | null { return _sessionAddress || ss(SESSION_KEYS.ADDRESS); }
export function getSessionToken(): string | null { return _sessionToken || ss(SESSION_KEYS.TOKEN); }
export function isSessionActive(): boolean { return _sessionPK !== null; }

/* ═══════════════════════════════════════════════════════
   SERVER-SIDE SESSION VALIDATION
   ═══════════════════════════════════════════════════════ */

/**
 * Validate a session token. Returns the session data if valid.
 */
export function validateSessionToken(token: string): SessionData | null {
  if (!token || !token.startsWith('vfs_')) return null;

  const session = sessionStore.get(token);
  if (!session) return null;

  const now = Date.now();

  // Check expiration
  if (now > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }

  // Check idle timeout
  if (now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
    sessionStore.delete(token);
    return null;
  }

  // Update last activity
  session.lastActivity = now;
  return session;
}

/**
 * Create a new server-side session for a wallet address.
 */
export function createServerSession(address: string): SessionData {
  const token = generateSessionToken();
  const now = Date.now();
  const session: SessionData = {
    address: address.toLowerCase(),
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastActivity: now,
  };
  sessionStore.set(token, session);
  return session;
}

/**
 * Revoke a session token.
 */
export function revokeSession(token: string): boolean {
  return sessionStore.delete(token);
}

/* ═══════════════════════════════════════════════════════
   API KEY MANAGEMENT
   ═══════════════════════════════════════════════════════ */

/**
 * Generate a new API key for an SDK developer.
 */
export async function createAPIKey(
  ownerAddress: string,
  label: string,
  permissions: APIPermission[] = ['read'],
  rateLimitOverride?: number,
  ttlMs?: number,
): Promise<{ key: string; keyData: APIKeyData }> {
  const key = generateAPIKey();
  const keyHash = await hashAPIKey(key);
  const now = Date.now();

  const keyData: APIKeyData = {
    keyHash,
    ownerAddress: ownerAddress.toLowerCase(),
    label,
    permissions,
    createdAt: now,
    expiresAt: ttlMs ? now + ttlMs : now + 365 * 24 * 60 * 60 * 1000, // 1 year default
    rateLimit: rateLimitOverride || DEFAULT_RATE_LIMIT,
    lastUsed: 0,
    usageCount: 0,
    active: true,
  };

  apiKeyStore.set(keyHash, keyData);
  return { key, keyData };
}

/**
 * Validate an API key. Returns key data if valid.
 */
export async function validateAPIKey(key: string): Promise<APIKeyData | null> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = await hashAPIKey(key);
  const keyData = apiKeyStore.get(keyHash);
  if (!keyData) return null;

  // Check if active
  if (!keyData.active) return null;

  // Check expiration
  if (Date.now() > keyData.expiresAt) {
    keyData.active = false;
    return null;
  }

  // Update usage
  keyData.lastUsed = Date.now();
  keyData.usageCount++;

  return keyData;
}

/**
 * Revoke an API key.
 */
export async function revokeAPIKey(key: string): Promise<boolean> {
  const keyHash = await hashAPIKey(key);
  const keyData = apiKeyStore.get(keyHash);
  if (!keyData) return false;
  keyData.active = false;
  return true;
}

/**
 * List all API keys for an owner address.
 */
export function listAPIKeys(ownerAddress: string): APIKeyData[] {
  const keys: APIKeyData[] = [];
  for (const keyData of apiKeyStore.values()) {
    if (keyData.ownerAddress === ownerAddress.toLowerCase()) {
      keys.push(keyData);
    }
  }
  return keys;
}

/* ═══════════════════════════════════════════════════════
   RATE LIMITING (Sliding Window + Burst Protection)
   ═══════════════════════════════════════════════════════ */

/**
 * Check rate limit for a given key (session token, API key hash, or IP).
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_RATE_LIMIT,
  burstLimit: number = DEFAULT_BURST_LIMIT,
): RateLimitResult {
  const now = Date.now();
  let timestamps = rateLimitStore.get(key);

  if (!timestamps) {
    timestamps = [];
    rateLimitStore.set(key, timestamps);
  }

  // Clean old timestamps outside the window
  const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitStore.set(key, filtered);

  // Check burst limit
  const recentBurst = filtered.filter(t => now - t < BURST_WINDOW_MS).length;
  if (recentBurst >= burstLimit) {
    const oldestBurst = filtered.filter(t => now - t < BURST_WINDOW_MS)[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestBurst + BURST_WINDOW_MS - now,
      limit: maxRequests,
    };
  }

  // Check window limit
  if (filtered.length >= maxRequests) {
    const oldestInWindow = filtered[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + RATE_LIMIT_WINDOW_MS - now,
      limit: maxRequests,
    };
  }

  filtered.push(now);
  return {
    allowed: true,
    remaining: maxRequests - filtered.length,
    resetMs: filtered[0] + RATE_LIMIT_WINDOW_MS - now,
    limit: maxRequests,
  };
}

/* ═══════════════════════════════════════════════════════
   CORS PROTECTION
   ═══════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
  'https://theloopbreaker.com',
  'https://www.theloopbreaker.com',
  'https://vaultfire.dev',
  'https://www.vaultfire.dev',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

/**
 * Generate CORS headers with origin validation.
 */
export function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  let allowedOrigin = ALLOWED_ORIGINS[0]; // default

  if (requestOrigin) {
    if (ALLOWED_ORIGINS.includes(requestOrigin)) {
      allowedOrigin = requestOrigin;
    } else {
      // In development, allow any localhost
      if (requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('http://127.0.0.1:')) {
        allowedOrigin = requestOrigin;
      }
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Session-Token, X-Request-Signature, X-Request-Timestamp',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Powered-By': 'Vaultfire Protocol',
    'Vary': 'Origin',
  };
}

/* ═══════════════════════════════════════════════════════
   UNIFIED AUTHENTICATION MIDDLEWARE
   ═══════════════════════════════════════════════════════ */

/**
 * Authenticate an incoming request using session token or API key.
 * Checks headers: Authorization (Bearer token), X-Session-Token, X-API-Key
 */
export async function authenticateRequest(headers: Headers): Promise<AuthResult> {
  // 1. Try session token from X-Session-Token header
  const sessionToken = headers.get('x-session-token');
  if (sessionToken) {
    const session = validateSessionToken(sessionToken);
    if (session) {
      return {
        authenticated: true,
        method: 'session',
        address: session.address,
        permissions: ['read', 'write'],
        statusCode: 200,
      };
    }
    return {
      authenticated: false,
      method: 'session',
      address: null,
      permissions: [],
      error: 'Invalid or expired session token',
      statusCode: 401,
    };
  }

  // 2. Try Bearer token from Authorization header
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Check if it's a session token
    if (token.startsWith('vfs_')) {
      const session = validateSessionToken(token);
      if (session) {
        return {
          authenticated: true,
          method: 'session',
          address: session.address,
          permissions: ['read', 'write'],
          statusCode: 200,
        };
      }
      return {
        authenticated: false,
        method: 'session',
        address: null,
        permissions: [],
        error: 'Invalid or expired session token',
        statusCode: 401,
      };
    }

    // Check if it's an API key
    if (token.startsWith(API_KEY_PREFIX)) {
      const keyData = await validateAPIKey(token);
      if (keyData) {
        return {
          authenticated: true,
          method: 'apikey',
          address: keyData.ownerAddress,
          permissions: keyData.permissions,
          statusCode: 200,
        };
      }
      return {
        authenticated: false,
        method: 'apikey',
        address: null,
        permissions: [],
        error: 'Invalid or expired API key',
        statusCode: 401,
      };
    }
  }

  // 3. Try API key from X-API-Key header
  const apiKey = headers.get('x-api-key');
  if (apiKey) {
    const keyData = await validateAPIKey(apiKey);
    if (keyData) {
      return {
        authenticated: true,
        method: 'apikey',
        address: keyData.ownerAddress,
        permissions: keyData.permissions,
        statusCode: 200,
      };
    }
    return {
      authenticated: false,
      method: 'apikey',
      address: null,
      permissions: [],
      error: 'Invalid or expired API key',
      statusCode: 401,
    };
  }

  // 4. No authentication provided
  return {
    authenticated: false,
    method: 'none',
    address: null,
    permissions: [],
    error: 'Authentication required. Provide a session token or API key.',
    statusCode: 401,
  };
}

/**
 * Check if auth result has a specific permission.
 */
export function hasPermission(auth: AuthResult, permission: APIPermission): boolean {
  return auth.authenticated && auth.permissions.includes(permission);
}

/* ═══════════════════════════════════════════════════════
   CLEANUP (runs periodically)
   ═══════════════════════════════════════════════════════ */

// Clean up expired sessions and stale rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();

    // Clean expired sessions
    for (const [token, session] of sessionStore) {
      if (now > session.expiresAt || now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        sessionStore.delete(token);
      }
    }

    // Clean stale rate limit entries
    for (const [key, timestamps] of rateLimitStore) {
      const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (filtered.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, filtered);
      }
    }

    // Clean expired API keys
    for (const [hash, keyData] of apiKeyStore) {
      if (now > keyData.expiresAt) {
        apiKeyStore.delete(hash);
      }
    }
  }, 300_000);
}
