'use strict';

/**
 * LogQueueAdapter
 * ----------------
 * Provides a lightweight adapter around append-only storage backends.
 * The adapter batches log entries, applies runtime configuration overrides,
 * and exposes a plug-and-play interface that works with any backend that
 * implements an ``append(records, context)`` method returning either the
 * number of appended records or an acknowledgement object.
 *
 * To simplify partner integrations, the module exports ready-to-use
 * append-only queue backends for Redis Streams and Apache Kafka. These
 * helpers turn telemetry envelopes into event stream entries with
 * consistent metadata and support backpressure-friendly batching.
*/

const DEFAULT_CONFIG_TEMPLATE = Object.freeze({
  flushIntervalMs: 5000,
  maxBatchSize: 50,
  maxQueueSize: 1000,
  metadata: Object.freeze({}),
  backendOptions: Object.freeze({}),
});

class LogQueueAdapter {
  constructor({
    backend,
    defaults = {},
    configOverrides = {},
    serializer = JSON.stringify,
    logger = console,
  } = {}) {
    if (!backend || typeof backend.append !== 'function') {
      throw new TypeError('backend must expose an append(records, context) function');
    }
    if (typeof serializer !== 'function') {
      throw new TypeError('serializer must be a function');
    }

    this._backend = backend;
    this._logger = logger || console;
    this._serializer = serializer;
    this._queue = [];
    this._pendingFlush = null;
    this._timer = null;

    this._defaults = this._sanitizeConfig({ ...DEFAULT_CONFIG_TEMPLATE, ...defaults });
    this._overrides = this._normalizeConfigOverrides(configOverrides);
    this._config = this._buildConfig();

    if (this._config.flushIntervalMs > 0) {
      this._startTimer();
    }
  }

  get backendId() {
    return this._backend?.id || this._backend?.name || 'append-only-backend';
  }

  get config() {
    return this._config;
  }

  get size() {
    return this._queue.length;
  }

  enqueue(entry, { immediate = false, metadata = {} } = {}) {
    if (arguments.length === 0) {
      throw new TypeError('entry must be provided to enqueue');
    }
    if (typeof immediate !== 'boolean') {
      throw new TypeError('immediate option must be a boolean');
    }

    const recordMetadata = clonePlainObject(metadata, 'enqueue metadata');

    if (this._queue.length >= this._config.maxQueueSize) {
      throw new Error(`log queue capacity exceeded (${this._config.maxQueueSize})`);
    }

    const serialized = this._serialize(entry);
    this._queue.push({
      serialized,
      metadata: recordMetadata,
      createdAt: Date.now(),
      original: entry,
    });

    if (immediate || this._queue.length >= this._config.maxBatchSize) {
      return this._triggerFlush(immediate ? 'immediate' : 'maxBatch');
    }

    return Promise.resolve({ appended: 0, reason: 'queued' });
  }

  flush({ reason = 'manual' } = {}) {
    return this._triggerFlush(reason);
  }

  updateConfig(overrides = {}) {
    const normalized = this._normalizeConfigOverrides(overrides);
    const merged = { ...this._overrides };

    if ('metadata' in normalized) {
      merged.metadata = {
        ...(this._overrides.metadata || {}),
        ...normalized.metadata,
      };
    }

    if ('backendOptions' in normalized) {
      merged.backendOptions = {
        ...(this._overrides.backendOptions || {}),
        ...normalized.backendOptions,
      };
    }

    for (const key of ['flushIntervalMs', 'maxBatchSize', 'maxQueueSize']) {
      if (key in normalized) {
        merged[key] = normalized[key];
      }
    }

    this._overrides = merged;
    const previousInterval = this._config.flushIntervalMs;
    this._config = this._buildConfig();

    if (previousInterval !== this._config.flushIntervalMs) {
      this._restartTimer();
    }

    return this._config;
  }

  async shutdown({ drain = true } = {}) {
    this._stopTimer();

    if (!drain) {
      return;
    }

    if (this._pendingFlush) {
      await this._pendingFlush;
    }

    if (this._queue.length > 0) {
      await this.flush({ reason: 'shutdown' });
    }
  }

