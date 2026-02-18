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
  ERC8004IdentityRegistry: '0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD',
  AIPartnershipBondsV2: '0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855',
  AIAccountabilityBondsV2: '0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140',
  FlourishingMetricsOracle: '0xb751abb1158908114662b254567b8135C460932C',
  ProductionBeliefAttestationVerifier: '0xBDB5d85B3a84C773113779be89A166Ed515A7fE2',
  ERC8004ReputationRegistry: '0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C',
  ERC8004ValidationRegistry: '0x50E4609991691D5104016c4a2F6D2875234d4B06',
  VaultfireERC8004Adapter: '0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361',
  MultisigGovernance: '0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D',
  PrivacyGuarantees: '0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e',
  MissionEnforcement: '0x6EC0440e1601558024f285903F0F4577B109B609',
  AntiSurveillance: '0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac',
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
 * Placeholder contract addresses for Avalanche C-Chain (Chain ID 43114).
 * These will be populated after the first Avalanche deployment.
 */
export const AVALANCHE_CONTRACTS: Record<string, string> = {
  ERC8004IdentityRegistry: '',
  AIPartnershipBondsV2: '',
  AIAccountabilityBondsV2: '',
  FlourishingMetricsOracle: '',
  ProductionBeliefAttestationVerifier: '',
  ERC8004ReputationRegistry: '',
  ERC8004ValidationRegistry: '',
  VaultfireERC8004Adapter: '',
  MultisigGovernance: '',
  PrivacyGuarantees: '',
  MissionEnforcement: '',
  AntiSurveillance: '',
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
