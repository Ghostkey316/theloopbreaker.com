/* Vaultfire Belief Sync Storage Types (Staging / Simulated / Pre-Production Only) */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface BeliefSyncRecord {
  nodeId: string;
  syncHash: string;
  timestamp: number;
  retryCount: number;
  payload: unknown;
  status: string;
  lastError?: string | null;
  archivedAt?: string;
  label?: string;
}

export interface BeliefSyncStorageOptions {
  dbPath?: string;
  archiveDir?: string;
  logger?: Console;
}

export interface BeliefSyncStorage {
  init(): Promise<BeliefSyncStorage>;
  registerNode(node: {
    id: string;
    endpoint?: string | null;
    relayKey?: string | null;
    partnerId?: string | null;
    ens?: string | null;
  }): Promise<{ id: string; endpoint: string | null; relay_key?: string | null; partner_id?: string | null; ens: string | null }>;
  listNodes(): Promise<{
    id: string;
    endpoint: string | null;
    relayKey: string | null;
    partnerId: string | null;
    ens: string | null;
  }[]>;
  recordSyncEvent(input: {
    nodeId: string;
    payload: unknown;
    timestamp?: number;
    retryCount?: number;
    status?: string;
    nonce?: string | null;
  }): Promise<{ inserted: boolean; record: BeliefSyncRecord | null }>;
  updateSyncStatus(
    nodeId: string,
    syncHash: string,
    status: string,
    options?: { retryCount?: number | null; lastError?: string | null },
  ): Promise<boolean>;
  archiveStale(options?: { now?: number; maxAgeMs?: number }): Promise<{ archived: number; archivePath: string | null }>;
  getRecentEvents(limit?: number): Promise<BeliefSyncRecord[]>;
}

const runtime = require('./beliefSyncStorageRuntime');

export const STAGING_LABEL: string = runtime.STAGING_LABEL;
export const FOURTEEN_DAYS_MS: number = runtime.FOURTEEN_DAYS_MS;

export const createBeliefSyncStorage = (options?: BeliefSyncStorageOptions): BeliefSyncStorage =>
  runtime.createBeliefSyncStorage(options);
