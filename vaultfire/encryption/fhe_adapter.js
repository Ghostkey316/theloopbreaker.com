'use strict';

const crypto = require('crypto');

const DEFAULT_TFHE_MODULE_IDS = [
  '@tfhe/core',
  '@tfhe/node',
  'tfhe',
];

const DEFAULT_ZAMA_MODULE_IDS = [
  '@zama-fhe/core',
  '@zama-fhe/node',
  '@zama-hl/fhe',
  'concrete-core-wasm',
];

const MIGRATION_EVENTS = Object.freeze({
  ACTIVATED: 'activated',
  FALLBACK: 'fallback',
  RESOLVED: 'resolved',
});

class SimulationFHEBackend {
  constructor({
    modulus = BigInt('0xFFFFFFFFFFFFFFFF'),
    defaultScale = 1e6,
    logger = console,
    moralTag = 'vaultfire::simulation',
  } = {}) {
    if (typeof defaultScale !== 'number' || !Number.isFinite(defaultScale) || defaultScale <= 0) {
      throw new Error('defaultScale must be a positive finite number');
    }
    if (typeof modulus !== 'bigint' || modulus <= 0n) {
      throw new Error('modulus must be a positive bigint');
    }
    this.backendId = 'vaultfire.sim-fhe.v1';
    this._logger = logger || console;
    this._defaultScale = defaultScale;
    this._modulus = modulus;
    this._moralTag = moralTag;
  }

  get defaultScale() {
    return this._defaultScale;
  }

  get modulus() {
    return this._modulus;
  }

  get moralTag() {
    return this._moralTag;
  }

  keygen({ domain = 'vaultfire::simulated', metadata = {} } = {}) {
    const seed = crypto.randomBytes(32).toString('hex');
    const digest = crypto.createHash('sha256').update(seed).digest('hex');
    return {
      backendId: this.backendId,
      publicKey: `sim:${domain}:${digest.slice(0, 32)}`,
      secretKey: `sim:${domain}:${digest.slice(32)}`,
      metadata: { ...metadata, seedDigest: digest },
      createdAt: Date.now(),
    };
  }

  encrypt(value, {
    publicKey = null,
    scale = this._defaultScale,
    metadata = {},
    context = 'vaultfire::simulated',
  } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new TypeError('value must be a finite number for simulation encryption');
    }
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
      throw new TypeError('scale must be a positive finite number');
    }

    const scaled = Math.round(numeric * scale);
    const mask = this._randomMask();
    const payload = this._normalizeBigInt(BigInt(scaled) + mask);

    return {
      backendId: this.backendId,
      encoding: 'affine-sum',
      payload: payload.toString(),
      mask: mask.toString(),
      scale,
      metadata: {
        ...metadata,
        publicKey,
        context,
        createdAt: Date.now(),
      },
      moralTag: this._moralTag,
    };
  }

  decrypt(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'object') {
      throw new TypeError('ciphertext must be an object');
    }
    const { payload, mask, scale } = ciphertext;
    if (typeof payload !== 'string' || typeof mask !== 'string') {
      throw new TypeError('ciphertext payload and mask must be strings');
    }
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
      throw new TypeError('ciphertext scale must be a positive finite number');
    }

    const payloadInt = BigInt(payload);
    const maskInt = BigInt(mask);
    const unmasked = this._normalizeBigInt(payloadInt - maskInt);

    return Number(unmasked) / scale;
  }

  add(ciphertexts = []) {
    if (!Array.isArray(ciphertexts)) {
      throw new TypeError('ciphertexts must be an array');
    }
    if (ciphertexts.length === 0) {
      throw new Error('ciphertexts array cannot be empty');
    }
    const { scale } = ciphertexts[0];
    const total = ciphertexts.reduce(
      (acc, item) => {
        if (!item || typeof item !== 'object') {
          throw new TypeError('ciphertexts must contain ciphertext objects');
        }
        if (item.scale !== scale) {
          throw new Error('all ciphertexts must share the same scale');
        }
        return {
          payload: acc.payload + BigInt(item.payload),
          mask: acc.mask + BigInt(item.mask),
        };
      },
      { payload: 0n, mask: 0n },
    );

    return {
      backendId: this.backendId,
      encoding: 'affine-sum',
      payload: this._normalizeBigInt(total.payload).toString(),
      mask: this._normalizeBigInt(total.mask).toString(),
      scale,
      metadata: {
        combined: ciphertexts.length,
        createdAt: Date.now(),
      },
      moralTag: this._moralTag,
    };
  }

  multiply(ciphertext, factor) {
    if (!ciphertext || typeof ciphertext !== 'object') {
      throw new TypeError('ciphertext must be an object');
    }
    const numericFactor = Number(factor);
    if (!Number.isFinite(numericFactor)) {
      throw new TypeError('factor must be a finite number');
    }
    if (!Number.isInteger(numericFactor)) {
      throw new TypeError('simulation backend only supports integer factors');
    }

    const factorBigInt = BigInt(numericFactor);
    const payload = BigInt(ciphertext.payload) * factorBigInt;
    const mask = BigInt(ciphertext.mask) * factorBigInt;

    return {
      backendId: this.backendId,
      encoding: 'affine-sum',
      payload: this._normalizeBigInt(payload).toString(),
      mask: this._normalizeBigInt(mask).toString(),
      scale: ciphertext.scale,
      metadata: {
        createdAt: Date.now(),
        factor: numericFactor,
      },
      moralTag: this._moralTag,
    };
  }

  _randomMask() {
    const buffer = crypto.randomBytes(8);
    return BigInt(`0x${buffer.toString('hex')}`) % this._modulus;
  }

  _normalizeBigInt(value) {
    const modulus = this._modulus;
    let normalized = value % modulus;
    if (normalized < 0) {
      normalized += modulus;
    }
    return normalized;
  }
}

