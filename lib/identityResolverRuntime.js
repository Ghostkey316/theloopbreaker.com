// Vaultfire Identity Resolver Runtime (Staging / Simulated / Pre-Production Only)
'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { ethers } = require('ethers');

const STAGING_LABEL = 'Staging / Simulated / Pre-Production Only';
const DEFAULT_REFRESH_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RPC_URL = process.env.VAULTFIRE_ENS_RPC_URL || process.env.ETH_RPC_URL || 'https://rpc.ankr.com/eth_sepolia';

function normaliseIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return null;
  }
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed || /[^a-z0-9._-]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function toRosterEntries(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => ({
        identifier: normaliseIdentifier(entry.identifier || entry.name || entry.wallet || entry.handle),
        address: typeof entry.address === 'string' ? entry.address : null,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        lastVerified: entry.lastVerified || entry.last_checked || null,
        source: entry.source || STAGING_LABEL,
      }))
      .filter((entry) => entry.identifier && entry.address);
  }
  if (typeof payload === 'object') {
    return Object.entries(payload)
      .map(([identifier, address]) => ({
        identifier: normaliseIdentifier(identifier),
        address: typeof address === 'string' ? address : null,
        tags: [],
        lastVerified: null,
        source: STAGING_LABEL,
      }))
      .filter((entry) => entry.identifier && entry.address);
  }
  return [];
}

class IdentityResolver extends EventEmitter {
  constructor({
    rosterPath = path.join(__dirname, '..', 'data', 'partner-roster.json'),
    logger = console,
    refreshIntervalMs = DEFAULT_REFRESH_MS,
    enableEnsFallback = true,
    rpcUrl = DEFAULT_RPC_URL,
    providerFactory = (url) => new ethers.JsonRpcProvider(url),
  } = {}) {
    super();
    this.logger = logger || console;
    this.rosterPath = rosterPath;
    this.refreshIntervalMs = refreshIntervalMs;
    this.enableEnsFallback = enableEnsFallback !== false;
    this.rpcUrl = rpcUrl;
    this.providerFactory = providerFactory;
    this.cache = new Map();
    this.metadata = new Map();
    this.refreshTimer = null;
    this.provider = null;
    this.initialised = false;
    this.lastRosterHash = null;
  }

  async init() {
    if (this.initialised) {
      return this;
    }
    await this.refresh();
    this.#scheduleRefresh();
    this.initialised = true;
    return this;
  }

  async refresh() {
    const data = await this.#loadRosterFromFile();
    if (!data) {
      return this.cache.size;
    }
    const nextHash = this.#hashPayload(data.rawText);
    if (this.lastRosterHash && nextHash !== this.lastRosterHash) {
      this.logger.info?.('[identity-resolver] roster checksum changed; auditing for drift.');
    }
    const nextMap = new Map();
    const nextMetadata = new Map();
    for (const entry of data.entries) {
      nextMap.set(entry.identifier, entry.address);
      nextMetadata.set(entry.identifier, {
        tags: entry.tags,
        lastVerified: entry.lastVerified,
        source: entry.source || STAGING_LABEL,
        loadedAt: new Date().toISOString(),
      });
    }
    this.#logDrift(this.cache, nextMap);
    this.cache = nextMap;
    this.metadata = nextMetadata;
    this.lastRosterHash = nextHash;
    this.emit('refreshed', { size: this.cache.size, timestamp: new Date().toISOString() });
    return this.cache.size;
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async resolve(identifier) {
    const key = normaliseIdentifier(identifier);
    if (!key) {
      return null;
    }
    if (!this.initialised) {
      await this.init();
    }
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    if (!this.enableEnsFallback || !key.endsWith('.eth')) {
      return null;
    }
    const resolved = await this.#fetchEnsAddress(key);
    if (resolved) {
      const existing = this.cache.get(key);
      if (existing && existing !== resolved) {
        this.logger.warn?.('[identity-resolver] ENS drift detected', { identifier: key, previous: existing, next: resolved });
      }
      this.cache.set(key, resolved);
      this.metadata.set(key, {
        tags: ['ens-fallback'],
        source: 'ens-rpc',
        lastVerified: new Date().toISOString(),
        loadedAt: new Date().toISOString(),
      });
      this.emit('resolved', { identifier: key, address: resolved, source: 'ens-rpc' });
    }
    return resolved || null;
  }

  resolveSync(identifier) {
    const key = normaliseIdentifier(identifier);
    if (!key || !this.cache.has(key)) {
      return null;
    }
    return this.cache.get(key);
  }

  getMetadata(identifier) {
    const key = normaliseIdentifier(identifier);
    if (!key) {
      return null;
    }
    return this.metadata.get(key) || null;
  }

  async #loadRosterFromFile() {
    try {
      if (!fs.existsSync(this.rosterPath)) {
        this.logger.warn?.('[identity-resolver] roster file missing', { path: this.rosterPath });
        return { entries: [], rawText: '' };
      }
      const raw = fs.readFileSync(this.rosterPath, 'utf8');
      const parsed = JSON.parse(raw);
      const entries = toRosterEntries(parsed);
      return { entries, rawText: raw };
    } catch (error) {
      this.logger.error?.('[identity-resolver] failed to parse roster file', { error: error.message });
      return null;
    }
  }

  async #fetchEnsAddress(identifier) {
    try {
      if (!this.provider) {
        this.provider = this.providerFactory(this.rpcUrl);
      }
      const address = await this.provider.resolveName(identifier);
      if (address) {
        this.logger.info?.('[identity-resolver] resolved via ENS fallback', { identifier, address });
      }
      return address;
    } catch (error) {
      this.logger.warn?.('[identity-resolver] ENS lookup failed', { identifier, error: error.message });
      return null;
    }
  }

  #scheduleRefresh() {
    if (!this.refreshIntervalMs || this.refreshIntervalMs <= 0) {
      return;
    }
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) => {
        this.logger.error?.('[identity-resolver] scheduled refresh failed', { error: error.message });
      });
    }, this.refreshIntervalMs);
    if (typeof this.refreshTimer.unref === 'function') {
      this.refreshTimer.unref();
    }
  }

  #hashPayload(rawText) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(rawText || '').digest('hex');
  }

  #logDrift(previousMap, nextMap) {
    for (const [identifier, address] of nextMap.entries()) {
      if (!previousMap.has(identifier)) {
        this.logger.info?.('[identity-resolver] new identity loaded', { identifier, address });
        continue;
      }
      const previous = previousMap.get(identifier);
      if (previous !== address) {
        this.logger.warn?.('[identity-resolver] identity map mismatch', {
          identifier,
          previous,
          next: address,
        });
      }
    }
    for (const identifier of previousMap.keys()) {
      if (!nextMap.has(identifier)) {
        this.logger.info?.('[identity-resolver] identity removed from roster', { identifier });
      }
    }
  }
}

let defaultResolver = null;

function createIdentityResolver(options = {}) {
  return new IdentityResolver(options);
}

function getDefaultIdentityResolver(options = {}) {
  if (!defaultResolver) {
    defaultResolver = createIdentityResolver(options);
    defaultResolver.init().catch((error) => {
      defaultResolver.logger.error?.('[identity-resolver] failed to initialise default resolver', {
        error: error.message,
      });
    });
  }
  return defaultResolver;
}

module.exports = {
  STAGING_LABEL,
  IdentityResolver,
  createIdentityResolver,
  getDefaultIdentityResolver,
};