  _serialize(entry) {
    try {
      const serialized = this._serializer(entry);
      if (typeof serialized !== 'string' && !Buffer.isBuffer(serialized)) {
        throw new TypeError('serializer must return a string or Buffer');
      }
      return serialized;
    } catch (error) {
      throw new Error(`failed to serialize log entry: ${error.message || error}`);
    }
  }

  _triggerFlush(reason) {
    if (this._pendingFlush) {
      return this._pendingFlush;
    }

    let didFail = false;
    const flushPromise = this._flushOnce(reason)
      .catch((error) => {
        didFail = true;
        throw error;
      })
      .finally(() => {
        this._pendingFlush = null;
        if (!didFail && this._queue.length > 0) {
          this._triggerFlush('drain');
        }
      });

    this._pendingFlush = flushPromise;
    return flushPromise;
  }

  async _flushOnce(reason) {
    if (this._queue.length === 0) {
      return { appended: 0, reason };
    }

    const batch = this._queue.splice(0, this._config.maxBatchSize);
    const records = batch.map((item) => ({
      payload: item.serialized,
      metadata: { ...item.metadata },
      createdAt: item.createdAt,
    }));

    const context = {
      backendId: this.backendId,
      reason,
      config: {
        flushIntervalMs: this._config.flushIntervalMs,
        maxBatchSize: this._config.maxBatchSize,
        maxQueueSize: this._config.maxQueueSize,
        metadata: { ...this._config.metadata },
        backendOptions: { ...this._config.backendOptions },
      },
    };

    try {
      const acknowledgement = await Promise.resolve(this._backend.append(records, context));
      const appended = this._resolveAppendedCount(acknowledgement, records.length);
      if (this._logger && typeof this._logger.debug === 'function') {
        this._logger.debug('log queue adapter flushed records', {
          backendId: this.backendId,
          appended,
          reason,
        });
      }
      return { appended, reason };
    } catch (error) {
      this._queue = batch.concat(this._queue);
      if (this._logger && typeof this._logger.error === 'function') {
        this._logger.error('log queue adapter flush failed', {
          backendId: this.backendId,
          reason,
          error,
        });
      }
      throw error;
    }
  }

  _resolveAppendedCount(acknowledgement, fallback) {
    if (typeof acknowledgement === 'number' && Number.isFinite(acknowledgement) && acknowledgement >= 0) {
      return acknowledgement;
    }

    if (acknowledgement && typeof acknowledgement === 'object') {
      if (typeof acknowledgement.appended === 'number') {
        return acknowledgement.appended;
      }
      if (typeof acknowledgement.count === 'number') {
        return acknowledgement.count;
      }
    }

    return fallback;
  }

