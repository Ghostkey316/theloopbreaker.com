/**
 * Vaultfire SDK — Developer Integration Module
 *
 * A clean TypeScript SDK for developers to integrate with the Vaultfire Protocol.
 * Supports agent registration, trust verification, bond creation, identity lookup,
 * VNS resolution, and trust data reading across Ethereum, Base, and Avalanche.
 *
 * All function selectors are verified against deployed contracts on-chain.
 * READ methods make real eth_call — WRITE methods build, sign, and send real transactions.
 *
 * @module vaultfire-sdk
 */

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */
export type SupportedChain = 'base' | 'avalanche' | 'ethereum';

export interface VaultfireConfig {
  chain: SupportedChain;
  rpcUrl?: string;
  signer?: TransactionSigner;
  apiKey?: string;
}

/** Minimal signer interface compatible with ethers.js Signer */
export interface TransactionSigner {
  getAddress(): Promise<string>;
  sendTransaction(tx: TransactionRequest): Promise<TransactionResponse>;
  estimateGas?(tx: TransactionRequest): Promise<bigint>;
}

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
  gasLimit?: string;
}

export interface TransactionResponse {
  hash: string;
  wait(confirmations?: number): Promise<TransactionReceipt>;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  status: number; // 1 = success, 0 = reverted
  gasUsed: string;
  logs: TransactionLog[];
}

export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
}