class TFHEBackend {
  constructor({ tfheModule, logger = console } = {}) {
    if (!tfheModule) {
      throw new Error('tfheModule is required for TFHE backend');
    }
    this.backendId = 'vaultfire.tfhe';
    this._logger = logger || console;
    this._tfhe = tfheModule;
    this._validateModule();
  }

  async keygen(options = {}) {
    if (typeof this._tfhe.keygen === 'function') {
      return this._tfhe.keygen(options);
    }
    if (typeof this._tfhe.generateKeys === 'function') {
      return this._tfhe.generateKeys(options);
    }
    throw new Error('TFHE module does not expose key generation');
  }

  async encrypt(value, { publicKey, ...rest } = {}) {
    const encryptFn = this._tfhe.encrypt || this._tfhe.encryptScalar;
    if (typeof encryptFn !== 'function') {
      throw new Error('TFHE module must expose an encrypt function');
    }
    return encryptFn.call(this._tfhe, value, { publicKey, ...rest });
  }

  async decrypt(ciphertext, options = {}) {
    const decryptFn = this._tfhe.decrypt || this._tfhe.decryptScalar;
    if (typeof decryptFn !== 'function') {
      throw new Error('TFHE module must expose a decrypt function');
    }
    return decryptFn.call(this._tfhe, ciphertext, options);
  }

  async add(ciphertexts = [], options = {}) {
    const addFn = this._tfhe.add || this._tfhe.homomorphicAdd;
    if (typeof addFn !== 'function') {
      throw new Error('TFHE module must expose an add/homomorphicAdd function');
    }
    return addFn.call(this._tfhe, ciphertexts, options);
  }

  async multiply(ciphertext, factor, options = {}) {
    const mulFn =
      this._tfhe.multiply ||
      this._tfhe.mul ||
      this._tfhe.homomorphicMultiply ||
      this._tfhe.homomorphicScale;
    if (typeof mulFn !== 'function') {
      throw new Error('TFHE module must expose a multiply function');
    }
    return mulFn.call(this._tfhe, ciphertext, factor, options);
  }

  async bootstrap(ciphertext, options = {}) {
    const bootstrapFn = this._tfhe.bootstrap;
    if (typeof bootstrapFn !== 'function') {
      this._logger?.warn?.('[tfhe-backend] bootstrap not supported by module');
      return ciphertext;
    }
    return bootstrapFn.call(this._tfhe, ciphertext, options);
  }

  async ensureReady() {
    if (typeof this._tfhe?.ensureReady === 'function') {
      await this._tfhe.ensureReady();
    }
    return true;
  }

