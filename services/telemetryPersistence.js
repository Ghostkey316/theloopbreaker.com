const fs = require('fs');
const path = require('path');

class TelemetryPersistenceAdapter {
  constructor({ telemetry }) {
    this.telemetry = telemetry;
  }

  async init() {
    return undefined;
  }

  async persist() {
    throw new Error('persist must be implemented by subclasses');
  }

  async flush() {
    return undefined;
  }
}

class JsonFileTelemetryAdapter extends TelemetryPersistenceAdapter {
  constructor({ baseDir, fileName = 'telemetry.jsonl', telemetry }) {
    super({ telemetry });
    this.baseDir = baseDir || path.join(__dirname, '..', 'logs', 'telemetry');
    this.filePath = path.join(this.baseDir, fileName);
  }

  async init() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8');
    }
  }

  async persist(entry) {
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
  }
}

class PostgresTelemetryAdapter extends TelemetryPersistenceAdapter {
  constructor({ config = {}, tableName = 'vaultfire_telemetry', telemetry, clientFactory } = {}) {
    super({ telemetry });
    this.config = config;
    this.tableName = tableName;
    this.clientFactory = clientFactory;
    this.client = null;
  }

  async init() {
    if (this.client) {
      return;
    }
    const factory =
      this.clientFactory ||
      (() => {
        // eslint-disable-next-line global-require
        const { Client } = require('pg');
        return new Client(this.config);
      });
    this.client = await factory();
    if (typeof this.client.connect === 'function') {
      await this.client.connect();
    }
    await this.#ensureTable();
  }

  async #ensureTable() {
    const ddl = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        severity TEXT,
        tags JSONB,
        payload JSONB,
        correlation_id TEXT,
        visibility JSONB,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await this.client.query(ddl);
    // Partitioning is coordinated by DAO reward streaming sync jobs once ledger volume reaches production thresholds.
  }

  async persist(entry, context = {}) {
    if (!this.client) {
      await this.init();
    }
    const statement = `
      INSERT INTO ${this.tableName} (id, event_type, timestamp, severity, tags, payload, correlation_id, visibility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING;
    `;
    const values = [
      entry.id,
      entry.eventType,
      entry.timestamp,
      entry.severity,
      JSON.stringify(entry.tags || []),
      JSON.stringify(entry.payload || {}),
      entry.correlationId,
      JSON.stringify(context.visibility || {}),
    ];
    await this.client.query(statement, values);
  }

  async flush() {
    if (this.client && typeof this.client.end === 'function') {
      await this.client.end();
    }
    this.client = null;
  }
}

class SupabaseTelemetryAdapter extends TelemetryPersistenceAdapter {
  constructor({
    config = {},
    tableName = 'vaultfire_telemetry',
    telemetry,
    client,
    clientFactory,
  } = {}) {
    super({ telemetry });
    this.config = config;
    this.tableName = tableName;
    this.client = client || null;
    this.clientFactory = clientFactory;
  }

  async init() {
    if (this.client) {
      return;
    }
    if (this.clientFactory) {
      this.client = await this.clientFactory();
      return;
    }
    // eslint-disable-next-line global-require
    const { createClient } = require('@supabase/supabase-js');
    const { url, serviceRoleKey } = this.config;
    if (!url || !serviceRoleKey) {
      throw new Error('Supabase adapter requires url and serviceRoleKey');
    }
    this.client = createClient(url, serviceRoleKey, this.config.options || {});
  }

  async persist(entry, context = {}) {
    if (!this.client) {
      await this.init();
    }
    const payload = {
      id: entry.id,
      event_type: entry.eventType,
      timestamp: entry.timestamp,
      severity: entry.severity,
      tags: entry.tags || [],
      payload: entry.payload || {},
      correlation_id: entry.correlationId,
      visibility: context.visibility || {},
    };
    const response = await this.client.from(this.tableName).insert(payload);
    if (response.error) {
      throw response.error;
    }
  }

  async flush() {
    return undefined;
  }
}

function createTelemetryPersistence(config = {}) {
  if (!config || config.type === 'json' || Object.keys(config).length === 0) {
    const jsonConfig = config.json || {};
    if (!jsonConfig.baseDir && config.baseDir) {
      jsonConfig.baseDir = config.baseDir;
    }
    return new JsonFileTelemetryAdapter({ ...jsonConfig, telemetry: config.telemetry });
  }
  if (config.type === 'postgres') {
    return new PostgresTelemetryAdapter({
      config: config.connection || config.config || {},
      tableName: config.tableName,
      telemetry: config.telemetry,
      clientFactory: config.clientFactory,
    });
  }
  if (config.type === 'supabase') {
    return new SupabaseTelemetryAdapter({
      config,
      tableName: config.tableName,
      telemetry: config.telemetry,
      client: config.client,
      clientFactory: config.clientFactory,
    });
  }
  return new JsonFileTelemetryAdapter(config.json || { baseDir: config.baseDir });
}

module.exports = {
  TelemetryPersistenceAdapter,
  JsonFileTelemetryAdapter,
  PostgresTelemetryAdapter,
  SupabaseTelemetryAdapter,
  createTelemetryPersistence,
};