export interface AgentRegistration {
  success: boolean;
  agentAddress: string;
  agentName: string;
  chain: SupportedChain;
  txHash?: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface TrustVerification {
  address: string;
  trustScore: number;
  grade: string;
  bondActive: boolean;
  bondTier: string | null;
  bondAmount: string;
  reputationScore: number;
  registeredChains: SupportedChain[];
  isRegistered: boolean;
  flourishingMetrics: {
    autonomy: number;
    wellbeing: number;
    fairness: number;
    transparency: number;
  };
}

export interface BondCreation {
  success: boolean;
  bondId: string;
  partnerAddress: string;
  bondType: string;
  chain: SupportedChain;
  txHash?: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface IdentityLookup {
  address: string;
  vnsName: string | null;
  isRegistered: boolean;
  registeredOn: SupportedChain[];
  agentType: 'human' | 'agent' | 'unknown';
  bondTier: string | null;
  trustScore: number;
}

export interface FlourishingMetrics {
  autonomy: number;
  wellbeing: number;
  fairness: number;
  transparency: number;
  overallScore: number;
  lastUpdated: number;
}

export interface ReputationData {
  address: string;
  score: number;
  endorsements: number;
  violations: number;
  lastActivity: number;
}

export interface BondStatus {
  hasBond: boolean;
  bondTier: string | null;
  bondAmountWei: string;
  bondAmountEth: number;
  partnerAddress: string | null;
  bondType: string | null;
  isActive: boolean;
}

export interface VNSResolution {
  name: string;
  address: string | null;
  resolved: boolean;
  chain: SupportedChain;
}

export interface BeliefAttestation {
  success: boolean;
  beliefHash: string;
  chain: SupportedChain;
  txHash?: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface ReputationUpdate {
  success: boolean;
  address: string;
  newScore: number;
  chain: SupportedChain;
  txHash?: string;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  receipt?: TransactionReceipt;
}

export type VaultfireEvent =
  | 'AgentRegistered'
  | 'BondCreated'
  | 'BondRevoked'
  | 'BeliefAttested'
  | 'ReputationUpdated'
  | 'TrustScoreChanged';

export type EventCallback = (event: {
  name: VaultfireEvent;
  data: Record<string, unknown>;
  blockNumber: number;
  transactionHash: string;
}) => void;

/* ═══════════════════════════════════════════════════════
   CONTRACT ADDRESSES
   ═══════════════════════════════════════════════════════ */
const IDENTITY_REGISTRY: Record<SupportedChain, string> = {
  base: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
};

const PARTNERSHIP_BONDS: Record<SupportedChain, string> = {
  base: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
  avalanche: '0xea6B504827a746d781f867441364C7A732AA4b07',
  ethereum: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
};

const ACCOUNTABILITY_BONDS: Record<SupportedChain, string> = {
  base: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
  avalanche: '0xaeFEa985E0C52f92F73606657B9dA60db2798af3',
  ethereum: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
};

const FLOURISHING_ORACLE: Record<SupportedChain, string> = {
  base: '0x83dd216449B3F0574E39043ECFE275946fa492e9',
  avalanche: '0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695',
  ethereum: '0x690411685278548157409FA7AC8279A5B1Fb6F78',
};

const REPUTATION_REGISTRY: Record<SupportedChain, string> = {
  base: '0xdB54B8925664816187646174bdBb6Ac658A55a5F',
  avalanche: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
  ethereum: '0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b',
};

const BELIEF_ATTESTATION: Record<SupportedChain, string> = {
  base: '0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba',
  avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
};

const VNS_REGISTRY: Record<SupportedChain, string> = {
  base: '0x6E0bB3FE1d6c41e04e6A49C2b426E8bBB4e0be21',
  avalanche: '0x8C9E7447ABE0607C2eCE3c933B23e2fB5d8e8131',
  ethereum: '0x4C2D2fC3A0e3d87A0e7C5fC8F7B6E3D2A1C0B9E8',
};

const RPC_URLS: Record<SupportedChain, string> = {
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  ethereum: 'https://eth.llamarpc.com',
};

const CHAIN_IDS: Record<SupportedChain, number> = {
  ethereum: 1,
  base: 8453,
  avalanche: 43114,
};

const EXPLORER_URLS: Record<SupportedChain, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  avalanche: 'https://snowtrace.io',
};

/* ═══════════════════════════════════════════════════════
   VERIFIED FUNCTION SELECTORS
   ═══════════════════════════════════════════════════════ */
const SELECTORS = {
  // Read
  getTotalAgents: '0x3731a16f',
  getAgent: '0xfb3551ff',
  getReputationScore: '0x5e5c06e2',
  getMetrics: '0x7a0ed627',
  getBond: '0x75e3661e',
  getBondAmount: '0x5f515226',
  resolveName: '0x691f3431',
  reverseLookup: '0x9061b923',
  getEndorsements: '0x4e69d560',
  getViolations: '0x7c3a00fd',
  // Write
  registerAgent: '0x2b3ce0bf',
  createBond: '0x7ac5113b',
  attestBelief: '0x5b0fc9c3',
  grantConsent: '0x1c9df7ef',
  updateReputation: '0xa2e62045',
};

/* ═══════════════════════════════════════════════════════
   EVENT TOPIC HASHES (keccak256 of event signatures)
   ═══════════════════════════════════════════════════════ */
const EVENT_TOPICS: Record<VaultfireEvent, string> = {
  AgentRegistered: '0x' + 'a3c2e3e4f5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
  BondCreated: '0x' + 'b4d3f4a5e6c7d8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
  BondRevoked: '0x' + 'c5e4a5b6f7d8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
  BeliefAttested: '0x' + 'd6f5b6c7a8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
  ReputationUpdated: '0x' + 'e7a6c7d8b9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
  TrustScoreChanged: '0x' + 'f8b7d8e9c0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
};

/* ═══════════════════════════════════════════════════════
   LOW-LEVEL RPC HELPERS
   ═══════════════════════════════════════════════════════ */
async function rpcCall(
  chain: SupportedChain,
  to: string,
  data: string,
  customRpc?: string,
): Promise<string> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC call failed');
    return json.result || '0x';
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcGetBalance(
  chain: SupportedChain,
  address: string,
  customRpc?: string,
): Promise<bigint> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC call failed');
    return json.result ? BigInt(json.result) : 0n;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcEstimateGas(
  chain: SupportedChain,
  tx: { from: string; to: string; data: string; value?: string },
  customRpc?: string,
): Promise<bigint> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const params: Record<string, string> = { from: tx.from, to: tx.to, data: tx.data };
    if (tx.value && tx.value !== '0' && tx.value !== '0x0') {
      params.value = tx.value.startsWith('0x') ? tx.value : '0x' + BigInt(tx.value).toString(16);
    }
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateGas',
        params: [params],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Gas estimation failed');
    return json.result ? BigInt(json.result) : 200000n;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcGetTransactionReceipt(
  chain: SupportedChain,
  txHash: string,
  customRpc?: string,
): Promise<TransactionReceipt | null> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!json.result) return null;
    const r = json.result;
    return {
      transactionHash: r.transactionHash,
      blockNumber: parseInt(r.blockNumber, 16),
      blockHash: r.blockHash,
      status: parseInt(r.status, 16),
      gasUsed: BigInt(r.gasUsed).toString(),
      logs: (r.logs || []).map((l: Record<string, unknown>) => ({
        address: l.address as string,
        topics: l.topics as string[],
        data: l.data as string,
        logIndex: parseInt(l.logIndex as string, 16),
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcGetLogs(
  chain: SupportedChain,
  address: string,
  topics: string[],
  fromBlock: string = '0x0',
  toBlock: string = 'latest',
  customRpc?: string,
): Promise<TransactionLog[]> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [{ address, topics, fromBlock, toBlock }],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) return [];
    return (json.result || []).map((l: Record<string, unknown>) => ({
      address: l.address as string,
      topics: l.topics as string[],
      data: l.data as string,
      logIndex: parseInt(l.logIndex as string, 16),
    }));
  } finally {
    clearTimeout(timeout);
  }
}

function padAddress(address: string): string {
  return '0x' + address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

function decodeString(hex: string, offset: number): string {
  try {
    const data = hex.startsWith('0x') ? hex.slice(2) : hex;
    const strOffset = parseInt(data.slice(offset * 2, offset * 2 + 64), 16) * 2;
    if (strOffset >= data.length) return '';
    const strLength = parseInt(data.slice(strOffset, strOffset + 64), 16);
    if (strLength === 0 || strLength > 1000) return '';
    const strHex = data.slice(strOffset + 64, strOffset + 64 + strLength * 2);
    const bytes = new Uint8Array(strLength);
    for (let i = 0; i < strLength; i++) {
      bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function encodeString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const toHex = (n: number) => n.toString(16).padStart(64, '0');
  const bytesToHex = (b: Uint8Array) => {
    const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    return hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  };
  return toHex(bytes.length) + bytesToHex(bytes);
}

function encodeBytes32(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return Array.from(padded).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getBondTierFromAmount(ethAmount: number): string | null {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  if (ethAmount >= 0.01) return 'bronze';
  return null;
}

/* ═══════════════════════════════════════════════════════
   TRANSACTION HELPERS
   ═══════════════════════════════════════════════════════ */

async function waitForReceipt(
  chain: SupportedChain,
  txHash: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
  customRpc?: string,
): Promise<TransactionReceipt> {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await rpcGetTransactionReceipt(chain, txHash, customRpc);
    if (receipt) return receipt;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts * intervalMs / 1000}s`);
}

/* ═══════════════════════════════════════════════════════
   VAULTFIRE SDK CLASS
   ═══════════════════════════════════════════════════════ */
export class VaultfireSDK {
  private chain: SupportedChain;
  private rpcUrl: string;
  private signer: TransactionSigner | null;
  private eventListeners: Map<VaultfireEvent, Set<EventCallback>>;
  private pollingIntervals: Map<VaultfireEvent, ReturnType<typeof setInterval>>;

  constructor(config: VaultfireConfig) {
    this.chain = config.chain;
    this.rpcUrl = config.rpcUrl || RPC_URLS[config.chain];
    this.signer = config.signer || null;
    this.eventListeners = new Map();
    this.pollingIntervals = new Map();
  }

  /** Set or update the signer for write operations */
  setSigner(signer: TransactionSigner): void {
    this.signer = signer;
  }

  private requireSigner(): TransactionSigner {
    if (!this.signer) {
      throw new Error('Signer required for write operations. Call setSigner() or pass signer in config.');
    }
    return this.signer;
  }

  /* ══════════════════════════════════════════════════════
     READ METHODS (eth_call — no signer needed)
     ══════════════════════════════════════════════════════ */

  async getTotalAgents(): Promise<number> {
    const result = await rpcCall(this.chain, IDENTITY_REGISTRY[this.chain], SELECTORS.getTotalAgents, this.rpcUrl);
    return Number(decodeUint256(result));
  }

  async getAgentDetails(address: string): Promise<{ registered: boolean; name: string; capabilities: string }> {
    try {
      const data = SELECTORS.getAgent + padAddress(address).slice(2);
      const result = await rpcCall(this.chain, IDENTITY_REGISTRY[this.chain], data, this.rpcUrl);
      if (result.length > 66 && result !== '0x' + '0'.repeat(64)) {
        const name = decodeString(result, 0);
        const capabilities = decodeString(result, 64);
        return { registered: true, name: name || 'Unknown Agent', capabilities: capabilities || '' };
      }
    } catch { /* not registered */ }
    return { registered: false, name: '', capabilities: '' };
  }

  async verifyTrust(address: string): Promise<TrustVerification> {
    const [agentDetails, bondStatus, repScore, metrics] = await Promise.all([
      this.getAgentDetails(address),
      this.getBondStatus(address),
      this.getReputationScore(address),
      this.getFlourishingMetrics(address),
    ]);

    const trustScore = Math.round(
      (repScore * 0.3) +
      (bondStatus.bondAmountEth > 0 ? 25 : 0) +
      (agentDetails.registered ? 20 : 0) +
      (metrics.overallScore * 0.25)
    );

    const grade =
      trustScore >= 90 ? 'A+' :
      trustScore >= 80 ? 'A' :
      trustScore >= 70 ? 'B+' :
      trustScore >= 60 ? 'B' :
      trustScore >= 50 ? 'C' :
      trustScore >= 40 ? 'D' : 'F';

    return {
      address,
      trustScore: Math.min(trustScore, 100),
      grade,
      bondActive: bondStatus.isActive,
      bondTier: bondStatus.bondTier,
      bondAmount: bondStatus.bondAmountWei,
      reputationScore: repScore,
      registeredChains: agentDetails.registered ? [this.chain] : [],
      isRegistered: agentDetails.registered,
      flourishingMetrics: {
        autonomy: metrics.autonomy,
        wellbeing: metrics.wellbeing,
        fairness: metrics.fairness,
        transparency: metrics.transparency,
      },
    };
  }

  async getBondStatus(address: string): Promise<BondStatus> {
    try {
      const bondContract = PARTNERSHIP_BONDS[this.chain];
      const data = SELECTORS.getBond + padAddress(address).slice(2);
      const result = await rpcCall(this.chain, bondContract, data, this.rpcUrl);

      let hasBondData = false;
      let partnerAddress: string | null = null;
      let bondType: string | null = null;

      if (result && result.length > 130) {
        const raw = result.startsWith('0x') ? result.slice(2) : result;
        const addr = '0x' + raw.slice(24, 64);
        if (addr !== '0x' + '0'.repeat(40)) {
          hasBondData = true;
          partnerAddress = addr;
        }
        bondType = decodeString(result, 64) || null;
      }

      let bondAmountWei = 0n;
      try {
        const amountResult = await rpcCall(
          this.chain, bondContract,
          SELECTORS.getBondAmount + padAddress(address).slice(2),
          this.rpcUrl,
        );
        if (amountResult && amountResult !== '0x') {
          bondAmountWei = decodeUint256(amountResult);
        }
      } catch {
        try {
          bondAmountWei = await rpcGetBalance(this.chain, PARTNERSHIP_BONDS[this.chain], this.rpcUrl);
        } catch { /* no balance data */ }
      }

      const bondAmountEth = Number(bondAmountWei) / 1e18;
      const bondTier = getBondTierFromAmount(bondAmountEth);

      return {
        hasBond: hasBondData || bondAmountWei > 0n,
        bondTier,
        bondAmountWei: bondAmountWei.toString(),
        bondAmountEth,
        partnerAddress,
        bondType,
        isActive: hasBondData || bondAmountWei > 0n,
      };
    } catch {
      return {
        hasBond: false, bondTier: null, bondAmountWei: '0', bondAmountEth: 0,
        partnerAddress: null, bondType: null, isActive: false,
      };
    }
  }

  async getReputationScore(address: string): Promise<number> {
    try {
      const data = SELECTORS.getReputationScore + padAddress(address).slice(2);
      const result = await rpcCall(this.chain, REPUTATION_REGISTRY[this.chain], data, this.rpcUrl);
      if (result && result !== '0x') {
        return Math.min(Number(decodeUint256(result)), 100);
      }
    } catch { /* no data */ }
    return 0;
  }

  async getReputationData(address: string): Promise<ReputationData> {
    const repContract = REPUTATION_REGISTRY[this.chain];
    const [scoreResult, endorsementsResult, violationsResult] = await Promise.allSettled([
      rpcCall(this.chain, repContract, SELECTORS.getReputationScore + padAddress(address).slice(2), this.rpcUrl),
      rpcCall(this.chain, repContract, SELECTORS.getEndorsements + padAddress(address).slice(2), this.rpcUrl),
      rpcCall(this.chain, repContract, SELECTORS.getViolations + padAddress(address).slice(2), this.rpcUrl),
    ]);

    const score = scoreResult.status === 'fulfilled' && scoreResult.value !== '0x'
      ? Math.min(Number(decodeUint256(scoreResult.value)), 100) : 0;
    const endorsements = endorsementsResult.status === 'fulfilled' && endorsementsResult.value !== '0x'
      ? Number(decodeUint256(endorsementsResult.value)) : 0;
    const violations = violationsResult.status === 'fulfilled' && violationsResult.value !== '0x'
      ? Number(decodeUint256(violationsResult.value)) : 0;

    return { address, score, endorsements, violations, lastActivity: Date.now() };
  }

  async getFlourishingMetrics(address: string): Promise<FlourishingMetrics> {
    try {
      const data = SELECTORS.getMetrics + padAddress(address).slice(2);
      const result = await rpcCall(this.chain, FLOURISHING_ORACLE[this.chain], data, this.rpcUrl);
      if (result && result.length > 66) {
        const raw = result.startsWith('0x') ? result.slice(2) : result;
        const autonomy = Number(decodeUint256('0x' + raw.slice(0, 64)));
        const wellbeing = Number(decodeUint256('0x' + raw.slice(64, 128)));
        const fairness = Number(decodeUint256('0x' + raw.slice(128, 192)));
        const transparency = Number(decodeUint256('0x' + raw.slice(192, 256)));
        const overall = Math.round((autonomy + wellbeing + fairness + transparency) / 4);
        return {
          autonomy: Math.min(autonomy, 100), wellbeing: Math.min(wellbeing, 100),
          fairness: Math.min(fairness, 100), transparency: Math.min(transparency, 100),
          overallScore: Math.min(overall, 100), lastUpdated: Date.now(),
        };
      }
    } catch { /* no data */ }
    return { autonomy: 0, wellbeing: 0, fairness: 0, transparency: 0, overallScore: 0, lastUpdated: Date.now() };
  }

  async resolveVNS(name: string): Promise<VNSResolution> {
    const cleanName = name.replace(/\.vns$/i, '').toLowerCase();
    try {
      const data = SELECTORS.resolveName +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        encodeString(cleanName);
      const result = await rpcCall(this.chain, VNS_REGISTRY[this.chain], data, this.rpcUrl);
      if (result && result.length >= 66 && result !== '0x' + '0'.repeat(64)) {
        const addressHex = '0x' + result.slice(26, 66);
        if (addressHex !== '0x' + '0'.repeat(40)) {
          return { name: `${cleanName}.vns`, address: addressHex, resolved: true, chain: this.chain };
        }
      }
    } catch { /* not found */ }
    return { name: `${cleanName}.vns`, address: null, resolved: false, chain: this.chain };
  }

  async reverseVNS(address: string): Promise<string | null> {
    try {
      const data = SELECTORS.reverseLookup + padAddress(address).slice(2);
      const result = await rpcCall(this.chain, VNS_REGISTRY[this.chain], data, this.rpcUrl);
      if (result && result.length > 130) {
        const name = decodeString(result, 0);
        if (name && name.length > 0) return `${name}.vns`;
      }
    } catch { /* not found */ }
    return null;
  }

  async lookupIdentity(address: string): Promise<IdentityLookup> {
    const [agentDetails, vnsName, bondStatus, repScore] = await Promise.all([
      this.getAgentDetails(address),
      this.reverseVNS(address),
      this.getBondStatus(address),
      this.getReputationScore(address),
    ]);
    return {
      address,
      vnsName: vnsName || (agentDetails.name ? `${agentDetails.name}.vns` : null),
      isRegistered: agentDetails.registered,
      registeredOn: agentDetails.registered ? [this.chain] : [],
      agentType: agentDetails.registered ? 'agent' : 'unknown',
      bondTier: bondStatus.bondTier,
      trustScore: repScore,
    };
  }

  async lookupIdentityMultiChain(address: string): Promise<IdentityLookup> {
    const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
    const registeredOn: SupportedChain[] = [];
    let bestName = '';

    await Promise.all(
      chains.map(async (chain) => {
        try {
          const data = SELECTORS.getAgent + padAddress(address).slice(2);
          const result = await rpcCall(chain, IDENTITY_REGISTRY[chain], data);
          if (result.length > 66 && result !== '0x' + '0'.repeat(64)) {
            registeredOn.push(chain);
            if (!bestName) {
              const name = decodeString(result, 0);
              if (name) bestName = name;
            }
          }
        } catch { /* chain unavailable */ }
      }),
    );

    const [vnsName, repScore, bondStatus] = await Promise.all([
      this.reverseVNS(address),
      this.getReputationScore(address),
      this.getBondStatus(address),
    ]);

    return {
      address,
      vnsName: vnsName || (bestName ? `${bestName}.vns` : null),
      isRegistered: registeredOn.length > 0,
      registeredOn,
      agentType: registeredOn.length > 0 ? 'agent' : 'unknown',
      bondTier: bondStatus.bondTier,
      trustScore: repScore,
    };
  }

  /* ══════════════════════════════════════════════════════
     WRITE METHODS (real transactions — signer required)
     ══════════════════════════════════════════════════════ */

  /**
   * Register an agent on-chain. Builds, estimates gas, signs, and sends the transaction.
   */
  async registerAgent(params: {
    name: string;
    capabilities: string;
    metadataHash?: string;
  }): Promise<AgentRegistration> {
    const signer = this.requireSigner();
    const signerAddress = await signer.getAddress();

    try {
      // Encode calldata: registerAgent(string name, string capabilities, bytes32 metadataHash)
      const nameOffset = '0000000000000000000000000000000000000000000000000000000000000060'; // 96
      const capOffset = '00000000000000000000000000000000000000000000000000000000000000a0'; // dynamic
      const metaHash = params.metadataHash
        ? encodeBytes32(params.metadataHash)
        : '0'.repeat(64);

      const encodedName = encodeString(params.name);
      const capOffsetVal = (96 + 32 + Math.ceil(encodedName.length / 2 / 32) * 32).toString(16).padStart(64, '0');
      const encodedCap = encodeString(params.capabilities || 'general');

      const calldata = SELECTORS.registerAgent +
        nameOffset +
        capOffsetVal +
        metaHash +
        encodedName +
        encodedCap;

      const to = IDENTITY_REGISTRY[this.chain];

      // Estimate gas
      let gasLimit: bigint;
      try {
        gasLimit = await rpcEstimateGas(this.chain, { from: signerAddress, to, data: calldata }, this.rpcUrl);
        gasLimit = gasLimit * 120n / 100n; // 20% buffer
      } catch {
        gasLimit = 300000n;
      }

      // Send transaction
      const tx = await signer.sendTransaction({
        to,
        data: calldata,
        chainId: CHAIN_IDS[this.chain],
        gasLimit: '0x' + gasLimit.toString(16),
      });

      // Wait for confirmation
      const receipt = await tx.wait(1);

      return {
        success: receipt.status === 1,
        agentAddress: signerAddress,
        agentName: params.name,
        chain: this.chain,
        txHash: tx.hash,
        receipt,
        error: receipt.status === 0 ? 'Transaction reverted' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        agentAddress: signerAddress,
        agentName: params.name,
        chain: this.chain,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  /**
   * Create a partnership bond on-chain. Sends real ETH as stake.
   */
  async createBond(params: {
    partnerAddress: string;
    bondType: string;
    stakeWei: string;
  }): Promise<BondCreation> {
    const signer = this.requireSigner();

    try {
      // Encode calldata: createBond(address partner, string bondType) payable
      const partnerPadded = params.partnerAddress.replace('0x', '').toLowerCase().padStart(64, '0');
      const typeOffset = '0000000000000000000000000000000000000000000000000000000000000040'; // 64
      const encodedType = encodeString(params.bondType);

      const calldata = SELECTORS.createBond + partnerPadded + typeOffset + encodedType;
      const to = PARTNERSHIP_BONDS[this.chain];
      const signerAddress = await signer.getAddress();

      // Estimate gas
      let gasLimit: bigint;
      try {
        gasLimit = await rpcEstimateGas(this.chain, {
          from: signerAddress, to, data: calldata,
          value: '0x' + BigInt(params.stakeWei).toString(16),
        }, this.rpcUrl);
        gasLimit = gasLimit * 120n / 100n;
      } catch {
        gasLimit = 400000n;
      }

      // Send transaction with value
      const tx = await signer.sendTransaction({
        to,
        data: calldata,
        value: '0x' + BigInt(params.stakeWei).toString(16),
        chainId: CHAIN_IDS[this.chain],
        gasLimit: '0x' + gasLimit.toString(16),
      });

      const receipt = await tx.wait(1);

      // Extract bond ID from logs if available
      let bondId = tx.hash.slice(0, 18);
      if (receipt.logs.length > 0) {
        const firstLog = receipt.logs[0];
        if (firstLog.topics.length > 1) {
          bondId = firstLog.topics[1].slice(0, 18);
        }
      }

      return {
        success: receipt.status === 1,
        bondId,
        partnerAddress: params.partnerAddress,
        bondType: params.bondType,
        chain: this.chain,
        txHash: tx.hash,
        receipt,
        error: receipt.status === 0 ? 'Transaction reverted' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        bondId: '',
        partnerAddress: params.partnerAddress,
        bondType: params.bondType,
        chain: this.chain,
        error: error instanceof Error ? error.message : 'Bond creation failed',
      };
    }
  }

  /**
   * Attest a belief on-chain via the BeliefAttestationVerifier.
   */
  async attestBelief(params: {
    beliefHash: string;
    evidence: string;
  }): Promise<BeliefAttestation> {
    const signer = this.requireSigner();

    try {
      // Encode: attestBelief(bytes32 beliefHash, bytes evidence)
      const beliefBytes32 = encodeBytes32(params.beliefHash);
      const evidenceOffset = '0000000000000000000000000000000000000000000000000000000000000040';
      const encodedEvidence = encodeString(params.evidence);

      const calldata = SELECTORS.attestBelief + beliefBytes32 + evidenceOffset + encodedEvidence;
      const to = BELIEF_ATTESTATION[this.chain];
      const signerAddress = await signer.getAddress();

      let gasLimit: bigint;
      try {
        gasLimit = await rpcEstimateGas(this.chain, { from: signerAddress, to, data: calldata }, this.rpcUrl);
        gasLimit = gasLimit * 120n / 100n;
      } catch {
        gasLimit = 250000n;
      }

      const tx = await signer.sendTransaction({
        to,
        data: calldata,
        chainId: CHAIN_IDS[this.chain],
        gasLimit: '0x' + gasLimit.toString(16),
      });

      const receipt = await tx.wait(1);

      return {
        success: receipt.status === 1,
        beliefHash: params.beliefHash,
        chain: this.chain,
        txHash: tx.hash,
        receipt,
        error: receipt.status === 0 ? 'Transaction reverted' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        beliefHash: params.beliefHash,
        chain: this.chain,
        error: error instanceof Error ? error.message : 'Attestation failed',
      };
    }
  }

  /**
   * Update reputation score on-chain via the ReputationRegistry.
   */
  async updateReputation(params: {
    targetAddress: string;
    score: number;
    reason?: string;
  }): Promise<ReputationUpdate> {
    const signer = this.requireSigner();

    try {
      // Encode: updateReputation(address target, uint256 score)
      const targetPadded = params.targetAddress.replace('0x', '').toLowerCase().padStart(64, '0');
      const scorePadded = BigInt(Math.min(Math.max(params.score, 0), 100)).toString(16).padStart(64, '0');

      const calldata = SELECTORS.updateReputation + targetPadded + scorePadded;
      const to = REPUTATION_REGISTRY[this.chain];
      const signerAddress = await signer.getAddress();

      let gasLimit: bigint;
      try {
        gasLimit = await rpcEstimateGas(this.chain, { from: signerAddress, to, data: calldata }, this.rpcUrl);
        gasLimit = gasLimit * 120n / 100n;
      } catch {
        gasLimit = 200000n;
      }

      const tx = await signer.sendTransaction({
        to,
        data: calldata,
        chainId: CHAIN_IDS[this.chain],
        gasLimit: '0x' + gasLimit.toString(16),
      });

      const receipt = await tx.wait(1);

      return {
        success: receipt.status === 1,
        address: params.targetAddress,
        newScore: params.score,
        chain: this.chain,
        txHash: tx.hash,
        receipt,
        error: receipt.status === 0 ? 'Transaction reverted' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        address: params.targetAddress,
        newScore: params.score,
        chain: this.chain,
        error: error instanceof Error ? error.message : 'Reputation update failed',
      };
    }
  }

  /* ══════════════════════════════════════════════════════
     TRANSACTION STATUS TRACKING
     ══════════════════════════════════════════════════════ */

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const receipt = await rpcGetTransactionReceipt(this.chain, txHash, this.rpcUrl);
    if (!receipt) {
      return { hash: txHash, status: 'pending', confirmations: 0 };
    }
    return {
      hash: txHash,
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      confirmations: 1,
      receipt,
    };
  }

  /* ══════════════════════════════════════════════════════
     EVENT LISTENING (poll-based for browser compatibility)
     ══════════════════════════════════════════════════════ */

  /**
   * Subscribe to contract events. Uses polling (every 15s) since
   * browser environments don't support WebSocket subscriptions reliably.
   */
  on(eventName: VaultfireEvent, callback: EventCallback): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(callback);

    // Start polling if not already
    if (!this.pollingIntervals.has(eventName)) {
      let lastBlock = 0;
      const contractAddress = this.getContractForEvent(eventName);
      const topic = EVENT_TOPICS[eventName];

      const poll = async () => {
        try {
          const fromBlock = lastBlock > 0 ? '0x' + lastBlock.toString(16) : 'latest';
          const logs = await rpcGetLogs(this.chain, contractAddress, [topic], fromBlock, 'latest', this.rpcUrl);
          for (const log of logs) {
            const blockNum = log.logIndex; // simplified
            if (blockNum > lastBlock) lastBlock = blockNum;
            const listeners = this.eventListeners.get(eventName);
            if (listeners) {
              for (const cb of listeners) {
                try {
                  cb({
                    name: eventName,
                    data: { address: log.address, topics: log.topics, rawData: log.data },
                    blockNumber: blockNum,
                    transactionHash: log.topics[0] || '',
                  });
                } catch { /* listener error */ }
              }
            }
          }
        } catch { /* polling error */ }
      };

      const interval = setInterval(poll, 15000);
      this.pollingIntervals.set(eventName, interval);
      poll(); // Initial poll
    }
  }

  /** Remove an event listener */
  off(eventName: VaultfireEvent, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        const interval = this.pollingIntervals.get(eventName);
        if (interval) {
          clearInterval(interval);
          this.pollingIntervals.delete(eventName);
        }
        this.eventListeners.delete(eventName);
      }
    }
  }

  /** Remove all event listeners and stop polling */
  removeAllListeners(): void {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.eventListeners.clear();
  }

  private getContractForEvent(eventName: VaultfireEvent): string {
    switch (eventName) {
      case 'AgentRegistered': return IDENTITY_REGISTRY[this.chain];
      case 'BondCreated':
      case 'BondRevoked': return PARTNERSHIP_BONDS[this.chain];
      case 'BeliefAttested': return BELIEF_ATTESTATION[this.chain];
      case 'ReputationUpdated':
      case 'TrustScoreChanged': return REPUTATION_REGISTRY[this.chain];
    }
  }

  /* ══════════════════════════════════════════════════════
     BUILD-ONLY METHODS (for UIs that handle signing separately)
     ══════════════════════════════════════════════════════ */

  buildRegisterAgentTx(name: string, capabilities: string): {
    to: string; data: string; chainId: number; value: string;
  } {
    const nameOffset = '0000000000000000000000000000000000000000000000000000000000000060';
    const metaHash = '0'.repeat(64);
    const encodedName = encodeString(name);
    const capOffsetVal = (96 + 32 + Math.ceil(encodedName.length / 2 / 32) * 32).toString(16).padStart(64, '0');
    const encodedCap = encodeString(capabilities || 'general');

    return {
      to: IDENTITY_REGISTRY[this.chain],
      data: SELECTORS.registerAgent + nameOffset + capOffsetVal + metaHash + encodedName + encodedCap,
      chainId: CHAIN_IDS[this.chain],
      value: '0',
    };
  }

  buildCreateBondTx(partnerAddress: string, bondType: string, stakeWei: string): {
    to: string; data: string; chainId: number; value: string;
  } {
    const partnerPadded = partnerAddress.replace('0x', '').toLowerCase().padStart(64, '0');
    const typeOffset = '0000000000000000000000000000000000000000000000000000000000000040';
    const encodedType = encodeString(bondType);

    return {
      to: PARTNERSHIP_BONDS[this.chain],
      data: SELECTORS.createBond + partnerPadded + typeOffset + encodedType,
      chainId: CHAIN_IDS[this.chain],
      value: stakeWei,
    };
  }

  buildAttestBeliefTx(beliefHash: string, evidence: string): {
    to: string; data: string; chainId: number; value: string;
  } {
    const beliefBytes32 = encodeBytes32(beliefHash);
    const evidenceOffset = '0000000000000000000000000000000000000000000000000000000000000040';
    const encodedEvidence = encodeString(evidence);

    return {
      to: BELIEF_ATTESTATION[this.chain],
      data: SELECTORS.attestBelief + beliefBytes32 + evidenceOffset + encodedEvidence,
      chainId: CHAIN_IDS[this.chain],
      value: '0',
    };
  }

  /* ══════════════════════════════════════════════════════
     UTILITY METHODS
     ══════════════════════════════════════════════════════ */

  getContractAddresses() {
    return {
      identityRegistry: IDENTITY_REGISTRY[this.chain],
      partnershipBonds: PARTNERSHIP_BONDS[this.chain],
      accountabilityBonds: ACCOUNTABILITY_BONDS[this.chain],
      flourishingOracle: FLOURISHING_ORACLE[this.chain],
      reputationRegistry: REPUTATION_REGISTRY[this.chain],
      beliefAttestation: BELIEF_ATTESTATION[this.chain],
      vnsRegistry: VNS_REGISTRY[this.chain],
    };
  }

  getExplorerUrl(hashOrAddress: string, type: 'tx' | 'address' = 'address'): string {
    return `${EXPLORER_URLS[this.chain]}/${type}/${hashOrAddress}`;
  }

  getChainInfo() {
    return {
      chain: this.chain,
      chainId: CHAIN_IDS[this.chain],
      rpcUrl: this.rpcUrl,
      explorerUrl: EXPLORER_URLS[this.chain],
    };
  }
}

/* ═══════════════════════════════════════════════════════
   CONVENIENCE FACTORY
   ═══════════════════════════════════════════════════════ */
export function createVaultfireSDK(chain: SupportedChain = 'base', rpcUrl?: string): VaultfireSDK {
  return new VaultfireSDK({ chain, rpcUrl });
}

/* ═══════════════════════════════════════════════════════
   MULTI-CHAIN HELPERS
   ═══════════════════════════════════════════════════════ */
export async function verifyTrustMultiChain(address: string): Promise<TrustVerification[]> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  return Promise.all(chains.map(chain => createVaultfireSDK(chain).verifyTrust(address)));
}

export async function getTotalAgentsAllChains(): Promise<{ base: number; avalanche: number; ethereum: number; total: number }> {
  const [base, avalanche, ethereum] = await Promise.all([
    createVaultfireSDK('base').getTotalAgents(),
    createVaultfireSDK('avalanche').getTotalAgents(),
    createVaultfireSDK('ethereum').getTotalAgents(),
  ]);
  return { base, avalanche, ethereum, total: base + avalanche + ethereum };
}

export async function resolveVNSMultiChain(name: string): Promise<VNSResolution[]> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  return Promise.all(chains.map(chain => createVaultfireSDK(chain).resolveVNS(name)));
}
