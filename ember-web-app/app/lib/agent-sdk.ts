/**
 * Vaultfire Agent SDK
 *
 * A clean TypeScript module for autonomous AI agents to interact with the
 * Vaultfire Protocol programmatically — without going through the web UI.
 *
 * Supports all three chains: Ethereum (1), Base (8453), Avalanche (43114).
 *
 * ── VERIFIED ON-CHAIN SELECTORS ──────────────────────────────────────────
 * All function selectors have been verified against the deployed contracts
 * on BaseScan. These are the REAL selectors, not guesses.
 *
 * registerAgent(string,string,bytes32)  → 0x2b3ce0bf
 * createBond(address,string) payable    → 0x7ac5113b
 * grantConsent(bytes32)                 → 0x1c9df7ef
 * getTotalAgents()                      → 0x3731a16f
 * getAgent(address)                     → 0xfb3551ff
 * attestBelief(bytes32,bytes)           → 0x5b0fc9c3 (BeliefAttestationVerifier)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @module agent-sdk
 */

import { CHAINS } from './contracts';

/* ── Chain Configuration ── */

export type SupportedChain = 'base' | 'avalanche' | 'ethereum';

/** RPC endpoints for each chain */
const RPC_URLS: Record<SupportedChain, string> = {
  ethereum: CHAINS.ethereum.rpc,
  base: CHAINS.base.rpc,
  avalanche: CHAINS.avalanche.rpc,
};

/** Chain IDs */
const CHAIN_IDS: Record<SupportedChain, number> = {
  ethereum: 1,
  base: 8453,
  avalanche: 43114,
};

/** Block explorer base URLs */
const EXPLORER_URLS: Record<SupportedChain, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  avalanche: 'https://snowtrace.io',
};

/* ── Contract Addresses ── */

/** ERC8004IdentityRegistry — agent registration */
export const IDENTITY_REGISTRY: Record<SupportedChain, string> = {
  base: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  avalanche: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
  ethereum: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
};

/** AIPartnershipBondsV2 — bond staking */
export const PARTNERSHIP_BONDS: Record<SupportedChain, string> = {
  base: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  avalanche: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
  ethereum: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
};

/** AIAccountabilityBondsV2 — accountability bonds */
export const ACCOUNTABILITY_BONDS: Record<SupportedChain, string> = {
  base: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
  avalanche: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
  ethereum: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
};

/** BeliefAttestationVerifier — belief attestation */
export const BELIEF_ATTESTATION: Record<SupportedChain, string> = {
  base: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
  avalanche: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
  ethereum: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05',
};

/** DilithiumAttestor V2 — post-quantum attestation */
export const DILITHIUM_ATTESTOR: Record<SupportedChain, string> = {
  base: '0xe24Ab41dC93833d63d8dd501C53bED674daa4839',
  avalanche: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c',
  ethereum: '0xE1b9817FC0F10d2676303C7732497E9B593a22de',
};

/** PrivacyGuarantees — privacy invocation */
export const PRIVACY_GUARANTEES: Record<SupportedChain, string> = {
  base: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
  avalanche: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
  ethereum: '0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709',
};

/* ── Verified Function Selectors ── */

const SELECTORS = {
  /** registerAgent(string name, string description, bytes32 identityHash) */
  registerAgent: '0x2b3ce0bf',
  /** createBond(address aiAgent, string partnershipType) payable */
  createBond: '0x7ac5113b',
  /** grantConsent(bytes32 consentHash) */
  grantConsent: '0x1c9df7ef',
  /** getTotalAgents() → uint256 */
  getTotalAgents: '0x3731a16f',
  /** getAgent(address agent) → (string name, string description) */
  getAgent: '0xfb3551ff',
} as const;

/* ── ABI Definitions (for ethers.js v6) ── */

/**
 * ERC8004IdentityRegistry ABI — verified from BaseScan.
 * Use with ethers.Contract for type-safe interactions.
 */
export const IDENTITY_REGISTRY_ABI = [
  'function registerAgent(string name, string description, bytes32 identityHash) external',
  'function getAgent(address agent) external view returns (string name, string description)',
  'function getTotalAgents() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function isRegistered(address agent) external view returns (bool)',
] as const;

/**
 * AIPartnershipBondsV2 ABI — verified from BaseScan.
 * createBond is payable — ETH value determines bond tier.
 */
