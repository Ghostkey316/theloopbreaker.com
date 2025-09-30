const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

function safeParseManifest(raw, defaults) {
  try {
    if (!raw) {
      return { ...defaults, status: 'fallback', error: 'manifest_empty' };
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      semanticVersion: parsed.semanticVersion || parsed.version || defaults.semanticVersion,
      ethicsTags: Array.isArray(parsed.ethicsTags) ? parsed.ethicsTags : defaults.ethicsTags,
      scopeTags: Array.isArray(parsed.scopeTags) ? parsed.scopeTags : defaults.scopeTags,
      status: 'ok',
    };
  } catch (error) {
    return { ...defaults, status: 'fallback', error: 'manifest_parse_error' };
  }
}

function emitTelemetry(telemetry, event, payload) {
  if (!telemetry || typeof telemetry.record !== 'function') {
    return;
  }
  telemetry.record(event, payload, {
    tags: ['manifest'],
    visibility: { partner: false, ethics: true, audit: true },
  });
}

class ManifestFailover extends EventEmitter {
  constructor({ manifestPath, defaults, telemetry, watch = true } = {}) {
    super();
    if (!manifestPath) {
      throw new Error('manifestPath is required');
    }
    this.defaults = defaults || {};
    this.manifestPath = manifestPath;
    this.telemetry = telemetry;
    this.cache = null;
    this.cacheMtime = 0;
    this.watch = null;
    this.lastStatus = null;
    this.refresh();
    if (watch) {
      this.#startWatcher();
    }
  }

  #startWatcher() {
    try {
      const directory = path.dirname(this.manifestPath);
      if (!fs.existsSync(directory)) {
        return;
      }
      this.watch = fs.watch(directory, (eventType, filename) => {
        if (!filename) {
          return;
        }
        const fullPath = path.resolve(directory, filename.toString());
        if (fullPath !== path.resolve(this.manifestPath)) {
          return;
        }
        if (eventType === 'rename') {
          // File might have been replaced; refresh regardless of mtime.
          this.cacheMtime = 0;
        }
        this.refresh();
      });
    } catch (error) {
      emitTelemetry(this.telemetry, 'manifest.watch.error', {
        message: error.message,
        manifestPath: this.manifestPath,
      });
    }
  }

  refresh() {
    try {
      const stats = fs.statSync(this.manifestPath);
      if (!this.cache || stats.mtimeMs !== this.cacheMtime) {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const manifest = safeParseManifest(raw, this.defaults);
        this.cache = manifest;
        this.cacheMtime = stats.mtimeMs;
        if (this.lastStatus && this.lastStatus !== manifest.status && manifest.status === 'ok') {
          emitTelemetry(this.telemetry, 'manifest.failover.recovered', {
            manifestPath: this.manifestPath,
            semanticVersion: manifest.semanticVersion,
          });
        }
        this.lastStatus = manifest.status;
        this.emit('update', this.cache);
      }
    } catch (error) {
      const fallback = {
        ...this.defaults,
        status: 'fallback',
        error: error.code === 'ENOENT' ? 'manifest_missing' : 'manifest_unavailable',
      };
      this.cache = fallback;
      this.cacheMtime = 0;
      if (this.lastStatus !== 'fallback') {
        emitTelemetry(this.telemetry, 'manifest.failover.activated', {
          manifestPath: this.manifestPath,
          reason: fallback.error,
        });
      }
      this.lastStatus = 'fallback';
      this.emit('update', this.cache);
    }
    return this.cache;
  }

  snapshot() {
    if (!this.cache) {
      return this.refresh();
    }
    return { ...this.cache };
  }

  close() {
    if (this.watch) {
      this.watch.close();
      this.watch = null;
    }
  }
}

function createManifestFailover(options) {
  return new ManifestFailover(options);
}

module.exports = {
  ManifestFailover,
  createManifestFailover,
};