  _startTimer() {
    this._stopTimer();
    if (this._config.flushIntervalMs <= 0) {
      return;
    }

    this._timer = setInterval(() => {
      this.flush({ reason: 'interval' }).catch((error) => {
        if (this._logger && typeof this._logger.error === 'function') {
          this._logger.error('log queue adapter interval flush failed', {
            backendId: this.backendId,
            error,
          });
        }
      });
    }, this._config.flushIntervalMs);

    if (this._timer && typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _restartTimer() {
    this._startTimer();
  }

  _buildConfig() {
    const base = {
      flushIntervalMs: this._defaults.flushIntervalMs,
      maxBatchSize: this._defaults.maxBatchSize,
      maxQueueSize: this._defaults.maxQueueSize,
      metadata: { ...this._defaults.metadata },
      backendOptions: { ...this._defaults.backendOptions },
    };

    if ('flushIntervalMs' in this._overrides) {
      base.flushIntervalMs = this._overrides.flushIntervalMs;
    }
    if ('maxBatchSize' in this._overrides) {
      base.maxBatchSize = this._overrides.maxBatchSize;
    }
    if ('maxQueueSize' in this._overrides) {
      base.maxQueueSize = this._overrides.maxQueueSize;
    }
    if ('metadata' in this._overrides) {
      base.metadata = { ...base.metadata, ...this._overrides.metadata };
    }
    if ('backendOptions' in this._overrides) {
      base.backendOptions = { ...base.backendOptions, ...this._overrides.backendOptions };
    }

    return this._sanitizeConfig(base);
  }

  _sanitizeConfig(config = {}) {
    const flushIntervalMs = this._ensureNumber(
      'flushIntervalMs',
      config.flushIntervalMs,
      { min: 0 },
    );
    const maxQueueSize = this._ensureInteger(
      'maxQueueSize',
      config.maxQueueSize,
      { min: 1 },
    );
    const maxBatchSize = this._ensureInteger(
      'maxBatchSize',
      config.maxBatchSize,
      { min: 1, max: maxQueueSize, clamp: true },
    );

    const metadata = clonePlainObject(
      config.metadata === undefined ? DEFAULT_CONFIG_TEMPLATE.metadata : config.metadata,
      'config.metadata',
    );
    const backendOptions = clonePlainObject(
      config.backendOptions === undefined ? DEFAULT_CONFIG_TEMPLATE.backendOptions : config.backendOptions,
      'config.backendOptions',
    );

    return Object.freeze({
      flushIntervalMs,
      maxBatchSize,
      maxQueueSize,
      metadata: Object.freeze(metadata),
      backendOptions: Object.freeze(backendOptions),
    });
  }

  _normalizeConfigOverrides(overrides) {
    if (overrides === undefined) {
      return {};
    }

    if (!isPlainObject(overrides)) {
      throw new TypeError('configOverrides must be a plain object');
    }

    const normalized = { ...overrides };

    if ('metadata' in normalized) {
      normalized.metadata = clonePlainObject(normalized.metadata, 'configOverrides.metadata');
    }

    if ('backendOptions' in normalized) {
      normalized.backendOptions = clonePlainObject(normalized.backendOptions, 'configOverrides.backendOptions');
    }

    return normalized;
  }

  _ensureNumber(name, value, { min = -Infinity } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new TypeError(`${name} must be a finite number`);
    }
    if (numeric < min) {
      throw new RangeError(`${name} must be greater than or equal to ${min}`);
    }
    return numeric;
  }

  _ensureInteger(name, value, { min = -Infinity, max = Infinity, clamp = false } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      throw new TypeError(`${name} must be an integer`);
    }
    if (numeric < min) {
      throw new RangeError(`${name} must be greater than or equal to ${min}`);
    }
    if (numeric > max) {
      if (clamp) {
        return max;
      }
      throw new RangeError(`${name} must be less than or equal to ${max}`);
    }
    return numeric;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clonePlainObject(value, fieldName) {
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw new TypeError(`${fieldName} must be a plain object`);
  }
  return { ...value };
}

function createLogQueueAdapter(options) {
  return new LogQueueAdapter(options);
}

class RedisStreamBackend {
  constructor({
    client,
    streamKey = 'vaultfire:telemetry',
    maxLength = null,
    idStrategy = '*',
    logger = console,
  } = {}) {
    if (!client) {
      throw new TypeError('RedisStreamBackend requires a Redis client');
    }
    const command = client.xAdd || client.xadd || client.sendCommand || client.call;
    if (typeof command !== 'function') {
      throw new TypeError('Redis client must expose an xAdd/xadd/sendCommand function');
    }
    this.id = 'vaultfire.redis-stream';
    this._client = client;
    this._logger = logger || console;
    this._streamKey = streamKey;
    this._maxLength = maxLength;
    this._idStrategy = idStrategy;
    this._command = command;
  }