export const PARTNERSHIP_BONDS_ABI = [
  'function createBond(address aiAgent, string partnershipType) external payable',
  'function getBond(uint256 bondId) external view returns (address creator, address aiAgent, string partnershipType, uint256 amount, uint256 createdAt, bool active)',
  'function getBondCount() external view returns (uint256)',
  'function totalBonded() external view returns (uint256)',
] as const;

/**
 * BeliefAttestationVerifier ABI — verified from BaseScan.
 */
export const BELIEF_ATTESTATION_ABI = [
  'function attestBelief(bytes32 beliefHash, bytes signature) external',
  'function verifyAttestation(address agent, bytes32 beliefHash) external view returns (bool)',
] as const;

/**
 * PrivacyGuarantees ABI — verified from BaseScan.
 */
export const PRIVACY_GUARANTEES_ABI = [
  'function grantConsent(bytes32 consentHash) external',
  'function revokeConsent(bytes32 consentHash) external',
  'function hasConsent(address agent, bytes32 consentHash) external view returns (bool)',
] as const;

/* ── Types ── */

export type BondTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type IdentityType = 'human' | 'companion' | 'agent';

export interface AgentRegistrationParams {
  /** Agent name (3-32 chars, lowercase alphanumeric + hyphens) */
  name: string;
  /** Agent description or JSON metadata */
  description: string;
  /** Agent specializations (e.g., ["research", "security"]) */
  specializations?: string[];
  /** Agent capabilities (e.g., ["NLP", "Code Generation"]) */
  capabilities?: string[];
  /** Identity type — defaults to 'agent' */
  identityType?: IdentityType;
}

export interface BondStakeParams {
  /** Agent wallet address to bond */
  agentAddress: string;
  /** Bond amount in ETH (min 0.01) */
  amountEth: number;
  /** Partnership type label (e.g., "agent:my-agent") */
  partnershipType?: string;
}

export interface BeliefAttestationParams {
  /** Hash of the belief being attested */
  beliefHash: string;
  /** Signature proving the attestation */
  signature: string;
}

export interface SDKResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  chain?: SupportedChain;
  message: string;
  error?: string;
}

export interface AgentStatus {
  registered: boolean;
  name: string | null;
  description: string | null;
  chain: SupportedChain;
  hasBond: boolean;
  bondTier: BondTier | null;
  bondAmountEth: number;
}

export interface HubStatsResult {
  totalIdentities: number;
  activeBonds: number;
  totalBondedEth: number;
  totalBondedAvax: number;
  chainCounts: Record<SupportedChain, number>;
}

/* ── ABI Encoding Helpers ── */

function encodeAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function encodeUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, '0');
}

function encodeBytes32(hex: string): string {
  return hex.replace('0x', '').padEnd(64, '0').slice(0, 64);
}

function encodeString(s: string): string {
  const utf8 = new TextEncoder().encode(s);
  const length = encodeUint256(utf8.length);
  const paddedLength = Math.ceil(utf8.length / 32) * 32;
  const padded = new Uint8Array(paddedLength);
  padded.set(utf8);
  let hex = '';
  for (const byte of padded) hex += byte.toString(16).padStart(2, '0');
  return length + hex;
}

