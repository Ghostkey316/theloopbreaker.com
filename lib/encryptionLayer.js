'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.join(__dirname, '..', 'vaultfire.config');
const DEFAULT_AUDIT_LOG = path.join(__dirname, '..', 'audit_logs', 'encryption_audit.log');
const KEYRING_PATH = path.join(__dirname, '..', 'secure_storage', 'keyring.json');
const PREFIX = 'ENC::';
const VERSION = Buffer.from([1]);
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ACTIVE_ITERATIONS = 390_000;
const LEGACY_ITERATIONS = 210_000;
const ENCRYPTION_VERSION = 'v2.3';
const KEY_SOURCE_DEFAULT = 'vaultfire.local';
const LEGACY_WARNING_MESSAGE = 'Legacy Data Unencrypted – Action Required.';

const COMPONENT_HINTS = [
  ['partner-handshake', 'partner'],
  ['partner-sync', 'partner'],
  ['ns3', 'logs'],
  ['sync-log', 'logs'],
  ['telemetry', 'logs'],
  ['reward', 'rewards'],
  ['loyalty', 'loyalty'],
  ['identity', 'identity'],
];

const IDENTITY_KEYS = new Set(['wallet', 'ens', 'address', 'email', 'user', 'username', 'identity', 'name']);

let cachedConfig = null;
let cachedPassphrase = null;
let runtimeOverrideInitialised = false;
const auditedComponents = new Set();
const keySourceCache = new Map();

class LegacyDataError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'LegacyDataError';
    if (cause) {
      this.cause = cause;
    }
  }
}

function walletSalt(wallet, category) {
  const material = `${wallet || 'vaultfire-anon'}::${category}`;
  const digest = crypto.createHash('sha256').update(material).digest();
  if (SALT_LENGTH >= digest.length) {
    return digest;
  }
  return digest.slice(0, SALT_LENGTH);
}

function determineKeySource(sourceHint, hardwarePath) {
  if (typeof sourceHint === 'string' && sourceHint.trim()) {
    const lowered = sourceHint.trim().toLowerCase();
    if (lowered === 'ledger' || lowered === 'trezor') {
      return 'ledger';
    }
    if (lowered === 'vaultfire.local' || lowered === 'local' || lowered === 'file') {
      return KEY_SOURCE_DEFAULT;
    }
  }
  if (hardwarePath) {
    const loweredPath = path.basename(hardwarePath).toLowerCase();
    if (loweredPath.includes('ledger') || loweredPath.includes('trezor')) {
      return 'ledger';
    }
  }
  return KEY_SOURCE_DEFAULT;
}

class KeyManager {
  constructor({ filePath, saltLength }) {
    this.filePath = filePath;
    this.saltLength = saltLength;
    this.records = new Map();
    this.wallet = '';
    this.keySource = KEY_SOURCE_DEFAULT;
    this.iterations = ACTIVE_ITERATIONS;
    this.runtimeOverride = null;
    this._load();
  }

  setRuntimeOverride(secret) {
    if (typeof secret === 'string' && secret.trim()) {
      this.runtimeOverride = Buffer.from(secret.trim(), 'utf8');
    } else if (Buffer.isBuffer(secret)) {
      this.runtimeOverride = Buffer.from(secret);
    } else {
      this.runtimeOverride = null;
    }
  }

  getKey({ wallet, category, rotationDays, iterations, keySourceHint, hardwarePath }) {
    this.iterations = Math.max(iterations, ACTIVE_ITERATIONS);
    this.wallet = wallet;
    this.keySource = determineKeySource(keySourceHint, hardwarePath);

    if (this.runtimeOverride) {
      const salt = walletSalt(wallet, category);
      const key = crypto.pbkdf2Sync(this.runtimeOverride, Buffer.concat([salt, Buffer.from(category, 'utf8')]), this.iterations, KEY_LENGTH, 'sha256');
      return { key, keySource: this.keySource };
    }

    if (hardwarePath && fs.existsSync(hardwarePath)) {
      try {
        const seed = fs.readFileSync(hardwarePath);
        if (seed && seed.length > 0) {
          const salt = walletSalt(wallet, category);
          const key = crypto.pbkdf2Sync(seed, Buffer.concat([salt, Buffer.from(category, 'utf8')]), this.iterations, KEY_LENGTH, 'sha256');
          return { key, keySource: this.keySource };
        }
      } catch (error) {
        // Fall through to stored material
      }
    }

    let record = this.records.get(category);
    const now = Date.now();
    if (!record || (rotationDays > 0 && now - record.rotatedAt >= rotationDays * 86_400_000)) {
      record = this._generateRecord(category, wallet);
      this.records.set(category, record);
      this._persist();
    }
    const seed = Buffer.from(record.seed, 'base64');
    const salt = Buffer.from(record.salt, 'base64');
    const key = crypto.pbkdf2Sync(seed, Buffer.concat([salt, Buffer.from(category, 'utf8')]), record.iterations, KEY_LENGTH, 'sha256');
    return { key, keySource: this.keySource };
  }

