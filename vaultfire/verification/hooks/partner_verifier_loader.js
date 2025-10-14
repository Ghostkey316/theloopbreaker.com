'use strict';

const path = require('path');
const crypto = require('crypto');

let fs = null;
try {
  // eslint-disable-next-line global-require
  fs = require('fs');
} catch (error) {
  fs = null;
}

let yamlParser = null;
try {
  // eslint-disable-next-line global-require
  yamlParser = require('yamljs');
} catch (error) {
  yamlParser = null;
}

const hasFsAccess = Boolean(fs && typeof fs.statSync === 'function');

const DEFAULT_EXTENSIONS = Object.freeze(['.json', '.yaml', '.yml']);
const DEFAULT_DIRECTORY_FILES = Object.freeze(['verification', 'verifier', 'config', 'manifest', 'index']);

const DEFAULT_POST_QUANTUM_ENCLAVES = Object.freeze({
  kyber1024: {
    algorithm: 'kyber1024',
    publicKey:
      'fhe1qpsqk4f9ts0pn6p2n0q6jp3jjvq58l8rff0a2s3d0y5hg9t0s4xk5xw6z7plmv',
    attestation: 'pq-attestation::vaultfire::2025-10-01',
    issuedAt: '2025-10-01T00:00:00.000Z',
  },
});

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const output = {};
  for (const key of Object.keys(value)) {
    output[key] = clone(value[key]);
  }
  return output;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
  } else {
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
  }
  return Object.freeze(value);
}

function normalizePartnerId(value) {
  if (typeof value !== 'string') {
    throw new TypeError('partnerId must be a non-empty string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError('partnerId must be a non-empty string');
  }
  return trimmed.toLowerCase();
}

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function computeChecksum(config) {
  const canonical = canonicalStringify(config);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function mergeObjects(base, overrides) {
  if (!isPlainObject(overrides)) {
    return clone(overrides);
  }
  const target = isPlainObject(base) ? base : {};
  for (const key of Object.keys(overrides)) {
    const value = overrides[key];
    if (isPlainObject(value)) {
      target[key] = mergeObjects(isPlainObject(target[key]) ? target[key] : {}, value);
    } else if (Array.isArray(value)) {
      target[key] = value.map((item) => clone(item));
    } else {
      target[key] = clone(value);
    }
  }
  return target;
}

function applyOverrides(config, overrides) {
  if (!overrides) {
    return config;
  }
  const working = clone(config);
  return mergeObjects(working, overrides);
}

function applyTransform(config, transform, context) {
  if (typeof transform !== 'function') {
    return config;
  }
  const candidate = transform(clone(config), context);
  if (candidate && typeof candidate === 'object') {
    return clone(candidate);
  }
  return config;
}

function dedupePreserveOrder(items, { resolve = true } = {}) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item || typeof item !== 'string') {
      continue;
    }
    const resolved = resolve ? path.resolve(item) : item;
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    output.push(resolved);
  }
  return output;
}

function safeStat(targetPath) {
  if (!hasFsAccess) {
    return null;
  }
  try {
    return fs.statSync(targetPath);
  } catch (error) {
    return null;
  }
}

