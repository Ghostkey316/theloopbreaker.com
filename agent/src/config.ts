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
  ERC8004IdentityRegistry: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  AIPartnershipBondsV2: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
  AIAccountabilityBondsV2: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
  FlourishingMetricsOracle: '0x83dd216449B3F0574E39043ECFE275946fa492e9',
  ProductionBeliefAttestationVerifier: '0xa5CEC47B48999EB398707838E3A18dd20A1ae272',
  ERC8004ReputationRegistry: '0xdB54B8925664816187646174bdBb6Ac658A55a5F',
  ERC8004ValidationRegistry: '0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55',
  VaultfireERC8004Adapter: '0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0',
  MultisigGovernance: '0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92',
  PrivacyGuarantees: '0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045',
  MissionEnforcement: '0x8568F4020FCD55915dB3695558dD6D2532599e56',
  AntiSurveillance: '0x722E37A7D6f27896C688336AaaFb0dDA80D25E57',
  BeliefAttestationVerifier: '0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba',
  DilithiumAttestor: '0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4',
  VaultfireTeleporterBridge: '0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2',
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
  ERC8004IdentityRegistry: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  AIPartnershipBondsV2: '0xea6B504827a746d781f867441364C7A732AA4b07',
  AIAccountabilityBondsV2: '0xaeFEa985E0C52f92F73606657B9dA60db2798af3',
  FlourishingMetricsOracle: '0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695',
  ProductionBeliefAttestationVerifier: '0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F',
  ERC8004ReputationRegistry: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
  ERC8004ValidationRegistry: '0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b',
  VaultfireERC8004Adapter: '0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053',
  MultisigGovernance: '0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee',
  PrivacyGuarantees: '0xc09F0e06690332eD9b490E1040BdE642f11F3937',
  MissionEnforcement: '0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB',
  AntiSurveillance: '0x281814eF92062DA8049Fe5c4743c4Aef19a17380',
  BeliefAttestationVerifier: '0x227e27e7776d3ee14128BC66216354495E113B19',
  VaultfireTeleporterBridge: '0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31',
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
      '0xA054f831B562e729F8D268291EBde1B2EDcFb84F',
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
