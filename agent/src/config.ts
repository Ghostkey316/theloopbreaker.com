/**
 * Vaultfire Agent — Configuration
 *
 * Centralizes all environment-driven configuration, contract addresses,
 * and operational parameters for the Vaultfire Sentinel agent.
 *
 * Multichain support:
 *   Base mainnet is the PRIMARY / CANONICAL chain (default).
 *   Avalanche C-Chain is a supported SECONDARY chain.
 *   Set VAULTFIRE_CHAIN=avalanche to target Avalanche.
 *
 * Demo mode:
 *   Set DEMO_MODE=true to run a shortened demo loop suitable for
 *   Build Games showcases.  When DEMO_MODE is active and the chain
 *   is avalancheFuji, the agent runs through registration, bond
 *   discovery, and metrics reporting in a single pass then exits.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from the agent directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function boolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ---------------------------------------------------------------------------
// Deployed contract addresses on Base mainnet (Chain ID 8453) — PRIMARY
// ---------------------------------------------------------------------------

export const CONTRACTS = {
  ERC8004IdentityRegistry: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  AIPartnershipBondsV2: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  AIAccountabilityBondsV2: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
  FlourishingMetricsOracle: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
  ProductionBeliefAttestationVerifier: '0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B',
  ERC8004ReputationRegistry: '0x544B575431ECD927bA83E85008446fA1e100204a',
  ERC8004ValidationRegistry: '0x501fE0f960c1e061C4d295Af241f9F1512775556',
  VaultfireERC8004Adapter: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c',
  MultisigGovernance: '0xea0A6750642AA294658dC9f1eDf36b95D21e7B22',
  PrivacyGuarantees: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
  MissionEnforcement: '0x38165D2D7a8584985CCa5640f4b32b1f3347CC83',
  AntiSurveillance: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
  BeliefAttestationVerifier: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
  VaultfireTeleporterBridge: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05',
} as const;

// ---------------------------------------------------------------------------
// Multichain support — chain definitions
// ---------------------------------------------------------------------------

/** Metadata for a supported chain. */
export interface ChainDefinition {
  chainId: number;
  label: string;
  role: 'primary' | 'secondary' | 'testnet';
  rpcUrl: string;
  explorer: string;
}

/**
 * Registry of all chains supported by the Vaultfire Protocol.
 * Base mainnet is the canonical / primary deployment.
 */