  async append(records = [], context = {}) {
    if (!Array.isArray(records) || records.length === 0) {
      return { appended: 0 };
    }
    let appended = 0;
    for (const record of records) {
      const payload = this._preparePayload(record, context);
      try {
        // prefer native methods when available
        if (typeof this._client.xAdd === 'function') {
          // modern redis client signature: xAdd(stream, id, { field: value }, options?)
          const args = [
            this._streamKey,
            this._idStrategy,
            payload,
          ];
          if (this._maxLength) {
            args.push({ TRIM: { strategy: '~', threshold: this._maxLength } });
          }
          // eslint-disable-next-line no-await-in-loop
          await this._client.xAdd(...args);
        } else if (typeof this._client.xadd === 'function') {
          const args = [this._streamKey];
          if (this._maxLength) {
            args.push('MAXLEN', '~', this._maxLength);
          }
          args.push(this._idStrategy);
          for (const [field, value] of Object.entries(payload)) {
            args.push(field, value);
          }
          // eslint-disable-next-line no-await-in-loop
          await this._client.xadd(...args);
        } else {
          const commandArgs = ['XADD', this._streamKey];
          if (this._maxLength) {
            commandArgs.push('MAXLEN', '~', this._maxLength);
          }
          commandArgs.push(this._idStrategy);
          for (const [field, value] of Object.entries(payload)) {
            commandArgs.push(field, value);
          }
          // eslint-disable-next-line no-await-in-loop
          await this._command.call(this._client, commandArgs);
        }
        appended += 1;
      } catch (error) {
        this._logger?.error?.('redis stream append failed', {
          stream: this._streamKey,
          error: error?.message || error,
        });
        throw error;
      }
    }
    return { appended };
  }

  _preparePayload(record, context) {
    const payload = {};
    payload.payload = Buffer.isBuffer(record.payload)
      ? record.payload
      : typeof record.payload === 'string'
        ? record.payload
        : JSON.stringify(record.payload ?? null);
    payload.metadata = JSON.stringify({
      ...(record.metadata || {}),
      sourceBackend: context?.backendId || this.id,
    });
    payload.createdAt = String(record.createdAt ?? Date.now());
    return payload;
  }
}

class KafkaLogBackend {
  constructor({
    producer,
    topic = 'vaultfire.telemetry',
    partitionResolver = null,
    encode = JSON.stringify,
    logger = console,
  } = {}) {
    if (!producer || typeof producer.send !== 'function') {
      throw new TypeError('KafkaLogBackend requires a producer with send()');
    }
    if (typeof encode !== 'function') {
      throw new TypeError('encode must be a function');
    }
    this.id = 'vaultfire.kafka';
    this._producer = producer;
    this._topic = topic;
    this._partitionResolver = partitionResolver;
    this._encode = encode;
    this._logger = logger || console;
  }

  async append(records = [], context = {}) {
    if (!Array.isArray(records) || records.length === 0) {
      return { appended: 0 };
    }
    const messages = records.map((record) => this._buildMessage(record, context));
    try {
      await this._producer.send({ topic: this._topic, messages });
    } catch (error) {
      this._logger?.error?.('kafka append failed', {
        topic: this._topic,
        error: error?.message || error,
      });
      throw error;
    }
    return { appended: messages.length };
  }

  _buildMessage(record, context) {
    const encoded = this._encode({
      payload: record.payload,
      metadata: {
        ...(record.metadata || {}),
        sourceBackend: context?.backendId || this.id,
      },
      createdAt: record.createdAt ?? Date.now(),
    });
    const value = Buffer.isBuffer(encoded) ? encoded : Buffer.from(String(encoded));
    const key = this._resolvePartitionKey(record);
    return key ? { value, key } : { value };
  }

  _resolvePartitionKey(record) {
    if (typeof this._partitionResolver === 'function') {
      return this._partitionResolver(record) || null;
    }
    return record?.metadata?.partnerId || null;
  }
}

function createRedisStreamBackend(options) {
  return new RedisStreamBackend(options);
}

function createKafkaLogBackend(options) {
  return new KafkaLogBackend(options);
}

module.exports = {
  LogQueueAdapter,
  createLogQueueAdapter,
  RedisStreamBackend,
  KafkaLogBackend,
  createRedisStreamBackend,
  createKafkaLogBackend,
};
