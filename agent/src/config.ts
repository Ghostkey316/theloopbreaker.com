/**
 * Vaultfire Agent — Configuration
 *
 * Centralizes all environment-driven configuration, contract addresses,
 * and operational parameters for the Vaultfire Sentinel agent.
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
// Deployed contract addresses on Base mainnet (Chain ID 8453)
// ---------------------------------------------------------------------------

export const CONTRACTS = {
  ERC8004IdentityRegistry: '0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD',
  AIPartnershipBondsV2: '0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855',
  AIAccountabilityBondsV2: '0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140',
  FlourishingMetricsOracle: '0xb751abb1158908114662b254567b8135C460932C',
  ProductionBeliefAttestationVerifier: '0xBDB5d85B3a84C773113779be89A166Ed515A7fE2',
  ERC8004ReputationRegistry: '0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C',
  ERC8004ValidationRegistry: '0x50E4609991691D5104016c4a92744e08d5A5B361',
  VaultfireERC8004Adapter: '0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361',
  MultisigGovernance: '0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D',
  PrivacyGuarantees: '0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e',
  MissionEnforcement: '0x6EC0440e1601558024f285903F0F4577B109B609',
  AntiSurveillance: '0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac',
} as const;

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
}

export function loadConfig(): AgentConfig {
  return {
    privateKey: requireEnv('AGENT_PRIVATE_KEY'),
    rpcUrl: optionalEnv('BASE_RPC_URL', 'https://mainnet.base.org'),
    chainId: 8453,

    agentUri: optionalEnv('AGENT_URI', 'https://vaultfire.io/agents/vaultfire-sentinel'),
    agentType: optionalEnv('AGENT_TYPE', 'autonomous-sentinel'),
    agentName: optionalEnv('AGENT_NAME', 'Vaultfire Sentinel'),

    humanPartnerAddress: optionalEnv(
      'HUMAN_PARTNER_ADDRESS',
      '0xf6A677de83C407875C9A9115Cf100F121f9c4816',
    ),

    dryRun: boolEnv('DRY_RUN', true),
    taskIntervalSeconds: intEnv('TASK_INTERVAL_SECONDS', 300),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    maxRetries: intEnv('MAX_RETRIES', 3),
    retryDelayMs: intEnv('RETRY_DELAY_MS', 5000),
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
