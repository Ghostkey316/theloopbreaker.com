const fs = require('fs');
const path = require('path');
const Transport = require('winston-transport');
const fetch = require('node-fetch');

const DEFAULT_BUFFER = path.join(__dirname, '..', '..', 'logs', 'cloud-buffer.log');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

class CloudTransport extends Transport {
  constructor(options = {}) {
    super(options);
    this.provider = options.provider || process.env.VAULTFIRE_LOG_CLOUD_PROVIDER || 'http';
    this.endpoint = options.endpoint || process.env.VAULTFIRE_LOG_ENDPOINT || null;
    this.bucket = options.bucket || process.env.VAULTFIRE_LOG_BUCKET || null;
    this.pinEndpoint = options.pinEndpoint || process.env.VAULTFIRE_LOG_IPFS_ENDPOINT || null;
    this.bufferFile = options.bufferFile || process.env.VAULTFIRE_LOG_BUFFER || DEFAULT_BUFFER;
    ensureDir(this.bufferFile);
  }

  async log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    try {
      await this.#forward(info);
    } catch (error) {
      this.emit('error', error);
      this.#buffer(info, error);
    }
    callback();
  }

  async #forward(info) {
    const payload = JSON.stringify({ ...info, forwardedAt: new Date().toISOString() });
    switch (this.provider) {
      case 's3':
      case 'gcs':
      case 'http':
        if (!this.endpoint) {
          throw new Error('Cloud log endpoint not configured');
        }
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-vaultfire-log-bucket': this.bucket || '' },
          body: payload,
        });
        break;
      case 'ipfs':
        if (!this.pinEndpoint) {
          throw new Error('IPFS pinning endpoint not configured');
        }
        await fetch(this.pinEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payload }),
        });
        break;
      case 'buffer':
        this.#buffer(info);
        break;
      default:
        throw new Error(`Unsupported cloud provider: ${this.provider}`);
    }
  }

  #buffer(info, error) {
    const payload = JSON.stringify({ ...info, error: error?.message, bufferedAt: new Date().toISOString() });
    ensureDir(this.bufferFile);
    fs.appendFileSync(this.bufferFile, `${payload}\n`);
  }
}

module.exports = CloudTransport;