  _generateRecord(category, wallet) {
    const seed = crypto.randomBytes(KEY_LENGTH);
    const salt = walletSalt(wallet, category).toString('base64');
    return {
      category,
      seed: seed.toString('base64'),
      salt,
      rotatedAt: Date.now(),
      iterations: this.iterations,
    };
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    try {
      const payload = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (payload && typeof payload === 'object') {
        if (typeof payload.wallet === 'string') {
          this.wallet = payload.wallet;
        }
        if (typeof payload.keySource === 'string') {
          this.keySource = payload.keySource;
        }
        if (typeof payload.iterations === 'number' && payload.iterations > 0) {
          this.iterations = payload.iterations;
        }
        const entries = payload.keys || {};
        if (entries && typeof entries === 'object') {
          for (const [category, record] of Object.entries(entries)) {
            if (!record || typeof record !== 'object') {
              continue;
            }
            const { seed, salt, rotated_at: rotatedAt, iterations } = record;
            if (typeof seed !== 'string' || typeof salt !== 'string') {
              continue;
            }
            const rotation = rotatedAt ? Date.parse(rotatedAt) : Date.now();
            this.records.set(category, {
              category,
              seed,
              salt,
              rotatedAt: Number.isNaN(rotation) ? Date.now() : rotation,
              iterations: typeof iterations === 'number' && iterations > 0 ? iterations : this.iterations,
            });
          }
        }
      }
    } catch (error) {
      // Ignore corrupted keyrings and regenerate on demand
      this.records.clear();
    }
  }

