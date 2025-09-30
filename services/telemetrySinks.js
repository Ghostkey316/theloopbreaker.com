const crypto = require('crypto');

function ensurePromise(result) {
  if (result && typeof result.then === 'function') {
    return result;
  }
  return Promise.resolve(result);
}

function createS3Sink(config = {}) {
  const { client, bucket, prefix = '' } = config;
  if (!client || typeof client.putObject !== 'function') {
    throw new Error('S3 sink requires a client with putObject');
  }
  if (!bucket) {
    throw new Error('S3 sink requires a bucket');
  }

  return {
    async write(event) {
      const timestamp = event.entry?.timestamp || new Date().toISOString();
      const hash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0, 12);
      const key = `${prefix}${timestamp.replace(/[:]/g, '-')}_${hash}.json`;
      const body = JSON.stringify(event);
      await ensurePromise(
        client.putObject({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/json',
        })
      );
    },
  };
}

function createFirehoseSink(config = {}) {
  const { client, streamName } = config;
  if (!client || typeof client.putRecordBatch !== 'function') {
    throw new Error('Firehose sink requires a client with putRecordBatch');
  }
  if (!streamName) {
    throw new Error('Firehose sink requires a streamName');
  }

  return {
    async write(event) {
      const payload = `${JSON.stringify(event)}\n`;
      await ensurePromise(
        client.putRecordBatch({
          DeliveryStreamName: streamName,
          Records: [{ Data: Buffer.from(payload) }],
        })
      );
    },
  };
}

function createCustomSink(config = {}) {
  if (typeof config.handler !== 'function') {
    throw new Error('Custom sink requires a handler function');
  }
  return {
    async write(event) {
      await ensurePromise(config.handler(event));
    },
  };
}

function buildSink(config) {
  if (!config || !config.type) {
    throw new Error('Telemetry sink requires a type');
  }
  switch (config.type) {
    case 's3':
      return createS3Sink(config);
    case 'firehose':
      return createFirehoseSink(config);
    case 'custom':
      return createCustomSink(config);
    default:
      throw new Error(`Unsupported telemetry sink type: ${config.type}`);
  }
}

class TelemetrySinkRegistry {
  constructor(configs = []) {
    this.sinks = configs.map(buildSink);
    this.pending = new Set();
  }

  dispatch(event) {
    if (!this.sinks.length) {
      return;
    }
    for (const sink of this.sinks) {
      const task = ensurePromise(sink.write(event));
      this.pending.add(task);
      task.catch((error) => {
        console.warn('Telemetry sink failed', error);
      }).finally(() => {
        this.pending.delete(task);
      });
    }
  }

  async flush() {
    if (!this.pending.size) {
      return;
    }
    await Promise.allSettled(Array.from(this.pending));
  }
}

function createTelemetrySinkRegistry(configs = []) {
  if (!configs.length) {
    return null;
  }
  return new TelemetrySinkRegistry(configs);
}

module.exports = {
  createTelemetrySinkRegistry,
  TelemetrySinkRegistry,
};
