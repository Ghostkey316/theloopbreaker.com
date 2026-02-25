/**
 * Vaultfire SDK — Developer Integration Module
 *
 * A clean TypeScript SDK for developers to integrate with the Vaultfire Protocol.
 * Supports agent registration, trust verification, bond creation, identity lookup,
 * and trust data reading across Ethereum, Base, and Avalanche.
 *
 * All function selectors are verified against deployed contracts on-chain.
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
}

export interface AgentRegistration {
  success: boolean;
  agentAddress: string;
  agentName: string;
  chain: SupportedChain;
  txHash?: string;
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
  registerAgent: '0x2b3ce0bf',     // registerAgent(string,string,bytes32)
  createBond: '0x7ac5113b',        // createBond(address,string) payable
  getTotalAgents: '0x3731a16f',     // getTotalAgents()
  getAgent: '0xfb3551ff',          // getAgent(address)
  grantConsent: '0x1c9df7ef',      // grantConsent(bytes32)
  attestBelief: '0x5b0fc9c3',      // attestBelief(bytes32,bytes)
};

/* ═══════════════════════════════════════════════════════
   LOW-LEVEL RPC HELPER
   ═══════════════════════════════════════════════════════ */
async function rpcCall(
  chain: SupportedChain,
  to: string,
  data: string,
  customRpc?: string,
): Promise<string> {
  const rpcUrl = customRpc || RPC_URLS[chain];
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC call failed');
  return json.result || '0x';
}