function safeReadDir(targetPath) {
  if (!hasFsAccess) {
    return [];
  }
  try {
    return fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

function ensurePartnerId(config, partnerId) {
  const working = clone(config);
  if (!isPlainObject(working)) {
    throw new TypeError('Partner verifier config must be an object');
  }
  const normalized = normalizePartnerId(partnerId || working.partnerId);
  working.partnerId = normalized;
  return working;
}

function canonicalSourceType(source) {
  if (!source) {
    return 'unknown';
  }
  if (source === 'embedded') {
    return 'embedded';
  }
  return 'filesystem';
}

function normalizeEnclaveKeySet(enclaves = {}, { fallbacks = DEFAULT_POST_QUANTUM_ENCLAVES } = {}) {
  const normalized = {};
  const sourceEntries = enclaves && typeof enclaves === 'object' ? enclaves : {};
  for (const [name, value] of Object.entries(sourceEntries)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const algorithm = String(value.algorithm || name || '').trim();
    if (!algorithm) {
      continue;
    }
    normalized[name] = {
      algorithm,
      publicKey: String(value.publicKey || value.key || '').trim(),
      attestation: value.attestation ? String(value.attestation) : null,
      issuedAt: value.issuedAt ? new Date(value.issuedAt).toISOString() : null,
      enclaveId: value.enclaveId ? String(value.enclaveId) : null,
    };
  }
  const fallbackEntries = fallbacks && typeof fallbacks === 'object' ? fallbacks : {};
  for (const [name, value] of Object.entries(fallbackEntries)) {
    if (normalized[name]) {
      continue;
    }
    normalized[name] = {
      algorithm: String(value.algorithm || name),
      publicKey: String(value.publicKey || ''),
      attestation: value.attestation || null,
      issuedAt: value.issuedAt || null,
      enclaveId: value.enclaveId || null,
    };
  }
  return normalized;
}

function applyEnclaveOverrides(config, options = {}) {
  const working = clone(config);
  const provided = options?.postQuantumEnclaveKeys;
  const overrides = provided && typeof provided === 'object' ? provided : null;
  const normalized = normalizeEnclaveKeySet(working.enclaves, { fallbacks: DEFAULT_POST_QUANTUM_ENCLAVES });
  if (overrides) {
    const overrideSet = normalizeEnclaveKeySet(overrides, { fallbacks: {} });
    for (const [name, value] of Object.entries(overrideSet)) {
      normalized[name] = value;
    }
  }
  working.enclaves = normalized;
  if (!working.metadata || typeof working.metadata !== 'object') {
    working.metadata = {};
  }
  working.metadata.enclaveFingerprints = Object.fromEntries(
    Object.entries(normalized).map(([name, value]) => [
      name,
      value.publicKey ? crypto.createHash('sha256').update(value.publicKey).digest('hex') : null,
    ]),
  );
  return working;
}

const FALLBACK_CONFIGS = deepFreeze([
  {
    partnerId: 'ghostkey316.eth',
    displayName: 'Ghostkey 316',
    tier: 'architect',
    version: 3,
    status: 'verified',
    updatedAt: '2025-10-18T00:00:00.000Z',
    verification: {
      cadence: 'continuous',
      requiredChecks: [
        {
          id: 'mission_covenant',
          description: 'Mission covenant anchor validated',
          required: true,
        },
        {
          id: 'ethics_council',
          description: 'Ethics oversight attestation',
          required: true,
        },
        {
          id: 'telemetry_residency',
          description: 'Telemetry residency boundaries enforced',
          required: true,
        },
      ],
      attestors: ['mission-ledger', 'ethics-council'],
      evidenceRetentionDays: 365,
      escalation: {
        policy: 'pause-sync',
        notify: ['ethics@vaultfire.invalid', 'mission-control@vaultfire.invalid'],
      },
    },
    contact: {
      owner: 'architects@vaultfire.invalid',
      escalation: 'ethics@vaultfire.invalid',
    },
    signals: {
      webhook: 'https://hooks.vaultfire.invalid/ghostkey316',
      ledgerStream: 'mission-ledger',
    },
    tags: ['canonical', 'architect', 'ethics'],
    enclaves: {
      default: {
        algorithm: 'secp256k1',
        publicKey: '0x04f16c4e8e5d23a4d6f7c2a1b8e3f5a9d4c1b2e3a4f6c7d8e9f0a1b2c3d4e5f6a7',
        attestation: 'tee-attest::ghostkey316::2025-10-18',
        issuedAt: '2025-10-18T00:00:00.000Z',
      },
    },
  },
  {
    partnerId: 'atlantech',
    displayName: 'Atlantech Cooperative',
    tier: 'mission-aligned',
    version: 2,
    status: 'verified',
    updatedAt: '2025-10-12T00:00:00.000Z',
    verification: {
      cadence: 'weekly',
      requiredChecks: [
        {
          id: 'mission_lock',
          description: 'Confirms covenant hash against canonical mission',
          required: true,
        },
        {
          id: 'telemetry_dual',
          description: 'Dual residency guardrails validated',
          required: true,
        },
      ],
      attestors: ['mission-ledger'],
      evidenceRetentionDays: 180,
      escalation: {
        policy: 'notify-and-review',
        notify: ['ethics@vaultfire.invalid'],
      },
    },
    contact: {
      owner: 'ops@atlantech.invalid',
      escalation: 'ethics@vaultfire.invalid',
    },
    signals: {
      webhook: null,
      ledgerStream: 'mission-ledger',
    },
    tags: ['canonical', 'partner'],
    enclaves: {
      default: {
        algorithm: 'ed25519',
        publicKey: 'ed25519:atlantech:2025',
        attestation: 'tee-attest::atlantech::2025-10-12',
        issuedAt: '2025-10-12T00:00:00.000Z',
      },
    },
  },
  {
    partnerId: 'sandbox_partner',
    displayName: 'Sandbox Partner',
    tier: 'pilot',
    version: 1,
    status: 'pending',
    updatedAt: '2025-09-30T00:00:00.000Z',
    verification: {
      cadence: 'per-handshake',
      requiredChecks: [
        {
          id: 'alignment_phrase',
          description: 'Alignment phrase signature verified',
          required: true,
        },
        {
          id: 'ethics_ping',
          description: 'Ethics pingback recorded for sandbox observer',
          required: false,
        },
      ],
      attestors: ['sandbox-ledger'],
      evidenceRetentionDays: 30,
      escalation: {
        policy: 'pause-on-failure',
        notify: ['sandbox@vaultfire.invalid'],
      },
    },
    contact: {
      owner: 'sandbox@vaultfire.invalid',
      escalation: 'ethics@vaultfire.invalid',
    },
    signals: {
      webhook: null,
      ledgerStream: 'sandbox-ledger',
    },
    tags: ['pilot', 'canonical'],
    enclaves: {
      default: {
        algorithm: 'ed25519',
        publicKey: 'ed25519:sandbox:pilot',
        attestation: 'tee-attest::sandbox::2025-09-30',
        issuedAt: '2025-09-30T00:00:00.000Z',
      },
    },
  },
]);

const FALLBACK_INDEX = new Map(
  FALLBACK_CONFIGS.map((entry) => [normalizePartnerId(entry.partnerId), entry])
);

const cache = new Map();

function getExtensions(options = {}) {
  const provided = Array.isArray(options.extensions) ? options.extensions : null;
  if (!provided || provided.length === 0) {
    return DEFAULT_EXTENSIONS;
  }
  return provided.map((entry) => {
    if (!entry) {
      return entry;
    }
    return entry.startsWith('.') ? entry.toLowerCase() : `.${entry.toLowerCase()}`;
  });
}

function getDirectoryFiles(options = {}) {
  const provided = Array.isArray(options.directoryFiles) ? options.directoryFiles : null;
  if (!provided || provided.length === 0) {
    return DEFAULT_DIRECTORY_FILES;
  }
  return provided.map((entry) => entry).filter(Boolean);
}

function resolveSearchRoots(options = {}) {
  const explicit = [];
  if (Array.isArray(options.searchPaths)) {
    explicit.push(...options.searchPaths);
  }
  if (typeof options.root === 'string') {
    explicit.push(options.root);
  }
  const envRoot = typeof process !== 'undefined' && process && process.env ? process.env.VAULTFIRE_PARTNER_VERIFIER_ROOT : null;
  const defaults = options.includeDefaults === false
    ? []
    : [
        path.join(__dirname, '..', 'canonical'),
        path.join(__dirname, '..'),
        path.join(__dirname, '..', '..', '..', 'configs', 'partner_verification'),
        path.join(process.cwd(), 'configs', 'partner_verification'),
      ];
  const combined = dedupePreserveOrder([...explicit, envRoot, ...defaults]);
  if (!hasFsAccess) {
    return combined;
  }
  const accessible = [];
  for (const entry of combined) {
    if (!entry) {
      continue;
    }
    const stat = safeStat(entry);
    if (stat && stat.isDirectory()) {
      accessible.push(entry);
    }
  }
  return accessible;
}

function discoverConfigFiles(partnerId, options = {}) {
  if (!hasFsAccess) {
    return [];
  }
  const normalized = normalizePartnerId(partnerId);
  const roots = resolveSearchRoots(options);
  const extensions = getExtensions(options);
  const directoryFiles = getDirectoryFiles(options);
  const discovered = [];
  for (const root of roots) {
    if (!root) {
      continue;
    }
    for (const ext of extensions) {
      if (!ext) {
        continue;
      }
      const direct = path.join(root, `${normalized}${ext}`);
      const stat = safeStat(direct);
      if (stat && stat.isFile()) {
        discovered.push(path.resolve(direct));
      }
    }
    const directory = path.join(root, normalized);
    const dirStat = safeStat(directory);
    if (!dirStat || !dirStat.isDirectory()) {
      continue;
    }
    for (const base of directoryFiles) {
      for (const ext of extensions) {
        if (!ext) {
          continue;
        }
        const candidate = path.join(directory, `${base}${ext}`);
        const candidateStat = safeStat(candidate);
        if (candidateStat && candidateStat.isFile()) {
          discovered.push(path.resolve(candidate));
        }
      }
    }
  }
  return dedupePreserveOrder(discovered);
}

function parseConfigFile(filePath) {
  if (!hasFsAccess) {
    throw new Error('File system access is not available in this runtime');
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();
  if (!extension || extension === '.json') {
    return JSON.parse(raw);
  }
  if (extension === '.yaml' || extension === '.yml') {
    if (!yamlParser) {
      throw new Error('YAML parser not available. Install yamljs to read YAML configs.');
    }
    return yamlParser.parse(raw);
  }
  throw new Error(`Unsupported partner verifier file extension: ${extension || '(none)'}`);
}

function fetchFromFileSystem(partnerId, options = {}) {
  const errors = [];
  if (!hasFsAccess) {
    return { config: null, source: null, errors };
  }
  const candidates = discoverConfigFiles(partnerId, options);
  for (const candidate of candidates) {
    try {
      const parsed = parseConfigFile(candidate);
      return { config: parsed, source: candidate, errors };
    } catch (error) {
      const entry = { source: candidate, message: error.message };
      errors.push(entry);
      if (options.strict) {
        const err = new Error(`Failed to load partner verifier config from ${candidate}: ${error.message}`);
        err.cause = error;
        err.partnerId = normalizePartnerId(partnerId);
        throw err;
      }
    }
  }
  return { config: null, source: null, errors };
}

function buildRecord(partnerId, config, { source, canonical = true, sourceType, errors = [], options = {} } = {}) {
  const normalized = normalizePartnerId(partnerId);
  if (!isPlainObject(config)) {
    throw new TypeError(`Partner verifier config for "${normalized}" must be an object`);
  }
  const working = applyEnclaveOverrides(ensurePartnerId(config, normalized), options);
  const metadata = {
    loadedAt: new Date().toISOString(),
    sourceType: canonicalSourceType(sourceType || source),
  };
  if (errors.length) {
    metadata.errors = errors.map((entry) => ({ source: entry.source, message: entry.message }));
  }
  const version = typeof working.version !== 'undefined' ? working.version : 1;
  return {
    partnerId: normalized,
    version,
    checksum: computeChecksum(working),
    source: source || null,
    canonical: Boolean(canonical),
    config: working,
    metadata,
  };
}

function cloneRecord(record) {
  return {
    partnerId: record.partnerId,
    version: record.version,
    checksum: record.checksum,
    source: record.source,
    canonical: record.canonical,
    config: clone(record.config),
    metadata: record.metadata ? clone(record.metadata) : {},
  };
}

function getCacheKey(partnerId, options) {
  const normalized = normalizePartnerId(partnerId);
  const roots = Array.isArray(options?.searchPaths) ? options.searchPaths.join('|') : '';
  const allowFallback = options?.allowFallback === false ? 'no-fallback' : 'fallback';
  return `${normalized}::${roots}::${allowFallback}`;
}

function loadPartnerVerifierConfig(partnerId, options = {}) {
  const normalized = normalizePartnerId(partnerId);
  const cacheable = !options.skipCache && !options.overrides && typeof options.transform !== 'function';
  const cacheKey = cacheable ? getCacheKey(normalized, options) : null;
  if (cacheable && cache.has(cacheKey)) {
    return cloneRecord(cache.get(cacheKey));
  }

  const { config: fsConfig, source: fsSource, errors } = fetchFromFileSystem(normalized, options);
  let config = fsConfig ? clone(fsConfig) : null;
  let source = fsSource || null;
  let sourceType = source ? 'filesystem' : 'embedded';
  let canonical = Boolean(fsConfig);

  if (!config && options.allowFallback !== false) {
    const fallback = FALLBACK_INDEX.get(normalized);
    if (fallback) {
      config = clone(fallback);
      sourceType = 'embedded';
      source = 'embedded';
      canonical = true;
    }
  }

  if (!config) {
    if (options.require) {
      const error = new Error(`No canonical partner verification config found for "${normalized}"`);
      error.code = 'VAULTFIRE_VERIFIER_CONFIG_MISSING';
      error.partnerId = normalized;
      error.errors = errors;
      throw error;
    }
    const missing = {
      partnerId: normalized,
      version: null,
      checksum: null,
      source: null,
      canonical: false,
      config: null,
      metadata: {
        loadedAt: new Date().toISOString(),
        sourceType: 'unavailable',
      },
    };
    if (errors.length) {
      if (options.collectErrors) {
        missing.errors = errors.map((entry) => ({ ...entry }));
      } else {
        missing.metadata.errors = errors.map((entry) => ({ source: entry.source, message: entry.message }));
      }
    }
    return missing;
  }

  let overridesApplied = false;
  if (options.overrides) {
    config = applyOverrides(config, options.overrides);
    overridesApplied = true;
  }

  if (typeof options.transform === 'function') {
    config = applyTransform(config, options.transform, {
      partnerId: normalized,
      source,
      canonical,
    });
    overridesApplied = true;
  }

  if (!isPlainObject(config)) {
    throw new TypeError(`Partner verifier config for "${normalized}" must be an object`);
  }

  const record = buildRecord(normalized, config, {
    source,
    canonical,
    sourceType,
    errors,
    options,
  });
  if (overridesApplied) {
    record.metadata.overridesApplied = true;
  }
  if (options.collectErrors && errors.length && !record.metadata.errors) {
    record.metadata.errors = errors.map((entry) => ({ source: entry.source, message: entry.message }));
  }

  if (cacheable) {
    cache.set(cacheKey, cloneRecord(record));
  }

  const response = cloneRecord(record);
  if (options.collectErrors && errors.length) {
    response.errors = errors.map((entry) => ({ ...entry }));
  }
  return response;
}

function listPartnerVerifierConfigs(options = {}) {
  const includeFallback = options.includeFallback !== false;
  const seen = new Set();
  const results = [];
  const aggregatedErrors = [];

  if (hasFsAccess) {
    const roots = resolveSearchRoots(options);
    const extensions = getExtensions(options);
    const extensionSet = new Set(extensions);
    for (const root of roots) {
      if (!root) {
        continue;
      }
      const entries = safeReadDir(root);
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!extensionSet.has(ext)) {
            continue;
          }
          const partnerId = normalizePartnerId(path.basename(entry.name, ext));
          if (seen.has(partnerId)) {
            continue;
          }
          try {
            const record = loadPartnerVerifierConfig(partnerId, {
              ...options,
              searchPaths: [root],
              includeDefaults: false,
              allowFallback: false,
              collectErrors: true,
            });
            if (record.config) {
              seen.add(partnerId);
              if (!options.collectErrors) {
                delete record.errors;
              }
              results.push(record);
            } else if (record.errors) {
              aggregatedErrors.push(...record.errors.map((error) => ({ ...error, partnerId })));
            }
          } catch (error) {
            if (options.strict) {
              throw error;
            }
            aggregatedErrors.push({ partnerId, source: path.join(root, entry.name), message: error.message });
          }
        } else if (entry.isDirectory()) {
          const partnerId = normalizePartnerId(entry.name);
          if (seen.has(partnerId)) {
            continue;
          }
          try {
            const record = loadPartnerVerifierConfig(partnerId, {
              ...options,
              searchPaths: [root],
              includeDefaults: false,
              allowFallback: false,
              collectErrors: true,
            });
            if (record.config) {
              seen.add(partnerId);
              if (!options.collectErrors) {
                delete record.errors;
              }
              results.push(record);
            } else if (record.errors) {
              aggregatedErrors.push(...record.errors.map((error) => ({ ...error, partnerId })));
            }
          } catch (error) {
            if (options.strict) {
              throw error;
            }
            aggregatedErrors.push({ partnerId, source: path.join(root, entry.name), message: error.message });
          }
        }
      }
    }
  }

  if (includeFallback) {
    for (const fallback of FALLBACK_CONFIGS) {
      const normalized = normalizePartnerId(fallback.partnerId);
      if (seen.has(normalized)) {
        continue;
      }
      const record = loadPartnerVerifierConfig(normalized, {
        ...options,
        allowFallback: true,
        includeDefaults: false,
        skipCache: true,
        collectErrors: options.collectErrors,
      });
      if (record.config) {
        seen.add(normalized);
        results.push(record);
      }
    }
  }

  results.sort((a, b) => {
    if (a.partnerId < b.partnerId) return -1;
    if (a.partnerId > b.partnerId) return 1;
    return 0;
  });

  if (options.collectErrors) {
    return { configs: results, errors: aggregatedErrors };
  }

  return results;
}

function clearPartnerVerifierCache() {
  cache.clear();
}

module.exports = {
  loadPartnerVerifierConfig,
  listPartnerVerifierConfigs,
  clearPartnerVerifierCache,
  resolveSearchRoots,
  FALLBACK_CONFIGS,
  normalizeEnclaveKeySet,
};