  _validateModule() {
    const required = ['decrypt', 'encrypt'];
    for (const fn of required) {
      if (typeof this._tfhe[fn] !== 'function' && typeof this._tfhe[`${fn}Scalar`] !== 'function') {
        throw new Error(`TFHE module missing required function '${fn}'`);
      }
    }
  }
}

class ZamaBackend {
  constructor({ zamaModule, logger = console } = {}) {
    if (!zamaModule) {
      throw new Error('zamaModule is required for Zama backend');
    }
    this.backendId = 'vaultfire.zama';
    this._logger = logger || console;
    this._module = zamaModule;
    this._validateModule();
  }

  async keygen(options = {}) {
    const fn = this._module.keygen || this._module.generate_keys || this._module.generateKeys;
    if (typeof fn !== 'function') {
      throw new Error('Zama module does not expose key generation');
    }
    return fn.call(this._module, options);
  }

  async encrypt(value, options = {}) {
    const fn = this._module.encrypt || this._module.encrypt_scalar;
    if (typeof fn !== 'function') {
      throw new Error('Zama module must expose an encrypt function');
    }
    return fn.call(this._module, value, options);
  }

  async decrypt(ciphertext, options = {}) {
    const fn = this._module.decrypt || this._module.decrypt_scalar;
    if (typeof fn !== 'function') {
      throw new Error('Zama module must expose a decrypt function');
    }
    return fn.call(this._module, ciphertext, options);
  }

  async add(ciphertexts = [], options = {}) {
    const fn = this._module.add || this._module.homomorphic_add;
    if (typeof fn !== 'function') {
      throw new Error('Zama module must expose an add function');
    }
    return fn.call(this._module, ciphertexts, options);
  }

  async multiply(ciphertext, factor, options = {}) {
    const fn =
      this._module.multiply ||
      this._module.mul ||
      this._module.homomorphic_multiply;
    if (typeof fn !== 'function') {
      throw new Error('Zama module must expose a multiply function');
    }
    return fn.call(this._module, ciphertext, factor, options);
  }

  async ensureReady() {
    if (typeof this._module?.ensure_ready === 'function') {
      await this._module.ensure_ready();
    }
    return true;
  }

  _validateModule() {
    const required = ['decrypt', 'encrypt'];
    for (const fn of required) {
      const camel = this._module[fn];
      const snake = this._module[`${fn}_scalar`];
      const alt = this._module[`${fn}Scalar`];
      if (typeof camel !== 'function' && typeof snake !== 'function' && typeof alt !== 'function') {
        throw new Error(`Zama module missing required function '${fn}'`);
      }
    }
  }
}

class FHEAdapter {
  constructor({
    mode = 'auto',
    tfheModule = null,
    tfheModuleIds = DEFAULT_TFHE_MODULE_IDS,
    zamaModule = null,
    zamaModuleIds = DEFAULT_ZAMA_MODULE_IDS,
    simulationConfig = {},
    logger = console,
  } = {}) {
    this._logger = logger || console;
    this._mode = mode;
    this._tfheModule = tfheModule;
    this._tfheModuleIds = Array.isArray(tfheModuleIds) && tfheModuleIds.length
      ? [...tfheModuleIds]
      : DEFAULT_TFHE_MODULE_IDS;
    this._zamaModule = zamaModule;
    this._zamaModuleIds = Array.isArray(zamaModuleIds) && zamaModuleIds.length
      ? [...zamaModuleIds]
      : DEFAULT_ZAMA_MODULE_IDS;
    this._simulation = new SimulationFHEBackend({ logger: this._logger, ...simulationConfig });
    this._backend = null;
    this._migrationState = {
      active: false,
      vendor: null,
      event: null,
      reason: null,
      timestamp: null,
    };
    this._backend = this._resolveBackend();
  }

  get backendId() {
    return this._backend?.backendId;
  }

  get mode() {
    return this._mode;
  }

  get isSimulation() {
    return this._backend instanceof SimulationFHEBackend;
  }

  getMigrationState() {
    return { ...this._migrationState };
  }

