'use strict';

const crypto = require('crypto');

const DEFAULT_TFHE_MODULE_IDS = [
  '@tfhe/core',
  '@tfhe/node',
  'tfhe',
];

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

  _validateModule() {
    const required = ['decrypt', 'encrypt'];
    for (const fn of required) {
      if (typeof this._tfhe[fn] !== 'function' && typeof this._tfhe[`${fn}Scalar`] !== 'function') {
        throw new Error(`TFHE module missing required function '${fn}'`);
      }
    }
  }
}

class FHEAdapter {
  constructor({
    mode = 'auto',
    tfheModule = null,
    tfheModuleIds = DEFAULT_TFHE_MODULE_IDS,
    simulationConfig = {},
    logger = console,
  } = {}) {
    this._logger = logger || console;
    this._mode = mode;
    this._tfheModule = tfheModule;
    this._tfheModuleIds = Array.isArray(tfheModuleIds) && tfheModuleIds.length
      ? [...tfheModuleIds]
      : DEFAULT_TFHE_MODULE_IDS;
    this._simulation = new SimulationFHEBackend({ logger: this._logger, ...simulationConfig });
    this._backend = null;
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

  switchBackend(mode) {
    if (!['simulation', 'tfhe', 'auto'].includes(mode)) {
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
      return this._simulation;
    }
    const moduleRef = this._mode === 'tfhe' || this._mode === 'auto' ? this._resolveTFHEModule() : null;
    if (moduleRef) {
      try {
        return new TFHEBackend({ tfheModule: moduleRef, logger: this._logger });
      } catch (error) {
        if (this._mode === 'tfhe') {
          throw error;
        }
        this._logger?.warn?.('[fhe-adapter] falling back to simulation backend', {
          error: error?.message || String(error),
        });
      }
    } else if (this._mode === 'tfhe') {
      throw new Error('Unable to resolve TFHE module for required mode');
    }

    return this._simulation;
  }

  _resolveTFHEModule() {
    if (this._tfheModule) {
      return this._tfheModule;
    }
    for (const moduleId of this._tfheModuleIds) {
      try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const candidate = require(moduleId);
        if (candidate) {
          this._logger?.debug?.('[fhe-adapter] resolved TFHE module', { moduleId });
          return candidate;
        }
      } catch (error) {
        if (error?.code !== 'MODULE_NOT_FOUND') {
          this._logger?.warn?.('[fhe-adapter] error while loading TFHE module', {
            moduleId,
            error: error?.message || String(error),
          });
        }
      }
    }
    return null;
  }
}

module.exports = {
  FHEAdapter,
  SimulationFHEBackend,
  TFHEBackend,
  DEFAULT_TFHE_MODULE_IDS,
};
