const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

const { createFingerprint } = require('./services/originFingerprint');
const { RetryRelayHandler } = require('./services/retryRelayHandler');
const { createSignalRelay } = require('./services/signalRelay');
const { createBeliefSyncStorage } = require('./lib/beliefSyncStorageRuntime');

const GLOBAL_BUS = new EventEmitter();

const DEFAULT_ARCHIVE_DIR = path.join(__dirname, 'sync-archive');
const RETRY_SCHEDULE_PATH = path.join(__dirname, 'logs', 'partner_relays', 'retry-schedule.json');

class BeliefSyncEngine extends EventEmitter {
  constructor(session_id, ghost_id, options = {}) {
    super();
    this.session_id = session_id;
    this.ghost_id = ghost_id;
    this.logger = options.logger || console;
    this.partnerNodes = [];
    this.storage =
      options.storage ||
      createBeliefSyncStorage({
        dbPath: options.dbPath,
        archiveDir: options.archiveDir || DEFAULT_ARCHIVE_DIR,
        logger: this.logger,
      });
    this.syncSequence = 0;
    this.readyPromise = this.storage
      .init()
      .then(async () => {
        await this.#reloadNodes();
        if (options.autoArchive !== false) {
          try {
            await this.storage.archiveStale();
          } catch (error) {
            this.logger.warn?.('[belief-sync] archive sweep failed', { error: error.message });
          }
        }
      })
      .catch((error) => {
        this.logger.error?.('[belief-sync] storage initialisation failed', { error: error.message });
      });
    this.signalRelay = createSignalRelay({
      queueFilePath: RETRY_SCHEDULE_PATH,
      fallbackWriter: (node, payload, meta) => {
        this.#handleFallback(node, payload, meta).catch(() => {});
      },
      nowFn: () => Date.now(),
      retryHandler: new RetryRelayHandler({
        maxAttempts: 3,
        baseDelayMs: 30_000,
        maxDelayMs: 15 * 60 * 1000,
        scheduler: (cb) => cb(),
      }),
    });
    GLOBAL_BUS.on('sync', e => {
      if (e.session_id === this.session_id && e.ghost_id !== this.ghost_id) {
        this.emit('sync', e);
      }
    });
  }

  async registerExternalNode(node) {
    await this.#ensureReady();
    const sanitized = {
      id: node.id || node.partnerId || crypto.randomUUID(),
      endpoint: node.endpoint || null,
      relayKey: node.relayKey || null,
      partnerId: node.partnerId || null,
      ens: node.ens || null,
    };
    await this.storage.registerNode(sanitized);
    await this.#reloadNodes();
    return sanitized;
  }