  _persist() {
    const payload = {
      wallet: this.wallet,
      keySource: this.keySource,
      iterations: this.iterations,
      keys: {},
    };
    for (const [category, record] of this.records.entries()) {
      payload.keys[category] = {
        seed: record.seed,
        salt: record.salt,
        rotated_at: new Date(record.rotatedAt).toISOString(),
        iterations: record.iterations,
      };
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (error) {
      // Persist errors are non-fatal; generation will retry next call
    }
  }
}

const keyManager = new KeyManager({ filePath: KEYRING_PATH, saltLength: SALT_LENGTH });

function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const defaults = {
    full_encryption_mode: false,
    audit_log: DEFAULT_AUDIT_LOG,
    passphrase_vault: null,
    hardware_key_path: null,
    wallet_address: 'vaultfire',
    encrypt_logs: true,
    encrypt_rewards: true,
    encrypt_loyalty: true,
    encrypt_partner_sync: true,
    encrypt_identity: false,
    key_rotation_days: 30,
    ghostkey_mode: false,
    ghostkey_mode_override: null,
    key_source: null,
    encryption_overrides: {},
  };
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    cachedConfig = { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch (error) {
    cachedConfig = { ...defaults };
  }
  if (!path.isAbsolute(cachedConfig.audit_log)) {
    cachedConfig.audit_log = path.join(__dirname, '..', cachedConfig.audit_log);
  }
  if (cachedConfig.hardware_key_path && !path.isAbsolute(cachedConfig.hardware_key_path)) {
    cachedConfig.hardware_key_path = path.join(__dirname, '..', cachedConfig.hardware_key_path);
  }
  if (typeof cachedConfig.key_rotation_days !== 'number') {
    const parsed = parseInt(String(cachedConfig.key_rotation_days || 30), 10);
    cachedConfig.key_rotation_days = Number.isNaN(parsed) ? 30 : parsed;
  }
  let overrides = cachedConfig.encryption_overrides;
  if (!overrides || typeof overrides !== 'object') {
    overrides = {};
  }
  cachedConfig.encryption_overrides = overrides;
  if (typeof cachedConfig.ghostkey_mode_override === 'boolean') {
    cachedConfig.ghostkey_mode = cachedConfig.ghostkey_mode_override;
  } else if (typeof cachedConfig.ghostkey_mode_override === 'string') {
    const normalized = cachedConfig.ghostkey_mode_override.trim().toLowerCase();
    cachedConfig.ghostkey_mode = ['true', '1', 'yes', 'on'].includes(normalized);
  }
  return cachedConfig;
}

function setRuntimePassphrase(passphrase) {
  cachedPassphrase = typeof passphrase === 'string' && passphrase.trim() ? passphrase.trim() : null;
  keyManager.setRuntimeOverride(cachedPassphrase);
  runtimeOverrideInitialised = Boolean(cachedPassphrase);
}

function resolvePassphrase() {
  if (cachedPassphrase) {
    return cachedPassphrase;
  }
  const env = process.env.VAULTFIRE_ENCRYPTION_PASSPHRASE;
  if (env && env.trim()) {
    cachedPassphrase = env.trim();
    return cachedPassphrase;
  }
  const config = loadConfig();
  const vaultPath = process.env.VAULTFIRE_PASSPHRASE_VAULT || config.passphrase_vault;
  if (vaultPath) {
    try {
      const vault = fs.readFileSync(vaultPath, 'utf8').trim();
      if (vault) {
        cachedPassphrase = vault;
        return cachedPassphrase;
      }
    } catch (error) {
      // ignore
    }
  }
  const hardwarePath = process.env.VAULTFIRE_HARDWARE_KEY_PATH || config.hardware_key_path;
  if (hardwarePath) {
    try {
      const hardware = fs.readFileSync(hardwarePath, 'utf8').trim();
      if (hardware) {
        cachedPassphrase = hardware;
        return cachedPassphrase;
      }
    } catch (error) {
      // ignore
    }
  }
  return null;
}

function ensureRuntimeOverride() {
  if (runtimeOverrideInitialised) {
    return;
  }
  const secret = resolvePassphrase();
  if (secret) {
    keyManager.setRuntimeOverride(secret);
  }
  runtimeOverrideInitialised = true;
}

function componentCategory(component) {
  if (!component) {
    return 'general';
  }
  const lowered = component.toLowerCase();
  for (const [hint, category] of COMPONENT_HINTS) {
    if (lowered.includes(hint)) {
      return category;
    }
  }
  return 'general';
}

function shouldEncrypt(component) {
  if (!component) {
    return false;
  }
  const config = loadConfig();
  const overrides = config.encryption_overrides || {};
  if (Object.prototype.hasOwnProperty.call(overrides, component)) {
    return Boolean(overrides[component]);
  }
  if (config.ghostkey_mode || config.full_encryption_mode) {
    return true;
  }
  const category = componentCategory(component);
  switch (category) {
    case 'logs':
      return Boolean(config.encrypt_logs);
    case 'rewards':
      return Boolean(config.encrypt_rewards);
    case 'loyalty':
      return Boolean(config.encrypt_loyalty);
    case 'partner':
      return Boolean(config.encrypt_partner_sync);
    case 'identity':
      return Boolean(config.encrypt_identity);
    default:
      return false;
  }
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(text) {
  let normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }
  return Buffer.from(normalized, 'base64');
}

function resolveKey(component) {
  ensureRuntimeOverride();
  const config = loadConfig();
  const category = componentCategory(component);
  const rotationDays = Math.max(parseInt(config.key_rotation_days, 10) || 0, 0);
  const hardwarePath = process.env.VAULTFIRE_HARDWARE_KEY_PATH || config.hardware_key_path;
  const { key, keySource } = keyManager.getKey({
    wallet: config.wallet_address,
    category,
    rotationDays,
    iterations: ACTIVE_ITERATIONS,
    keySourceHint: config.key_source,
    hardwarePath,
  });
  keySourceCache.set(component, keySource);
  return key;
}

function deriveKey(component, salt) {
  const baseKey = resolveKey(component);
  const saltMaterial = Buffer.concat([salt, Buffer.from(component, 'utf8')]);
  return crypto.pbkdf2Sync(baseKey, saltMaterial, ACTIVE_ITERATIONS, KEY_LENGTH, 'sha256');
}

function deriveLegacyKey(component, salt) {
  const passphrase = resolvePassphrase();
  if (!passphrase) {
    return null;
  }
  const saltMaterial = Buffer.concat([salt, Buffer.from(component, 'utf8')]);
  return crypto.pbkdf2Sync(passphrase, saltMaterial, LEGACY_ITERATIONS, KEY_LENGTH, 'sha256');
}

function hashPayload(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function ghostkeyScrub(payload) {
  const sanitized = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (IDENTITY_KEYS.has(lower)) {
      continue;
    }
    if (lower.includes('wallet') && !lower.includes('hash')) {
      sanitized.wallet_hash = sanitized.wallet_hash || hashPayload(value);
      continue;
    }
    if (lower.includes('fingerprint')) {
      sanitized[key] = hashPayload(JSON.stringify(value));
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = ghostkeyScrub(value);
      continue;
    }
    sanitized[key] = value;
  }
  if (!Object.prototype.hasOwnProperty.call(sanitized, 'wallet_hash') && Object.prototype.hasOwnProperty.call(payload, 'wallet')) {
    sanitized.wallet_hash = hashPayload(payload.wallet);
  }
  return sanitized;
}

function audit(action, component, success, extra = {}) {
  const config = loadConfig();
  const data = { ...extra };
  const payloadHash = data.payload_hash;
  delete data.payload_hash;
  const entry = {
    timestamp: new Date().toISOString(),
    host: os.hostname(),
    pid: process.pid,
    component,
    action,
    success: Boolean(success),
    mode: config.full_encryption_mode ? 'full' : 'disabled',
    encryptionVersion: ENCRYPTION_VERSION,
    ...data,
  };
  if (payloadHash) {
    entry.payload_hash = payloadHash;
  }
  try {
    fs.mkdirSync(path.dirname(config.audit_log), { recursive: true });
    fs.appendFileSync(config.audit_log, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    // ignore audit failures
  }
}

function recordAuditOnce(component) {
  if (auditedComponents.has(component)) {
    return;
  }
  auditedComponents.add(component);
  audit('encrypt-init', component, true);
}

function encrypt(component, plaintext) {
  if (!shouldEncrypt(component)) {
    return { encrypted: false, value: plaintext };
  }
  const payloadHash = hashPayload(plaintext);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(component, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(component, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([VERSION, salt, iv, ciphertext, tag]);
  const token = PREFIX + base64UrlEncode(payload);
  recordAuditOnce(component);
  const keySource = keySourceCache.get(component) || KEY_SOURCE_DEFAULT;
  audit('encrypt', component, true, { bytes: ciphertext.length, payload_hash: payloadHash, keySource });
  return { encrypted: true, value: token };
}

function decrypt(component, token) {
  if (typeof token !== 'string' || !token.startsWith(PREFIX)) {
    return token;
  }
  const encoded = token.slice(PREFIX.length);
  const payload = base64UrlDecode(encoded);
  if (payload.length <= 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted payload too small');
  }
  const version = payload[0];
  if (version !== VERSION[0]) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }
  const saltStart = 1;
  const saltEnd = saltStart + SALT_LENGTH;
  const ivEnd = saltEnd + IV_LENGTH;
  const data = payload.slice(ivEnd, payload.length - TAG_LENGTH);
  const tag = payload.slice(payload.length - TAG_LENGTH);
  const iv = payload.slice(saltEnd, ivEnd);
  const salt = payload.slice(saltStart, saltEnd);
  const key = deriveKey(component, salt);
  let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(component, 'utf8'));
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (error) {
    const legacyKey = deriveLegacyKey(component, salt);
    if (!legacyKey) {
      throw error;
    }
    decipher = crypto.createDecipheriv('aes-256-gcm', legacyKey, iv);
    decipher.setAAD(Buffer.from(component, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
  }
}

function serialize(component, payload) {
  if (payload === null || payload === undefined) {
    return null;
  }
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = encrypt(component, text);
  if (!result.encrypted) {
    return text;
  }
  return result.value;
}

function deserialize(component, raw) {
  if (raw === null || raw === undefined) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    if (!raw.startsWith(PREFIX)) {
      return JSON.parse(raw);
    }
  } catch (error) {
    // fall through to encrypted path
  }
  const decrypted = decrypt(component, raw);
  try {
    return JSON.parse(decrypted);
  } catch (error) {
    return decrypted;
  }
}

const META_KEYS = new Set(['__vaultfire_encrypted__', 'encrypted', 'version', 'component', 'encryption']);

function wrapObject(component, data, { preserveKeys = [] } = {}) {
  const preserveSet = new Set(preserveKeys);
  const config = loadConfig();
  const working = config.ghostkey_mode ? ghostkeyScrub(data) : { ...data };
  if (!shouldEncrypt(component)) {
    return { ...working };
  }
  const preserved = {};
  for (const key of preserveSet) {
    if (Object.prototype.hasOwnProperty.call(working, key)) {
      preserved[key] = working[key];
    }
  }
  const sensitive = {};
  for (const [key, value] of Object.entries(working)) {
    if (preserveSet.has(key)) {
      continue;
    }
    sensitive[key] = value;
  }
  const serialized = JSON.stringify(sensitive);
  const encrypted = encrypt(component, serialized);
  if (!encrypted.encrypted) {
    return { ...working };
  }
  const mode = config.full_encryption_mode || config.ghostkey_mode ? 'full' : 'selective';
  const keySource = keySourceCache.get(component) || KEY_SOURCE_DEFAULT;
  return {
    ...preserved,
    encryption: {
      component,
      version: 1,
      mode,
      keySource,
      vaultfireEncryption: ENCRYPTION_VERSION,
    },
    __vaultfire_encrypted__: true,
    encrypted: encrypted.value,
  };
}

function unwrapObject(component, stored) {
  if (!stored || typeof stored !== 'object') {
    return stored;
  }
  const marker = stored.__vaultfire_encrypted__ && typeof stored.encrypted === 'string';
  if (!marker) {
    return stored;
  }
  const inferredComponent = component || (stored.encryption && stored.encryption.component) || component;
  const decrypted = decrypt(inferredComponent, stored.encrypted);
  const sensitive = JSON.parse(decrypted);
  const merged = { ...sensitive };
  for (const [key, value] of Object.entries(stored)) {
    if (META_KEYS.has(key)) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function migrateLegacyFile(component, filePath, { preserveKeys = [] } = {}) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  let lines;
  try {
    lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  } catch (error) {
    throw new LegacyDataError(`Unable to read legacy file at ${filePath}`, error);
  }
  const updated = [];
  let converted = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      updated.push(line);
      continue;
    }
    if (!parsed || typeof parsed !== 'object') {
      updated.push(line);
      continue;
    }
    if (parsed.__vaultfire_encrypted__ && typeof parsed.encrypted === 'string') {
      updated.push(JSON.stringify(parsed));
      continue;
    }
    let wrapped;
    try {
      wrapped = wrapObject(component, parsed, { preserveKeys });
    } catch (error) {
      try {
        fs.writeFileSync(`${filePath}.legacy-warning`, `${LEGACY_WARNING_MESSAGE}\n`, 'utf8');
      } catch (warningError) {
        // ignore warning write failures
      }
      throw new LegacyDataError(`Failed to convert legacy entry for ${component}`, error);
    }
    updated.push(JSON.stringify(wrapped));
    converted = true;
  }
  if (!converted) {
    return false;
  }
  const serialized = `${updated.join('\n')}\n`;
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.writeFileSync(`${filePath}.legacy-warning`, `${LEGACY_WARNING_MESSAGE}\n`, 'utf8');
    } catch (warningError) {
      // ignore warning write failures
    }
    throw new LegacyDataError(`Unable to persist migrated data for ${component}`, error);
  }
  return true;
}

module.exports = {
  LegacyDataError,
  loadConfig,
  shouldEncrypt,
  serialize,
  deserialize,
  wrapObject,
  unwrapObject,
  setRuntimePassphrase,
  audit,
  migrateLegacyFile,
};

