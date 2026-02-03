/**
 * Vaultfire SDK Safe Defaults
 *
 * This wrapper is intended for partners who want privacy-preserving defaults
 * and a narrower API surface that is harder to misuse.
 *
 * Design goals:
 * - Do not ship user statements/PII anywhere by default (hash locally)
 * - Disable analytics by default
 * - Avoid optional metadata (easy to accidentally leak)
 * - Keep dependencies minimal (reuses ethers + existing SDK)
 */

import type { Signer } from 'ethers';
import { VaultfireSDK } from './vaultfire';
import type { ChainId, VaultfireConfig, VerificationResult } from './vaultfire';

export interface VaultfireSafeConfig extends VaultfireConfig {
  /**
   * When set, statements are hashed as `keccak256(UTF8("${privacySalt}:${normalizedStatement}"))`.
   *
   * Recommended: provide a stable, secret per-application salt via env var.
   * This mitigates dictionary/rainbow-table attacks against short statements.
   */
  privacySalt?: string;

  /**
   * If `true`, statements are normalized before hashing (trim + collapse whitespace).
   * Default: true.
   */
  normalizeStatements?: boolean;
}

export interface VerifyStatementRequest {
  /** Human-readable statement. This wrapper will hash it locally. */
  statement: string;

  /** Module ID (see ModuleType enum in vaultfire.ts). */
  moduleId: number;

  /** Optional ZK proof bundle (hex). If omitted, the underlying SDK uses a minimal placeholder. */
  zkProofBundle?: string;
}

function normalizeStatement(statement: string): string {
  return statement.trim().replace(/\s+/g, ' ');
}

/**
 * Privacy-preserving wrapper around `VaultfireSDK`.
 */
export class VaultfireSafeSDK {
  private readonly sdk: VaultfireSDK;
  private readonly privacySalt?: string;
  private readonly normalize: boolean;

  constructor(config: VaultfireSafeConfig = {}) {
    const { privacySalt, normalizeStatements, ...rest } = config;

    this.privacySalt = privacySalt;
    this.normalize = normalizeStatements !== false;

    // Safe defaults: analytics OFF, apiKey empty unless explicitly provided.
    this.sdk = new VaultfireSDK({
      ...rest,
      analytics: false,
      apiKey: rest.apiKey || '',
    });
  }

  /** Connect a signer for write operations (same as underlying SDK). */
  connect(signer: Signer): void {
    this.sdk.connect(signer);
  }

  /**
   * Hash a statement locally.
   *
   * Note: This is *not* reversible and is safe to store/log compared to raw statement.
   */
  hashStatement(statement: string): string {
    const normalized = this.normalize ? normalizeStatement(statement) : statement;
    const payload = this.privacySalt ? `${this.privacySalt}:${normalized}` : normalized;
    return this.sdk.hashBelief(payload);
  }

  /**
   * Verify a statement (hashes locally and sends only `beliefHash` on-chain).
   */
  async verifyStatement(request: VerifyStatementRequest): Promise<VerificationResult> {
    const beliefHash = this.hashStatement(request.statement);

    // Intentionally do not accept metadata to reduce accidental leakage.
    return this.sdk.verifyBelief({
      beliefHash,
      moduleId: request.moduleId,
      zkProofBundle: request.zkProofBundle,
    });
  }

  /** Convenience passthroughs (read-only). */
  isSovereign(beliefHash: string): Promise<boolean> {
    return this.sdk.isSovereign(beliefHash);
  }

  getModules() {
    return this.sdk.getModules();
  }

  getChainConfig() {
    return this.sdk.getChainConfig();
  }

  /** Escape hatch: access the underlying SDK if you truly need it. */
  unsafeRaw(): VaultfireSDK {
    return this.sdk;
  }
}

export function createVaultfireSafeSDK(config: VaultfireSafeConfig = {}): VaultfireSafeSDK {
  return new VaultfireSafeSDK(config);
}

export function createVaultfireSafeSDKForChain(chain: ChainId = 'base', config: Omit<VaultfireSafeConfig, 'chain'> = {}): VaultfireSafeSDK {
  return new VaultfireSafeSDK({ ...config, chain });
}
