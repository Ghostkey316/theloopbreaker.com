'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.join(__dirname, '..', 'vaultfire.config');
const DEFAULT_AUDIT_LOG = path.join(__dirname, '..', 'audit_logs', 'encryption_audit.log');
const PREFIX = 'ENC::';
const VERSION = Buffer.from([1]);
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 210_000;

let cachedConfig = null;
let cachedPassphrase = null;
const auditedComponents = new Set();

function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const defaults = {
    full_encryption_mode: false,
    audit_log: DEFAULT_AUDIT_LOG,
    passphrase_vault: null,
    hardware_key_path: null,
  };
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    cachedConfig = { ...defaults, ...parsed };
  } catch (error) {
    cachedConfig = { ...defaults };
  }
  if (!path.isAbsolute(cachedConfig.audit_log)) {
    cachedConfig.audit_log = path.join(__dirname, '..', cachedConfig.audit_log);
  }
  return cachedConfig;
}

function setRuntimePassphrase(passphrase) {
  cachedPassphrase = typeof passphrase === 'string' && passphrase ? passphrase : null;
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
      // fall through
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
      // fall through
    }
  }
  return null;
}

function shouldEncrypt(component) {
  const config = loadConfig();
  if (!config.full_encryption_mode) {
    return false;
  }
  if (!component) {
    return false;
  }
  return true;
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

function deriveKey(component, salt) {
  const passphrase = resolvePassphrase();
  if (!passphrase) {
    throw new Error('Encryption enabled but no passphrase available. Set VAULTFIRE_ENCRYPTION_PASSPHRASE.');
  }
  const saltMaterial = Buffer.concat([salt, Buffer.from(component, 'utf8')]);
  return crypto.pbkdf2Sync(passphrase, saltMaterial, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function audit(action, component, success, extra = {}) {
  const config = loadConfig();
  const entry = {
    timestamp: new Date().toISOString(),
    host: os.hostname(),
    pid: process.pid,
    component,
    action,
    success: Boolean(success),
    mode: config.full_encryption_mode ? 'full' : 'disabled',
    ...extra,
  };
  try {
    fs.mkdirSync(path.dirname(config.audit_log), { recursive: true });
    fs.appendFileSync(config.audit_log, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    // swallow audit errors
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
  audit('encrypt', component, true, { bytes: ciphertext.length });
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
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(component, 'utf8'));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
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
  if (!shouldEncrypt(component)) {
    return { ...data };
  }
  const preserved = {};
  for (const key of preserveKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      preserved[key] = data[key];
    }
  }
  const sensitive = {};
  for (const [key, value] of Object.entries(data)) {
    if (preserveKeys.includes(key)) {
      continue;
    }
    sensitive[key] = value;
  }
  const serialized = encrypt(component, JSON.stringify(sensitive));
  return {
    ...preserved,
    encryption: {
      component,
      version: 1,
      mode: 'full',
    },
    __vaultfire_encrypted__: true,
    encrypted: serialized.value,
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

module.exports = {
  loadConfig,
  shouldEncrypt,
  serialize,
  deserialize,
  wrapObject,
  unwrapObject,
  setRuntimePassphrase,
  audit,
};