  #originPayload(options = {}) {
    const ensAlias = options.originEns || null;
    const fingerprint = createFingerprint({ wallet: this.ghost_id, ens: ensAlias });
    return {
      wallet: this.ghost_id,
      ens: ensAlias,
      fingerprint: fingerprint.fingerprint,
      method: fingerprint.method,
    };
  }

  async #broadcast(entry) {
    await this.#ensureReady();
    if (!this.partnerNodes.length) {
      return;
    }
    const payload = this.#buildPayload(entry);
    const nonce = entry.nonce ?? this.#nextNonce();
    await Promise.all(
      this.partnerNodes.map(async (node) => {
        const nodeId = node.id || node.partnerId || 'unknown';
        const { record } = await this.storage.recordSyncEvent({
          nodeId,
          payload,
          timestamp: entry.timestamp,
          status: 'queued',
          nonce,
        });
        const syncHash = record?.syncHash || null;
        const outcome = await this.signalRelay.dispatch(node, payload, {
          telemetryId: entry.session_id,
        });
        if (!syncHash) {
          return;
        }
        const baseUpdate = { retryCount: outcome.attempts || 0 };
        if (outcome.status === 'delivered') {
          await this.storage.updateSyncStatus(nodeId, syncHash, 'delivered', baseUpdate);
        } else if (outcome.status === 'failed') {
          await this.storage.updateSyncStatus(nodeId, syncHash, 'failed', {
            ...baseUpdate,
            lastError: outcome.job?.lastError || 'relay-failed',
          });
        } else {
          await this.storage.updateSyncStatus(nodeId, syncHash, 'scheduled', baseUpdate);
        }
      })
    );
  }

  async syncChoice(belief_fork_id, choice, options = {}) {
    await this.#ensureReady();
    const nonce = this.#nextNonce();
    const entry = {
      session_id: this.session_id,
      ghost_id: this.ghost_id,
      belief_fork_id,
      choice,
      origin: this.#originPayload(options),
      timestamp: Date.now(),
      nonce,
    };
    const payload = this.#buildPayload(entry);
    await this.storage.recordSyncEvent({
      nodeId: `session:${this.session_id}`,
      payload,
      timestamp: entry.timestamp,
      status: 'logged',
      nonce,
    });
    GLOBAL_BUS.emit('sync', entry);
    this.#broadcast(entry).catch(() => {});
    return entry;
  }

  async getStats() {
    await this.#ensureReady();
    const events = await this.storage.getRecentEvents(250);
    const counts = {};
    for (const record of events) {
      if (!record || record.nodeId !== `session:${this.session_id}`) {
        continue;
      }
      const payload = this.#normalizePayload(record.payload);
      const choice = payload?.choice;
      if (!choice) {
        continue;
      }
      counts[choice] = (counts[choice] || 0) + 1;
    }
    return counts;
  }

  async processRetryQueue({ now = Date.now(), maxAttempts = 5 } = {}) {
    return this.signalRelay.retry({ now, maxAttempts });
  }

  async #ensureReady() {
    if (this.readyPromise) {
      await this.readyPromise;
      this.readyPromise = null;
    }
    if (!Array.isArray(this.partnerNodes)) {
      this.partnerNodes = [];
    }
  }

  async #reloadNodes() {
    try {
      this.partnerNodes = await this.storage.listNodes();
    } catch (error) {
      this.logger.warn?.('[belief-sync] failed to load partner nodes', { error: error.message });
      this.partnerNodes = [];
    }
    return this.partnerNodes;
  }

  #buildPayload(entry) {
    return {
      session_id: entry.session_id,
      ghost_id: entry.ghost_id,
      belief_fork_id: entry.belief_fork_id,
      choice: entry.choice,
      origin: entry.origin,
      timestamp: entry.timestamp,
      nonce: entry.nonce ?? null,
    };
  }

  async #handleFallback(node, payload, meta = {}) {
    try {
      await this.#ensureReady();
    } catch (error) {
      this.logger.warn?.('[belief-sync] fallback invoked before storage ready', { error: error.message });
    }
    const nodeId = node?.id || node?.partnerId || 'unknown';
    const timestamp = payload?.timestamp || Date.now();
    const nonce = payload?.nonce ?? this.#nextNonce();
    const { record } = await this.storage.recordSyncEvent({
      nodeId,
      payload: this.#buildPayload(payload),
      timestamp,
      status: meta?.status || 'queued',
      nonce,
    });
    if (record?.syncHash) {
      await this.storage.updateSyncStatus(nodeId, record.syncHash, meta?.status || 'queued', {
        lastError: meta?.error || null,
      });
    }
    return record;
  }

  #normalizePayload(rawPayload) {
    if (!rawPayload) {
      return null;
    }
    if (typeof rawPayload === 'string') {
      try {
        const parsed = JSON.parse(rawPayload);
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
      } catch (error) {
        this.logger.warn?.('[belief-sync] failed to parse stored payload', { error: error.message });
        return null;
      }
    }
    return rawPayload;
  }

  #nextNonce() {
    this.syncSequence = (this.syncSequence + 1) % Number.MAX_SAFE_INTEGER;
    return `${this.session_id}:${Date.now()}:${this.syncSequence}`;
  }
}

module.exports = { BeliefSyncEngine };
