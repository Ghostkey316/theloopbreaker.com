'use strict';

const os = require('os');
const crypto = require('crypto');

const { FHEAdapter } = require('../encryption/fhe_adapter');
const { LogQueueAdapter } = require('../storage/log_queue_adapter');

function createInMemoryQueue({ logger = console } = {}) {
  const store = [];
  const backend = {
    id: 'vaultfire.memory-queue',
    append(records) {
      store.push(...records.map((record) => ({ ...record })));
      return { appended: records.length };
    },
  };
  const adapter = new LogQueueAdapter({
    backend,
    logger,
    defaults: { flushIntervalMs: 0, maxBatchSize: 100, maxQueueSize: 5000 },
  });
  return {
    adapter,
    store,
  };
}

async function validateEncryptionProofs({
  iterations = 120,
  concurrency = Math.max(1, Math.min(os.cpus()?.length || 4, 16)),
  adapterOptions = {},
  queueFactory = createInMemoryQueue,
  logger = console,
  valueGenerator = defaultValueGenerator,
  clock = () => Date.now(),
} = {}) {
  const { adapter: queueAdapter, store } = queueFactory({ logger });
  const fheAdapter = adapterOptions.adapter || new FHEAdapter({ ...adapterOptions, logger });
  const totalIterations = Math.max(iterations, 1);
  const totalConcurrency = Math.max(concurrency, 1);

  const summary = {
    iterations: totalIterations,
    concurrency: totalConcurrency,
    backendId: fheAdapter.backendId,
    migrationState: typeof fheAdapter.getMigrationState === 'function' ? fheAdapter.getMigrationState() : null,
    successes: 0,
    failures: 0,
    telemetryAppended: 0,
    checksum: null,
  };

  const batches = [];
  for (let i = 0; i < totalConcurrency; i += 1) {
    batches.push(
      runEncryptionBatch({
        fheAdapter,
        queueAdapter,
        iterations: Math.ceil(totalIterations / totalConcurrency),
        valueGenerator,
        logger,
        clock,
        summary,
      }),
    );
  }

  await Promise.all(batches);
  await queueAdapter.flush({ reason: 'complete' });
  await queueAdapter.shutdown({ drain: true });

  summary.telemetryAppended = store.length;
  summary.checksum = computeTelemetryChecksum(store);

  return summary;
}

async function runEncryptionBatch({
  fheAdapter,
  queueAdapter,
  iterations,
  valueGenerator,
  logger,
  clock,
  summary,
}) {
  for (let i = 0; i < iterations; i += 1) {
    const input = valueGenerator();
    try {
      const ciphertext = await fheAdapter.encrypt(input.value, {
        publicKey: input.publicKey,
        context: input.context,
      });
      const decrypted = await fheAdapter.decrypt(ciphertext, {});
      const expected = Number(input.value);
      if (!Number.isFinite(decrypted) || Math.abs(decrypted - expected) > input.tolerance) {
        summary.failures += 1;
        logger?.error?.('[validate-encryption] mismatch detected', {
          expected,
          decrypted,
        });
      } else {
        summary.successes += 1;
      }

      await queueAdapter.enqueue(
        {
          type: 'encryption-proof',
          payload: ciphertext,
          metadata: {
            value: input.value,
            context: input.context,
            issuedAt: clock(),
          },
        },
        { immediate: true },
      );
    } catch (error) {
      summary.failures += 1;
      logger?.error?.('[validate-encryption] operation failed', {
        error: error?.message || error,
      });
    }
  }
}

function defaultValueGenerator() {
  const value = Math.random() * 1000 - 500;
  return {
    value,
    context: 'vaultfire::audit',
    tolerance: 0.000001,
    publicKey: null,
  };
}

function computeTelemetryChecksum(entries = []) {
  const hash = crypto.createHash('sha256');
  for (const entry of entries) {
    hash.update(JSON.stringify(entry));
  }
  return hash.digest('hex');
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const [key, value] = arg.split('=');
    const normalized = key.replace(/^--/, '');
    switch (normalized) {
      case 'iterations':
        options.iterations = Number(value ?? argv[i + 1]);
        if (value === undefined) i += 1;
        break;
      case 'concurrency':
        options.concurrency = Number(value ?? argv[i + 1]);
        if (value === undefined) i += 1;
        break;
      case 'mode':
        options.adapterOptions = options.adapterOptions || {};
        options.adapterOptions.mode = value ?? argv[i + 1];
        if (value === undefined) i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

async function runCli() {
  const options = parseCliArgs();
  const logger = console;
  const summary = await validateEncryptionProofs({ ...options, logger });
  logger.info('Vaultfire encryption proof validation complete', summary);
}

module.exports = {
  validateEncryptionProofs,
  createInMemoryQueue,
  parseCliArgs,
  runCli,
};

if (require.main === module) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[validate-encryption] fatal error', error);
    process.exitCode = 1;
  });
}
