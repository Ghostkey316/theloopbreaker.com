const fs = require('fs');
const path = require('path');
const Joi = require('./joiFacade');

const MultiTierTelemetryLedger = require('./telemetryLedger');
const { RedisPubSubStub } = require('./redisTenantPubSub');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

class TelemetryTenantRouter {
  constructor({ baseDir = path.join(__dirname, '..', 'logs', 'tenants'), ledgerFactory } = {}) {
    this.baseDir = baseDir;
    ensureDirectory(this.baseDir);
    this.ledgerFactory =
      ledgerFactory ||
      ((tenantId) =>
        new MultiTierTelemetryLedger({
          baseDir: path.join(this.baseDir, tenantId),
          partnerLog: 'partner.log',
          ethicsLog: 'ethics.log',
          auditLog: 'audit.log',
        }));
    this.tenants = new Map();
    this.redis = new RedisPubSubStub();
    this.middleware = [];
    this.telemetrySchema = Joi.object({
      event: Joi.string().trim().min(1).required(),
      timestamp: Joi.date().timestamp('unix').required(),
      payload: Joi.object().required(),
      consentToken: Joi.string().trim().min(8).required(),
      driftScore: Joi.number().min(0).max(1).optional(),
    }).required();
    this.flushChannel = this.redis.channel('flush');
  }

  #key(tenantId) {
    return tenantId || 'public';
  }

  #getOrCreateLedger(tenantId) {
    const key = this.#key(tenantId);
    if (!this.tenants.has(key)) {
      const ledger = this.ledgerFactory(key);
      this.tenants.set(key, ledger);
    }
    return this.tenants.get(key);
  }

  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('middleware must be a function');
    }
    this.middleware.push(middleware);
  }

  useTenantQuota({ limit, windowMs }) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('tenant quota limit must be positive');
    }
    if (!Number.isInteger(windowMs) || windowMs <= 0) {
      throw new Error('tenant quota window must be positive');
    }
    const counters = new Map();
    this.use(async ({ tenantId }) => {
      const key = this.#key(tenantId);
      const now = Date.now();
      const state = counters.get(key) || { count: 0, resetAt: now + windowMs };
      if (now >= state.resetAt) {
        state.count = 0;
        state.resetAt = now + windowMs;
      }
      if (state.count >= limit) {
        const err = new Error('tenant-quota-exceeded');
        err.code = 'TENANT_QUOTA_EXCEEDED';
        throw err;
      }
      state.count += 1;
      counters.set(key, state);
    });
  }

  async #runMiddleware(context) {
    for (const middleware of this.middleware) {
      // eslint-disable-next-line no-await-in-loop
      await middleware(context);
    }
  }

  #validateTelemetry(payload) {
    const { value, error } = this.telemetrySchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) {
      const validationError = new Error('invalid-telemetry-payload');
      validationError.details = error.details;
      throw validationError;
    }
    return value;
  }

  async record(tenantId, eventType, payload = {}, options = {}) {
    const key = this.#key(tenantId);
    const validated = this.#validateTelemetry(payload.telemetry || payload);
    return this.#recordInternal(key, eventType, validated, options);
  }

  async #recordInternal(tenantKey, eventType, payload, options) {
    const context = { tenantId: tenantKey, eventType, payload };
    await this.#runMiddleware(context);
    const ledger = this.#getOrCreateLedger(tenantKey);
    const { payload: nestedPayload, ...rest } = payload;
    const enrichedPayload = {
      ...rest,
      tenantId: tenantKey,
      telemetry: nestedPayload && typeof nestedPayload === 'object' ? nestedPayload : {},
    };
    if (nestedPayload && typeof nestedPayload === 'object') {
      for (const [key, value] of Object.entries(nestedPayload)) {
        if (enrichedPayload[key] === undefined) {
          enrichedPayload[key] = value;
        }
      }
    }
    const entry = ledger.record(eventType, enrichedPayload, options);
    await this.redis.publish(this.redis.channel('record'), JSON.stringify({ tenantId: tenantKey, eventType }));
    return entry;
  }

  readChannel(tenantId, channel = 'partner') {
    const ledger = this.tenants.get(this.#key(tenantId));
    if (!ledger) {
      return [];
    }
    return ledger.readChannel(channel);
  }

  async flushAll() {
    const ledgers = Array.from(this.tenants.entries());
    await Promise.all(
      ledgers.map(async ([tenantId, ledger]) => {
        await this.redis.publish(this.flushChannel, JSON.stringify({ tenantId }));
        await ledger.flushExternal();
      }),
    );
  }

  onFlush(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('handler must be a function');
    }
    return this.redis.subscribe(this.flushChannel, handler);
  }
}

function createTelemetryTenantRouter(options) {
  return new TelemetryTenantRouter(options);
}

module.exports = {
  TelemetryTenantRouter,
  createTelemetryTenantRouter,
};