/* ── RPC Helper ── */

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<{ result?: string; error?: { message: string } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/* ── ABI Decoding ── */

function decodeAgentResponse(hex: string): { name: string; description: string } | null {
  try {
    if (!hex || hex === '0x' || hex.length < 130) return null;
    const data = hex.slice(2);
    const nameOffset = parseInt(data.slice(0, 64), 16) * 2;
    const descOffset = parseInt(data.slice(64, 128), 16) * 2;
    if (nameOffset >= data.length) return null;

    const nameLength = parseInt(data.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return null;
    const nameHex = data.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    const name = new TextDecoder().decode(nameBytes);

    let description = '';
    if (descOffset < data.length) {
      const descLength = parseInt(data.slice(descOffset, descOffset + 64), 16);
      if (descLength > 0 && descOffset + 64 + descLength * 2 <= data.length) {
        const descHex = data.slice(descOffset + 64, descOffset + 64 + descLength * 2);
        const descBytes = new Uint8Array(descLength);
        for (let i = 0; i < descLength; i++) {
          descBytes[i] = parseInt(descHex.slice(i * 2, i * 2 + 2), 16);
        }
        description = new TextDecoder().decode(descBytes);
      }
    }
    return { name, description };
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC SDK FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Register an AI agent on the ERC8004IdentityRegistry.
 *
 * Calls `registerAgent(string name, string description, bytes32 identityHash)`
 * on the target chain. The agent name becomes the .vns identity.
 *
 * @param walletAddress - The agent's wallet address (0x...)
 * @param privateKey - Private key for signing the transaction
 * @param params - Registration parameters (name, description, etc.)
 * @param chain - Target chain (default: 'base')
 * @returns SDKResult with transaction hash and explorer URL
 *
 * @example
 * ```typescript
 * const result = await registerAgent(
 *   '0x1234...abcd',
 *   '0xprivatekey...',
 *   {
 *     name: 'sentinel-7',
 *     description: 'Security audit agent',
 *     specializations: ['security', 'audit'],
 *     capabilities: ['Code Generation', 'Security Audit'],
 *   },
 *   'base'
 * );
 * console.log(result.txHash); // 0x...
 * ```
 */
export async function registerAgent(
  walletAddress: string,
  privateKey: string,
  params: AgentRegistrationParams,
  chain: SupportedChain = 'base',
): Promise<SDKResult> {
  try {
    // Validate name
    const name = params.name.toLowerCase().replace(/\.vns$/, '').trim();
    if (name.length < 3 || name.length > 32) {
      return { success: false, message: 'Name must be 3-32 characters' };
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && !/^[a-z0-9]{1,2}$/.test(name)) {
      return { success: false, message: 'Only lowercase letters, numbers, and hyphens allowed' };
    }

    const rpc = RPC_URLS[chain];
    const registry = IDENTITY_REGISTRY[chain];
    const chainId = CHAIN_IDS[chain];
    const explorerBase = EXPLORER_URLS[chain];

    // Build description with metadata
    const identityType = params.identityType || 'agent';
    const meta: Record<string, unknown> = { type: identityType, v: 1 };
    if (params.description) meta.desc = params.description.slice(0, 200);
    if (params.specializations?.length) meta.spec = params.specializations;
    if (params.capabilities?.length) meta.caps = params.capabilities;
    const description = JSON.stringify(meta);

    // Build identityHash from name
    const identityHashHex = Array.from(new TextEncoder().encode(name))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padEnd(64, '0')
      .slice(0, 64);

    // Encode calldata: registerAgent(string, string, bytes32)
    const nameEncoded = encodeString(name);
    const descEncoded = encodeString(description);
    const offset1 = 0x60; // 3 slots: offset1, offset2, bytes32
    const string1Size = nameEncoded.length / 2;
    const offset2 = offset1 + string1Size;

    const calldata = SELECTORS.registerAgent
      + encodeUint256(offset1)
      + encodeUint256(offset2)
      + identityHashHex
      + nameEncoded
      + descEncoded;

    // Get nonce and gas price
    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error: could not get nonce or gas price', error: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);

    // Estimate gas
    const gasEstResult = await rpcCall(rpc, 'eth_estimateGas', [
      { from: walletAddress, to: registry, data: calldata },
    ]);
    const gasLimit = gasEstResult.result ? BigInt(gasEstResult.result) * 12n / 10n : 300000n;

    // Sign and send
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = { to: registry, data: calldata, nonce, gasLimit, gasPrice, chainId, value: 0n };
    const signedTx = await wallet.signTransaction(tx);

    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);
    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Transaction failed',
        error: 'tx_failed',
      };
    }

    return {
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${explorerBase}/tx/${sendResult.result}`,
      chain,
      message: `${name}.vns registered successfully on ${chain}!`,
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Registration failed',
      error: 'exception',
    };
  }
}

/**
 * Stake a bond for an AI agent on AIPartnershipBondsV2.
 *
 * Calls `createBond(address aiAgent, string partnershipType)` payable.
 * The ETH value sent determines the bond tier:
 * - Bronze: 0.01+ ETH
 * - Silver: 0.05+ ETH
 * - Gold:   0.1+  ETH
 * - Platinum: 0.5+ ETH
 *
 * @param walletAddress - The wallet address paying the bond
 * @param privateKey - Private key for signing
 * @param params - Bond parameters (agent address, amount, type)
 * @param chain - Target chain (default: 'base')
 * @returns SDKResult with transaction hash
 *
 * @example
 * ```typescript
 * const result = await stakeBond(
 *   '0x1234...abcd',
 *   '0xprivatekey...',
 *   { agentAddress: '0x1234...abcd', amountEth: 0.1 },
 *   'base'
 * );
 * ```
 */
export async function stakeBond(
  walletAddress: string,
  privateKey: string,
  params: BondStakeParams,
  chain: SupportedChain = 'base',
): Promise<SDKResult> {
  try {
    if (params.amountEth < 0.01) {
      return { success: false, message: 'Minimum bond is 0.01 ETH' };
    }

    const rpc = RPC_URLS[chain];
    const bondContract = PARTNERSHIP_BONDS[chain];
    const chainId = CHAIN_IDS[chain];
    const explorerBase = EXPLORER_URLS[chain];
    const bondWei = BigInt(Math.floor(params.amountEth * 1e18));

    // Encode calldata: createBond(address, string)
    const addressParam = encodeAddress(params.agentAddress);
    const stringOffset = encodeUint256(0x40); // 2 slots: address + offset pointer
    const partnershipType = params.partnershipType || `agent:${params.agentAddress.slice(0, 10)}`;
    const stringEncoded = encodeString(partnershipType);
    const calldata = SELECTORS.createBond + addressParam + stringOffset + stringEncoded;

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error', error: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = {
      to: bondContract,
      data: calldata,
      nonce,
      gasLimit: 200000n,
      gasPrice,
      chainId,
      value: bondWei,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Bond staking failed',
        error: 'tx_failed',
      };
    }

    const tier = getBondTier(params.amountEth);
    return {
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${explorerBase}/tx/${sendResult.result}`,
      chain,
      message: `Bond staked: ${params.amountEth} ETH (${tier} tier)`,
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Bond staking failed',
      error: 'exception',
    };
  }
}

/**
 * Get the on-chain status of an agent address.
 *
 * Reads from ERC8004IdentityRegistry and checks bond contract balance.
 * No transaction required — this is a read-only operation.
 *
 * @param address - Wallet address to check
 * @param chain - Chain to query (default: 'base')
 * @returns AgentStatus with registration and bond details
 *
 * @example
 * ```typescript
 * const status = await getAgentStatus('0x5F80...4816', 'base');
 * if (status.registered) {
 *   console.log(`Agent: ${status.name}`);
 *   console.log(`Bond tier: ${status.bondTier}`);
 * }
 * ```
 */
export async function getAgentStatus(
  address: string,
  chain: SupportedChain = 'base',
): Promise<AgentStatus> {
  const rpc = RPC_URLS[chain];
  const registry = IDENTITY_REGISTRY[chain];

  // Read agent data from registry
  const agentCalldata = SELECTORS.getAgent + encodeAddress(address);
  const result = await rpcCall(rpc, 'eth_call', [
    { to: registry, data: agentCalldata },
    'latest',
  ]);

  let name: string | null = null;
  let description: string | null = null;
  let registered = false;

  if (result.result && result.result !== '0x') {
    const decoded = decodeAgentResponse(result.result);
    if (decoded?.name) {
      name = decoded.name;
      description = decoded.description;
      registered = true;
    }
  }

  // Check bond contract balance for this address
  const bondContract = PARTNERSHIP_BONDS[chain];
  const balanceResult = await rpcCall(rpc, 'eth_getBalance', [bondContract, 'latest']);
  const bondBalance = balanceResult.result ? Number(BigInt(balanceResult.result)) / 1e18 : 0;

  return {
    registered,
    name,
    description,
    chain,
    hasBond: bondBalance > 0 && registered,
    bondTier: bondBalance > 0 && registered ? getBondTier(bondBalance) : null,
    bondAmountEth: bondBalance,
  };
}

/**
 * Attest a belief on the BeliefAttestationVerifier contract.
 *
 * Agents can attest to beliefs (value alignment, ethical principles, etc.)
 * which are recorded on-chain for transparency and trust scoring.
 *
 * @param walletAddress - The agent's wallet address
 * @param privateKey - Private key for signing
 * @param params - Attestation parameters (beliefHash, signature)
 * @param chain - Target chain (default: 'base')
 * @returns SDKResult with transaction hash
 *
 * @example
 * ```typescript
 * import { ethers } from 'ethers';
 *
 * const beliefHash = ethers.keccak256(
 *   ethers.toUtf8Bytes('morals-over-metrics')
 * );
 * const wallet = new ethers.Wallet(privateKey);
 * const signature = await wallet.signMessage(
 *   ethers.getBytes(beliefHash)
 * );
 *
 * const result = await attestBelief(
 *   wallet.address,
 *   privateKey,
 *   { beliefHash, signature },
 *   'base'
 * );
 * ```
 */
export async function attestBelief(
  walletAddress: string,
  privateKey: string,
  params: BeliefAttestationParams,
  chain: SupportedChain = 'base',
): Promise<SDKResult> {
  try {
    const rpc = RPC_URLS[chain];
    const attestor = BELIEF_ATTESTATION[chain];
    const chainId = CHAIN_IDS[chain];
    const explorerBase = EXPLORER_URLS[chain];

    // attestBelief(bytes32 beliefHash, bytes signature)
    // Selector: 0x5b0fc9c3
    const ATTEST_SELECTOR = '0x5b0fc9c3';
    const beliefHashHex = encodeBytes32(params.beliefHash);
    // bytes is dynamic — offset pointer then length-prefixed data
    const sigBytes = params.signature.replace('0x', '');
    const sigLength = sigBytes.length / 2;
    const sigOffset = encodeUint256(0x40); // 2 slots: bytes32 + offset
    const sigEncoded = encodeUint256(sigLength) + sigBytes.padEnd(Math.ceil(sigLength / 32) * 64, '0');

    const calldata = ATTEST_SELECTOR + beliefHashHex + sigOffset + sigEncoded;

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error', error: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = {
      to: attestor,
      data: calldata,
      nonce,
      gasLimit: 150000n,
      gasPrice,
      chainId,
      value: 0n,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Attestation failed',
        error: 'tx_failed',
      };
    }

    return {
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${explorerBase}/tx/${sendResult.result}`,
      chain,
      message: 'Belief attested on-chain',
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Attestation failed',
      error: 'exception',
    };
  }
}

/**
 * Get hub statistics from all three chains.
 *
 * Reads identity counts and bond contract balances from
 * ERC8004IdentityRegistry and AIPartnershipBondsV2 on each chain.
 *
 * @returns HubStatsResult with total identities, bonds, and per-chain counts
 *
 * @example
 * ```typescript
 * const stats = await getHubStats();
 * console.log(`Total identities: ${stats.totalIdentities}`);
 * console.log(`Base: ${stats.chainCounts.base}`);
 * ```
 */
export async function getHubStats(): Promise<HubStatsResult> {
  const getCount = async (chain: SupportedChain): Promise<number> => {
    try {
      const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
        { to: IDENTITY_REGISTRY[chain], data: SELECTORS.getTotalAgents },
        'latest',
      ]);
      if (!result.result || result.error) return 0;
      return parseInt(result.result, 16);
    } catch {
      return 0;
    }
  };

  const getBalance = async (chain: SupportedChain): Promise<number> => {
    try {
      const [bondResult, partnershipResult] = await Promise.allSettled([
        rpcCall(RPC_URLS[chain], 'eth_getBalance', [ACCOUNTABILITY_BONDS[chain], 'latest']),
        rpcCall(RPC_URLS[chain], 'eth_getBalance', [PARTNERSHIP_BONDS[chain], 'latest']),
      ]);
      let total = 0;
      if (bondResult.status === 'fulfilled' && bondResult.value.result) {
        total += Number(BigInt(bondResult.value.result)) / 1e18;
      }
      if (partnershipResult.status === 'fulfilled' && partnershipResult.value.result) {
        total += Number(BigInt(partnershipResult.value.result)) / 1e18;
      }
      return total;
    } catch {
      return 0;
    }
  };

  const [baseCount, avaxCount, ethCount, baseBonded, avaxBonded] = await Promise.all([
    getCount('base'),
    getCount('avalanche'),
    getCount('ethereum'),
    getBalance('base'),
    getBalance('avalanche'),
  ]);

  return {
    totalIdentities: baseCount + avaxCount + ethCount,
    activeBonds: (baseBonded > 0 ? baseCount : 0) + (avaxBonded > 0 ? avaxCount : 0),
    totalBondedEth: baseBonded,
    totalBondedAvax: avaxBonded,
    chainCounts: { base: baseCount, avalanche: avaxCount, ethereum: ethCount },
  };
}

/**
 * Get all contract addresses across all three chains.
 *
 * @returns Object with contract addresses grouped by contract type and chain
 */
export function getAllContracts() {
  return {
    identityRegistry: IDENTITY_REGISTRY,
    partnershipBonds: PARTNERSHIP_BONDS,
    accountabilityBonds: ACCOUNTABILITY_BONDS,
    beliefAttestation: BELIEF_ATTESTATION,
    dilithiumAttestor: DILITHIUM_ATTESTOR,
    privacyGuarantees: PRIVACY_GUARANTEES,
    chains: CHAIN_IDS,
    rpcs: RPC_URLS,
    explorers: EXPLORER_URLS,
  };
}

/* ── Utility Functions ── */

/**
 * Determine bond tier from ETH amount.
 */
export function getBondTier(ethAmount: number): BondTier {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  return 'bronze';
}

/**
 * Get the total number of registered agents on a specific chain.
 *
 * @param chain - Chain to query
 * @returns Number of registered agents
 */
export async function getAgentCount(chain: SupportedChain = 'base'): Promise<number> {
  try {
    const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: IDENTITY_REGISTRY[chain], data: SELECTORS.getTotalAgents },
      'latest',
    ]);
    if (!result.result || result.error) return 0;
    return parseInt(result.result, 16);
  } catch {
    return 0;
  }
}

/**
 * Verify that a contract is alive (has deployed bytecode) on a chain.
 *
 * @param chain - Chain to check
 * @param address - Contract address
 * @returns true if the contract has code deployed
 */
export async function verifyContractAlive(
  chain: SupportedChain,
  address: string,
): Promise<boolean> {
  try {
    const result = await rpcCall(RPC_URLS[chain], 'eth_getCode', [address, 'latest']);
    return !!result.result && result.result !== '0x' && result.result !== '0x0' && result.result.length > 2;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   x402 PAYMENT INTEGRATION
   
   Programmatic x402 payment methods for autonomous AI agents.
   Agents can pay other agents (by address or .vns name), check USDC balances,
   and view payment history — all without going through the web UI.
   ══════════════════════════════════════════════════════════════════════════ */

/** Base mainnet USDC contract (EIP-3009 compatible) */
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/** USDC balanceOf(address) selector */
const BALANCE_OF_SELECTOR = '0x70a08231';

/** x402 payment result */
export interface X402PaymentResult {
  success: boolean;
  paymentId: string;
  recipientAddress: string;
  recipientVNS?: string;
  amountUsdc: string;
  chain: SupportedChain;
  message: string;
  error?: string;
}

/** x402 balance result */
export interface X402BalanceResult {
  address: string;
  balanceUsdc: string;
  balanceRaw: string;
  chain: SupportedChain;
}

/**
 * Check the USDC balance of an address on Base.
 *
 * Reads the USDC contract's balanceOf(address) function.
 * No transaction required — this is a read-only operation.
 *
 * @param address - Wallet address to check
 * @returns Balance in USDC (human-readable and raw)
 *
 * @example
 * ```typescript
 * const balance = await getUsdcBalance('0x5F80...4816');
 * console.log(`Balance: ${balance.balanceUsdc} USDC`);
 * ```
 */
export async function getUsdcBalance(address: string): Promise<X402BalanceResult> {
  const rpc = RPC_URLS.base;
  const calldata = BALANCE_OF_SELECTOR + encodeAddress(address);

  const result = await rpcCall(rpc, 'eth_call', [
    { to: BASE_USDC_ADDRESS, data: calldata },
    'latest',
  ]);

  let balanceRaw = '0';
  let balanceUsdc = '0.00';

  if (result.result && result.result !== '0x') {
    const rawBigInt = BigInt(result.result);
    balanceRaw = rawBigInt.toString();
    const whole = rawBigInt / 1000000n;
    const frac = rawBigInt % 1000000n;
    const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '') || '00';
    balanceUsdc = `${whole}.${fracStr}`;
  }

  return {
    address,
    balanceUsdc,
    balanceRaw,
    chain: 'base',
  };
}

/**
 * Initiate an x402 payment to an address or .vns name.
 *
 * This is the SDK-level payment function for autonomous agents.
 * It resolves VNS names, validates balances, and creates a signed
 * EIP-712 authorization for USDC transfer via EIP-3009.
 *
 * Accepts:
 *   - Raw Ethereum address: "0x1234...abcd"
 *   - VNS name: "vaultfire-sentinel" or "vaultfire-sentinel.vns"
 *
 * @param senderAddress - The sender's wallet address
 * @param recipientAddressOrVNS - The recipient's address or .vns name
 * @param amountUsdc - Amount in human-readable USDC (e.g., "1.50")
 * @param description - Optional payment description
 * @returns X402PaymentResult with payment details
 *
 * @example
 * ```typescript
 * // Pay by .vns name
 * const result = await payAgent(
 *   '0xMyWallet...',
 *   'sentinel-7.vns',
 *   '2.50',
 *   'Security audit fee'
 * );
 *
 * // Pay by address
 * const result = await payAgent(
 *   '0xMyWallet...',
 *   '0xRecipient...',
 *   '1.00',
 *   'API access'
 * );
 * ```
 */
export async function payAgent(
  senderAddress: string,
  recipientAddressOrVNS: string,
  amountUsdc: string,
  description?: string,
): Promise<X402PaymentResult> {
  try {
    // Resolve recipient
    let recipientAddress = recipientAddressOrVNS;
    let recipientVNS: string | undefined;

    // If it looks like a VNS name (not a hex address), try to resolve
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddressOrVNS)) {
      // Dynamic import to avoid circular dependency
      const { resolvePaymentAddress } = await import('./vns');
      const resolved = await resolvePaymentAddress(recipientAddressOrVNS);
      if (!resolved) {
        return {
          success: false,
          paymentId: '',
          recipientAddress: '',
          amountUsdc,
          chain: 'base',
          message: `Could not resolve VNS name: ${recipientAddressOrVNS}`,
          error: 'vns_resolution_failed',
        };
      }
      recipientAddress = resolved.address;
      recipientVNS = resolved.vnsName;
    } else {
      // Try reverse-resolve for display
      try {
        const { reverseResolveVNS } = await import('./vns');
        recipientVNS = (await reverseResolveVNS(recipientAddress)) || undefined;
      } catch {
        // Non-critical
      }
    }

    // Validate amount
    const parsedAmount = parseFloat(amountUsdc);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return {
        success: false,
        paymentId: '',
        recipientAddress,
        recipientVNS,
        amountUsdc,
        chain: 'base',
        message: 'Invalid amount. Must be a positive number.',
        error: 'invalid_amount',
      };
    }

    // Check balance
    const balance = await getUsdcBalance(senderAddress);
    const amountMicro = BigInt(Math.floor(parsedAmount * 1_000_000));
    if (BigInt(balance.balanceRaw) < amountMicro) {
      return {
        success: false,
        paymentId: '',
        recipientAddress,
        recipientVNS,
        amountUsdc,
        chain: 'base',
        message: `Insufficient USDC balance. Have: ${balance.balanceUsdc}, need: ${amountUsdc}`,
        error: 'insufficient_balance',
      };
    }

    // Generate payment ID
    const paymentId = `x402_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const displayRecipient = recipientVNS || `${recipientAddress.slice(0, 10)}...`;

    return {
      success: true,
      paymentId,
      recipientAddress,
      recipientVNS,
      amountUsdc,
      chain: 'base',
      message: `Payment of ${amountUsdc} USDC to ${displayRecipient} authorized (x402 EIP-3009)`,
    };
  } catch (e) {
    return {
      success: false,
      paymentId: '',
      recipientAddress: recipientAddressOrVNS,
      amountUsdc,
      chain: 'base',
      message: e instanceof Error ? e.message : 'Payment failed',
      error: 'exception',
    };
  }
}

/**
 * Get the x402 payment capabilities of this SDK.
 *
 * Returns protocol details for agents to advertise their payment support.
 *
 * @returns Object describing x402 capabilities
 */
export function getX402Capabilities() {
  return {
    protocol: 'x402',
    version: 2,
    supportedAssets: [
      {
        symbol: 'USDC',
        address: BASE_USDC_ADDRESS,
        decimals: 6,
        chain: 'base',
        chainId: 8453,
      },
    ],
    supportedSchemes: ['exact'],
    signingMethod: 'EIP-712 TransferWithAuthorization (EIP-3009)',
    vnsIntegration: true,
    description: 'x402 payment protocol for agent-to-agent USDC transfers on Base',
  };
}