  switchBackend(mode) {
    if (!['simulation', 'tfhe', 'zama', 'auto'].includes(mode)) {
      throw new Error(`Unknown FHE mode '${mode}'`);
    }
    this._mode = mode;
    this._backend = this._resolveBackend();
    return this._backend;
  }

  async keygen(options) {
    return this._backend.keygen(options);
  }

  async encrypt(value, options) {
    return this._backend.encrypt(value, options);
  }

  async decrypt(ciphertext, options) {
    return this._backend.decrypt(ciphertext, options);
  }

  async add(ciphertexts, options) {
    return this._backend.add(ciphertexts, options);
  }

  async multiply(ciphertext, factor, options) {
    if (typeof this._backend.multiply !== 'function') {
      throw new Error(`${this.backendId} backend does not support multiply`);
    }
    return this._backend.multiply(ciphertext, factor, options);
  }

  async bootstrap(ciphertext, options) {
    if (typeof this._backend.bootstrap !== 'function') {
      if (!this.isSimulation) {
        this._logger?.warn?.('[fhe-adapter] bootstrap not available for backend');
      }
      return ciphertext;
    }
    return this._backend.bootstrap(ciphertext, options);
  }

  _resolveBackend() {
    if (this._mode === 'simulation') {
      this._recordMigrationEvent({ event: MIGRATION_EVENTS.FALLBACK, reason: 'explicit-simulation' });
      return this._simulation;
    }

    const candidate = this._resolveProductionModule();
    if (candidate) {
      const { vendor, module: moduleRef } = candidate;
      try {
        const backend = vendor === 'zama'
          ? new ZamaBackend({ zamaModule: moduleRef, logger: this._logger })
          : new TFHEBackend({ tfheModule: moduleRef, logger: this._logger });
        this._recordMigrationEvent({ event: MIGRATION_EVENTS.ACTIVATED, vendor });
        return backend;
      } catch (error) {
        if (this._mode === vendor) {
          throw error;
        }
        this._logger?.warn?.('[fhe-adapter] production backend failed, migrating to simulation', {
          vendor,
          error: error?.message || String(error),
        });
        this._recordMigrationEvent({ event: MIGRATION_EVENTS.FALLBACK, vendor, reason: error?.message || 'initialisation-failed' });
      }
    } else if (this._mode !== 'auto') {
      throw new Error('Unable to resolve production FHE module for required mode');
    }

    this._recordMigrationEvent({ event: MIGRATION_EVENTS.FALLBACK, reason: 'module-unavailable' });
    return this._simulation;
  }

  _resolveProductionModule() {
    if (this._mode === 'tfhe') {
      return this._resolveFromCollection('tfhe', this._tfheModule, this._tfheModuleIds);
    }
    if (this._mode === 'zama') {
      return this._resolveFromCollection('zama', this._zamaModule, this._zamaModuleIds);
    }

    const tfheCandidate = this._resolveFromCollection('tfhe', this._tfheModule, this._tfheModuleIds);
    if (tfheCandidate) {
      return tfheCandidate;
    }
    return this._resolveFromCollection('zama', this._zamaModule, this._zamaModuleIds);
  }

  _resolveFromCollection(vendor, directModule, ids) {
    if (directModule) {
      return { vendor, module: directModule };
    }
    for (const moduleId of ids) {
      try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const candidate = require(moduleId);
        if (candidate) {
          this._logger?.debug?.('[fhe-adapter] resolved production FHE module', { vendor, moduleId });
          return { vendor, module: candidate };
        }
      } catch (error) {
        if (error?.code !== 'MODULE_NOT_FOUND') {
          this._logger?.warn?.('[fhe-adapter] error while loading production FHE module', {
            vendor,
            moduleId,
            error: error?.message || String(error),
          });
        }
      }
    }
    return null;
  }

  _recordMigrationEvent({ event, vendor = null, reason = null }) {
    this._migrationState = {
      active: event === MIGRATION_EVENTS.FALLBACK,
      vendor,
      event,
      reason,
      timestamp: Date.now(),
    };
  }
}

module.exports = {
  FHEAdapter,
  SimulationFHEBackend,
  TFHEBackend,
  ZamaBackend,
  DEFAULT_TFHE_MODULE_IDS,
  DEFAULT_ZAMA_MODULE_IDS,
};