export const SUPPORTED_CHAINS: Record<string, ChainDefinition> = {
  base: {
    chainId: 8453,
    label: 'Base Mainnet',
    role: 'primary',
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  avalanche: {
    chainId: 43114,
    label: 'Avalanche C-Chain',
    role: 'secondary',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
  },
  avalancheFuji: {
    chainId: 43113,
    label: 'Avalanche Fuji',
    role: 'testnet',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorer: 'https://testnet.snowtrace.io',
  },
} as const;

/**
 * Deployed contract addresses for Avalanche C-Chain (Chain ID 43114).
 * All 14 contracts deployed and verified on Snowtrace — Feb 18, 2026.
 */
export const AVALANCHE_CONTRACTS: Record<string, string> = {
  ERC8004IdentityRegistry: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
  AIPartnershipBondsV2: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
  AIAccountabilityBondsV2: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
  FlourishingMetricsOracle: '0x83b2D1a8e383c4239dE66b6614176636618c1c0A',
  ProductionBeliefAttestationVerifier: '0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1',
  ERC8004ReputationRegistry: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  ERC8004ValidationRegistry: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
  VaultfireERC8004Adapter: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  MultisigGovernance: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
  PrivacyGuarantees: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
  MissionEnforcement: '0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709',
  AntiSurveillance: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
  BeliefAttestationVerifier: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
  VaultfireTeleporterBridge: '0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf',
};

/**
 * Resolve the active chain from the VAULTFIRE_CHAIN environment variable.
 * Defaults to "base" (primary) when unset.
 */
export function resolveChain(): ChainDefinition {
  const chainKey = optionalEnv('VAULTFIRE_CHAIN', 'base');
  const chain = SUPPORTED_CHAINS[chainKey];
  if (!chain) {
    throw new Error(
      `Unsupported VAULTFIRE_CHAIN value: "${chainKey}". ` +
      `Supported: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`,
    );
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Demo mode configuration
// ---------------------------------------------------------------------------

/**
 * Read the current DEMO_MODE flag from the environment.
 *
 * This is a function (not a module-level constant) so that tests can set
 * process.env.DEMO_MODE *after* the module is imported and still get the
 * correct value.
 */
export function getDemoMode(): boolean {
  return boolEnv('DEMO_MODE', false);
}

/**
 * Convenience re-export — reads DEMO_MODE at call time.
 * Kept as a getter-style constant for backward compatibility with code that
 * references `DEMO_MODE` directly.
 */
export const DEMO_MODE: boolean = false; // default; use getDemoMode() at runtime

/** Number of task cycles to execute in demo mode before exiting. */
export function getDemoCycles(): number {
  return intEnv('DEMO_CYCLES', 1);
}

/** Task interval override when demo mode is active (seconds). */
export function getDemoTaskInterval(): number {
  return intEnv('DEMO_TASK_INTERVAL', 10);
}

/**
 * Returns true when the agent should run in demo mode.
 * Demo mode is only active when DEMO_MODE=true AND the chain is avalancheFuji.
 */
export function isDemoActive(): boolean {
  if (!getDemoMode()) return false;
  const chain = resolveChain();
  return chain.chainId === 43113; // avalancheFuji
}

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

export interface AgentConfig {
  // Wallet
  privateKey: string;
  rpcUrl: string;
  chainId: number;

  // Identity
  agentUri: string;
  agentType: string;
  agentName: string;

  // Partner
  humanPartnerAddress: string;

  // Operation
  dryRun: boolean;
  taskIntervalSeconds: number;
  logLevel: string;

  // Retry
  maxRetries: number;
  retryDelayMs: number;

  // Demo
  demoMode: boolean;
  demoCycles: number;
}

export function loadConfig(): AgentConfig {
  const chain = resolveChain();
  const demoActive = isDemoActive();

  return {
    privateKey: requireEnv('AGENT_PRIVATE_KEY'),
    rpcUrl: optionalEnv('BASE_RPC_URL', chain.rpcUrl),
    chainId: chain.chainId,

    agentUri: optionalEnv('AGENT_URI', 'https://vaultfire.io/agents/vaultfire-sentinel'),
    agentType: optionalEnv('AGENT_TYPE', 'autonomous-sentinel'),
    agentName: optionalEnv('AGENT_NAME', 'Vaultfire Sentinel'),

    humanPartnerAddress: optionalEnv(
      'HUMAN_PARTNER_ADDRESS',
      '0xf6A677de83C407875C9A9115Cf100F121f9c4816',
    ),

    dryRun: boolEnv('DRY_RUN', true),
    taskIntervalSeconds: demoActive
      ? getDemoTaskInterval()
      : intEnv('TASK_INTERVAL_SECONDS', 300),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    maxRetries: intEnv('MAX_RETRIES', 3),
    retryDelayMs: intEnv('RETRY_DELAY_MS', 5000),

    demoMode: demoActive,
    demoCycles: demoActive ? getDemoCycles() : 0,
  };
}

// ---------------------------------------------------------------------------
// Metric IDs (keccak256 hashes used by FlourishingMetricsOracle)
// ---------------------------------------------------------------------------

export const METRIC_IDS = {
  PROTOCOL_HEALTH: 'protocol_health',
  AGENT_UPTIME: 'agent_uptime',
  BOND_QUALITY: 'bond_quality',
  TASK_COMPLETION: 'task_completion',
  PARTNERSHIP_FLOURISHING: 'partnership_flourishing',
} as const;