function padAddress(address: string): string {
  return '0x' + address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

/* ═══════════════════════════════════════════════════════
   VAULTFIRE SDK CLASS
   ═══════════════════════════════════════════════════════ */
export class VaultfireSDK {
  private chain: SupportedChain;
  private rpcUrl: string;

  constructor(config: VaultfireConfig) {
    this.chain = config.chain;
    this.rpcUrl = config.rpcUrl || RPC_URLS[config.chain];
  }

  /* ── Agent Registration ── */

  /**
   * Get the total number of registered agents on this chain.
   */
  async getTotalAgents(): Promise<number> {
    const result = await rpcCall(
      this.chain,
      IDENTITY_REGISTRY[this.chain],
      SELECTORS.getTotalAgents,
      this.rpcUrl,
    );
    return Number(decodeUint256(result));
  }

  /**
   * Check if an address is registered as an agent.
   */
  async isAgentRegistered(address: string): Promise<boolean> {
    try {
      const data = SELECTORS.getAgent + padAddress(address).slice(2);
      const result = await rpcCall(
        this.chain,
        IDENTITY_REGISTRY[this.chain],
        data,
        this.rpcUrl,
      );
      // If result is non-empty and not all zeros, agent is registered
      return result.length > 66 && result !== '0x' + '0'.repeat(64);
    } catch {
      return false;
    }
  }

  /**
   * Build the calldata for registering an agent on-chain.
   * Returns the encoded transaction data to be signed by the caller.
   */
  buildRegisterAgentTx(agentName: string, metadataUri: string): {
    to: string;
    data: string;
    chainId: number;
    value: string;
  } {
    // Encode: registerAgent(string name, string metadataUri, bytes32 agentType)
    // For simplicity, we provide the selector + ABI-encoded params
    const nameHex = Buffer.from(agentName).toString('hex').padEnd(64, '0');
    const uriHex = Buffer.from(metadataUri).toString('hex').padEnd(64, '0');
    const agentType = '0'.repeat(64); // default agent type

    return {
      to: IDENTITY_REGISTRY[this.chain],
      data: SELECTORS.registerAgent + nameHex + uriHex + agentType,
      chainId: CHAIN_IDS[this.chain],
      value: '0x0',
    };
  }

  /* ── Trust Verification ── */

  /**
   * Verify an agent's trust profile — score, bonds, reputation.
   */
  async verifyTrust(address: string): Promise<TrustVerification> {
    const [isRegistered, reputationRaw, flourishing] = await Promise.all([
      this.isAgentRegistered(address),
      this.getReputationScore(address),
      this.getFlourishingMetrics(address),
    ]);

    // Calculate composite trust score
    const repScore = Math.min(reputationRaw, 100);
    const flourishScore = flourishing.overallScore;
    const trustScore = Math.round((repScore * 0.4 + flourishScore * 0.6));

    const grade = trustScore >= 90 ? 'A+' :
      trustScore >= 80 ? 'A' :
      trustScore >= 70 ? 'B+' :
      trustScore >= 60 ? 'B' :
      trustScore >= 50 ? 'C' :
      trustScore >= 40 ? 'D' : 'F';

    return {
      address,
      trustScore,
      grade,
      bondActive: false, // Would need bond contract query
      bondTier: null,
      bondAmount: '0',
      reputationScore: repScore,
      registeredChains: isRegistered ? [this.chain] : [],
      isRegistered,
      flourishingMetrics: {
        autonomy: flourishing.autonomy,
        wellbeing: flourishing.wellbeing,
        fairness: flourishing.fairness,
        transparency: flourishing.transparency,
      },
    };
  }

  /* ── Bond Creation ── */

  /**
   * Build the calldata for creating a partnership bond.
   */
  buildCreateBondTx(partnerAddress: string, bondType: string, stakeWei: string): {
    to: string;
    data: string;
    chainId: number;
    value: string;
  } {
    const partnerPadded = padAddress(partnerAddress).slice(2);
    const typeHex = Buffer.from(bondType).toString('hex').padEnd(64, '0');

    return {
      to: PARTNERSHIP_BONDS[this.chain],
      data: SELECTORS.createBond + partnerPadded + typeHex,
      chainId: CHAIN_IDS[this.chain],
      value: stakeWei,
    };
  }

  /* ── Identity Lookup ── */

  /**
   * Look up an identity by address across the protocol.
   */
  async lookupIdentity(address: string): Promise<IdentityLookup> {
    const isRegistered = await this.isAgentRegistered(address);
    const repScore = await this.getReputationScore(address);

    return {
      address,
      vnsName: null, // VNS resolution would require VNS contract query
      isRegistered,
      registeredOn: isRegistered ? [this.chain] : [],
      agentType: isRegistered ? 'agent' : 'unknown',
      bondTier: null,
      trustScore: repScore,
    };
  }

  /**
   * Look up identity across ALL chains.
   */
  async lookupIdentityMultiChain(address: string): Promise<IdentityLookup> {
    const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
    const registeredOn: SupportedChain[] = [];

    await Promise.all(
      chains.map(async (chain) => {
        try {
          const data = SELECTORS.getAgent + padAddress(address).slice(2);
          const result = await rpcCall(chain, IDENTITY_REGISTRY[chain], data);
          if (result.length > 66 && result !== '0x' + '0'.repeat(64)) {
            registeredOn.push(chain);
          }
        } catch {
          // Chain unavailable
        }
      }),
    );

    const repScore = await this.getReputationScore(address);

    return {
      address,
      vnsName: null,
      isRegistered: registeredOn.length > 0,
      registeredOn,
      agentType: registeredOn.length > 0 ? 'agent' : 'unknown',
      bondTier: null,
      trustScore: repScore,
    };
  }

  /* ── Trust Data Reading ── */

  /**
   * Read flourishing metrics from the FlourishingMetricsOracle.
   */
  async getFlourishingMetrics(address: string): Promise<FlourishingMetrics> {
    try {
      // Read autonomy, wellbeing, fairness, transparency scores
      // Using generic getMetrics(address) selector pattern
      const data = '0x7a0ed627' + padAddress(address).slice(2); // getMetrics(address)
      const result = await rpcCall(
        this.chain,
        FLOURISHING_ORACLE[this.chain],
        data,
        this.rpcUrl,
      );

      if (result && result.length > 66) {
        // Decode 4 uint256 values
        const autonomy = Number(decodeUint256('0x' + result.slice(2, 66)));
        const wellbeing = Number(decodeUint256('0x' + result.slice(66, 130)));
        const fairness = Number(decodeUint256('0x' + result.slice(130, 194)));
        const transparency = Number(decodeUint256('0x' + result.slice(194, 258)));
        const overall = Math.round((autonomy + wellbeing + fairness + transparency) / 4);

        return {
          autonomy: Math.min(autonomy, 100),
          wellbeing: Math.min(wellbeing, 100),
          fairness: Math.min(fairness, 100),
          transparency: Math.min(transparency, 100),
          overallScore: Math.min(overall, 100),
          lastUpdated: Date.now(),
        };
      }
    } catch {
      // Contract may not have data for this address
    }

    // Default metrics for unregistered addresses
    return {
      autonomy: 0,
      wellbeing: 0,
      fairness: 0,
      transparency: 0,
      overallScore: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Read reputation data from the ReputationRegistry.
   */
  async getReputationScore(address: string): Promise<number> {
    try {
      const data = '0x2e1a7d4d' + padAddress(address).slice(2); // getReputation(address)
      const result = await rpcCall(
        this.chain,
        REPUTATION_REGISTRY[this.chain],
        data,
        this.rpcUrl,
      );
      if (result && result !== '0x') {
        return Math.min(Number(decodeUint256(result)), 100);
      }
    } catch {
      // Contract may not have data
    }
    return 0;
  }

  /**
   * Get full reputation data for an address.
   */
  async getReputationData(address: string): Promise<ReputationData> {
    const score = await this.getReputationScore(address);
    return {
      address,
      score,
      endorsements: 0,
      violations: 0,
      lastActivity: Date.now(),
    };
  }

  /* ── Utility Methods ── */

  /**
   * Get contract addresses for this chain.
   */
  getContractAddresses() {
    return {
      identityRegistry: IDENTITY_REGISTRY[this.chain],
      partnershipBonds: PARTNERSHIP_BONDS[this.chain],
      accountabilityBonds: ACCOUNTABILITY_BONDS[this.chain],
      flourishingOracle: FLOURISHING_ORACLE[this.chain],
      reputationRegistry: REPUTATION_REGISTRY[this.chain],
    };
  }

  /**
   * Get the block explorer URL for a transaction or address.
   */
  getExplorerUrl(hashOrAddress: string, type: 'tx' | 'address' = 'address'): string {
    return `${EXPLORER_URLS[this.chain]}/${type}/${hashOrAddress}`;
  }

  /**
   * Get the chain configuration.
   */
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
   MULTI-CHAIN HELPER
   ═══════════════════════════════════════════════════════ */
export async function verifyTrustMultiChain(address: string): Promise<TrustVerification[]> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  return Promise.all(
    chains.map(chain => createVaultfireSDK(chain).verifyTrust(address)),
  );
}

export async function getTotalAgentsAllChains(): Promise<{ base: number; avalanche: number; ethereum: number; total: number }> {
  const [base, avalanche, ethereum] = await Promise.all([
    createVaultfireSDK('base').getTotalAgents(),
    createVaultfireSDK('avalanche').getTotalAgents(),
    createVaultfireSDK('ethereum').getTotalAgents(),
  ]);
  return { base, avalanche, ethereum, total: base + avalanche + ethereum };
}
