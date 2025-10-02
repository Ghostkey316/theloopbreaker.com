/* Vaultfire Identity Resolver Types (Staging / Simulated / Pre-Production Only) */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface IdentityResolverMetadata {
  tags?: string[];
  lastVerified?: string | null;
  source?: string | null;
  loadedAt?: string | null;
}

export interface IdentityResolverOptions {
  rosterPath?: string;
  logger?: Console;
  refreshIntervalMs?: number;
  enableEnsFallback?: boolean;
  rpcUrl?: string;
  providerFactory?: (url: string) => unknown;
}

export interface IdentityResolver {
  init(): Promise<IdentityResolver>;
  refresh(): Promise<number>;
  stop(): void;
  resolve(identifier: string): Promise<string | null>;
  resolveSync(identifier: string): string | null;
  getMetadata(identifier: string): IdentityResolverMetadata | null;
}

const runtime = require('./identityResolverRuntime');

export const STAGING_LABEL: string = runtime.STAGING_LABEL;

export const createIdentityResolver = (options?: IdentityResolverOptions): IdentityResolver =>
  runtime.createIdentityResolver(options);

export const getDefaultIdentityResolver = (options?: IdentityResolverOptions): IdentityResolver =>
  runtime.getDefaultIdentityResolver(options);
