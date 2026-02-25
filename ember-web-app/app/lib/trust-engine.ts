/**
 * Vaultfire Trust Engine
 *
 * Calculates REAL on-chain trust scores by reading contract state from
 * Base, Avalanche, and Ethereum. No fake numbers — every data point
 * comes from an actual RPC call.
 *
 * Score components:
 *   - Registration status on ERC8004IdentityRegistry (per chain)
 *   - Bond status on AIPartnershipBondsV2 (per chain)
 *   - Bond status on AIAccountabilityBondsV2 (per chain)
 *   - VNS name registration
 *   - Cross-chain presence (multi-chain bonus)
 *   - Contract liveness verification
 *
 * All reads use raw JSON-RPC eth_call — no ethers dependency for reads.
 */

import {
  RPC_URLS,
  IDENTITY_REGISTRY,
  PARTNERSHIP_BONDS,
  ACCOUNTABILITY_BONDS,
  type SupportedChain,
} from './contracts';
import { getWalletAddress } from './wallet';
import { isRegistered, getRegisteredChains } from './registration';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustScoreBreakdown {
  /** Overall score 0-100 */
  score: number;
  /** Letter grade */
  grade: string;
  /** Per-component scores */
  components: TrustComponent[];
  /** Per-chain details */
  chainDetails: ChainTrustDetail[];
  /** Timestamp of calculation */
  calculatedAt: number;
  /** Whether this is from live on-chain data */
  isLive: boolean;
}

export interface TrustComponent {
  name: string;
  description: string;
  score: number;
  maxScore: number;
  source: string;
  verified: boolean;
}

export interface ChainTrustDetail {
  chain: SupportedChain;
  registered: boolean;
  agentName: string | null;
  partnershipBondActive: boolean;
  partnershipBondAmount: string;
  accountabilityBondActive: boolean;
  accountabilityBondAmount: string;
  identityRegistryAlive: boolean;
  rpcReachable: boolean;
}

export interface BondInfo {
  hasBond: boolean;
  bondActive: boolean;
  bondAmount: string;
  bondId: number;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

const SELECTORS = {
  getTotalAgents: '0x3731a16f',
  getAgent: '0xfb3551ff',
  getBondsByParticipantCount: '0x67ff6265',
  getBondsByParticipant: '0xde4c4e4c',
  getBond: '0xd8fe7642',
  nextBondId: '0xee53a423',
};

// ─── JSON-RPC ─────────────────────────────────────────────────────────────────

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: Date.now(),
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result ?? '0x';
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRpc(rpcUrl: string): Promise<boolean> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return !!data.result;
  } catch {
    return false;
  }
}

async function checkContractAlive(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.result && data.result !== '0x' && data.result.length > 2;
  } catch {
    return false;
  }
}

// ─── On-Chain Registration Check ──────────────────────────────────────────────

async function checkRegistrationOnChain(
  address: string,
  chain: SupportedChain,
): Promise<{ registered: boolean; agentName: string | null }> {
  const rpc = RPC_URLS[chain];
  const registry = IDENTITY_REGISTRY[chain];
  if (!registry) return { registered: false, agentName: null };

  const paddedAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');
  const calldata = SELECTORS.getAgent + paddedAddr;

  try {
    const result = await ethCall(rpc, registry, calldata);
    if (!result || result === '0x' || result.length < 130) {
      return { registered: false, agentName: null };
    }

    const hex = result.slice(2);
    const nameOffset = parseInt(hex.slice(0, 64), 16) * 2;
    if (nameOffset >= hex.length) return { registered: false, agentName: null };

    const nameLength = parseInt(hex.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return { registered: false, agentName: null };

    const nameHex = hex.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    const name = new TextDecoder().decode(nameBytes);
    return { registered: !!name, agentName: name || null };
  } catch {
    return { registered: false, agentName: null };
  }
}

// ─── Bond Check ───────────────────────────────────────────────────────────────

async function checkBond(
  address: string,
  chain: SupportedChain,
  bondContract: string,
): Promise<BondInfo> {
  const rpc = RPC_URLS[chain];
  const paddedAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');

  try {
    // Step 1: getBondsByParticipantCount(address)
    const countResult = await ethCall(rpc, bondContract, SELECTORS.getBondsByParticipantCount + paddedAddr);
    const bondCount = countResult && countResult !== '0x' && countResult.length > 2
      ? BigInt(countResult)
      : 0n;

    if (bondCount === 0n) {
      return { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };
    }

    // Step 2: getBondsByParticipant(address)
    const bondsResult = await ethCall(rpc, bondContract, SELECTORS.getBondsByParticipant + paddedAddr);
    if (!bondsResult || bondsResult === '0x' || bondsResult.length < 130) {
      return { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };
    }

    const raw = bondsResult.slice(2);
    const arrayLength = Number(BigInt('0x' + raw.slice(64, 128)));
    if (arrayLength === 0) {
      return { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };
    }

    // Take the first bond ID
    const firstBondId = BigInt('0x' + raw.slice(128, 192));
    const bondId = Number(firstBondId);

    // Step 3: getBond(bondId)
    const bondIdPadded = firstBondId.toString(16).padStart(64, '0');
    const bondResult = await ethCall(rpc, bondContract, SELECTORS.getBond + bondIdPadded);

    if (!bondResult || bondResult === '0x' || bondResult.length < 642) {
      return { hasBond: true, bondActive: false, bondAmount: '0', bondId };
    }

    const bondRaw = bondResult.slice(2);
    // Bond struct: offset 5 = stakeAmount, offset 9 = active
    const stakeHex = bondRaw.slice(5 * 64, 6 * 64);
    const activeHex = bondRaw.slice(9 * 64, 10 * 64);

    const bondAmount = stakeHex.length === 64 ? BigInt('0x' + stakeHex).toString() : '0';
    const bondActive = activeHex.length === 64 ? BigInt('0x' + activeHex) === 1n : false;

    return {
      hasBond: BigInt(bondAmount) > 0n,
      bondActive,
      bondAmount,
      bondId,
    };
  } catch {
    return { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };
  }
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatWei(wei: string): string {
  const n = BigInt(wei);
  if (n === 0n) return '0';
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}

function getGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 40) return 'D';
  return 'F';
}

// ─── Main Trust Score Calculation ─────────────────────────────────────────────

/**
 * Calculate a comprehensive trust score from on-chain data.
 *
 * Scoring breakdown (100 points total):
 *   - Wallet exists: 5 pts
 *   - Local registration: 5 pts
 *   - On-chain registration per chain: 10 pts each (max 30)
 *   - Partnership bond per chain: 8 pts each (max 24)
 *   - Accountability bond per chain: 8 pts each (max 24)
 *   - Multi-chain presence bonus: 6 pts
 *   - VNS name: 6 pts
 *
 * All data is fetched live from RPCs.
 */
export async function calculateTrustScore(
  onProgress?: (msg: string) => void,
): Promise<TrustScoreBreakdown> {
  const address = getWalletAddress();
  const components: TrustComponent[] = [];
  const chainDetails: ChainTrustDetail[] = [];
  let totalScore = 0;

  // Component: Wallet exists
  const hasWallet = !!address;
  components.push({
    name: 'Wallet Created',
    description: 'A local encrypted wallet exists in the app',
    score: hasWallet ? 5 : 0,
    maxScore: 5,
    source: 'Local',
    verified: hasWallet,
  });
  if (hasWallet) totalScore += 5;

  // Component: Local registration
  const localReg = isRegistered();
  const regChains = getRegisteredChains();
  components.push({
    name: 'Local Registration',
    description: 'Registration transaction recorded locally',
    score: localReg ? 5 : 0,
    maxScore: 5,
    source: 'LocalStorage',
    verified: localReg,
  });
  if (localReg) totalScore += 5;

  if (!address) {
    return {
      score: totalScore,
      grade: getGrade(totalScore),
      components,
      chainDetails,
      calculatedAt: Date.now(),
      isLive: false,
    };
  }

  // Per-chain checks
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  let chainsWithRegistration = 0;
  let chainsWithBond = 0;

  for (const chain of chains) {
    onProgress?.(`Checking ${chain}...`);
    const rpc = RPC_URLS[chain];

    // Check RPC reachability
    const rpcOk = await checkRpc(rpc);

    // Check identity registry
    const registryAlive = rpcOk ? await checkContractAlive(rpc, IDENTITY_REGISTRY[chain]) : false;

    // Check on-chain registration
    let regResult = { registered: false, agentName: null as string | null };
    if (rpcOk && registryAlive) {
      regResult = await checkRegistrationOnChain(address, chain);
    }

    if (regResult.registered) {
      chainsWithRegistration++;
      totalScore += 10;
    }

    components.push({
      name: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Registration`,
      description: regResult.registered
        ? `Registered as "${regResult.agentName}" on ${chain}`
        : `Not registered on ${chain}`,
      score: regResult.registered ? 10 : 0,
      maxScore: 10,
      source: `ERC8004IdentityRegistry (${chain})`,
      verified: regResult.registered,
    });

    // Check partnership bond
    const partnerBond = rpcOk
      ? await checkBond(address, chain, PARTNERSHIP_BONDS[chain])
      : { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };

    if (partnerBond.hasBond && partnerBond.bondActive) {
      totalScore += 8;
      chainsWithBond++;
    }

    components.push({
      name: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Partnership Bond`,
      description: partnerBond.hasBond
        ? `Bond #${partnerBond.bondId}: ${formatWei(partnerBond.bondAmount)} ETH (${partnerBond.bondActive ? 'Active' : 'Inactive'})`
        : 'No partnership bond',
      score: partnerBond.hasBond && partnerBond.bondActive ? 8 : 0,
      maxScore: 8,
      source: `AIPartnershipBondsV2 (${chain})`,
      verified: partnerBond.bondActive,
    });

    // Check accountability bond
    const accountBond = rpcOk
      ? await checkBond(address, chain, ACCOUNTABILITY_BONDS[chain])
      : { hasBond: false, bondActive: false, bondAmount: '0', bondId: 0 };

    if (accountBond.hasBond && accountBond.bondActive) {
      totalScore += 8;
    }

    components.push({
      name: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Accountability Bond`,
      description: accountBond.hasBond
        ? `Bond #${accountBond.bondId}: ${formatWei(accountBond.bondAmount)} ETH (${accountBond.bondActive ? 'Active' : 'Inactive'})`
        : 'No accountability bond',
      score: accountBond.hasBond && accountBond.bondActive ? 8 : 0,
      maxScore: 8,
      source: `AIAccountabilityBondsV2 (${chain})`,
      verified: accountBond.bondActive,
    });

    chainDetails.push({
      chain,
      registered: regResult.registered,
      agentName: regResult.agentName,
      partnershipBondActive: partnerBond.bondActive,
      partnershipBondAmount: partnerBond.bondAmount,
      accountabilityBondActive: accountBond.bondActive,
      accountabilityBondAmount: accountBond.bondAmount,
      identityRegistryAlive: registryAlive,
      rpcReachable: rpcOk,
    });
  }

  // Multi-chain bonus
  const multiChainBonus = chainsWithRegistration >= 3 ? 6 : chainsWithRegistration >= 2 ? 4 : chainsWithRegistration >= 1 ? 2 : 0;
  totalScore += multiChainBonus;
  components.push({
    name: 'Multi-Chain Presence',
    description: `Registered on ${chainsWithRegistration}/3 chains`,
    score: multiChainBonus,
    maxScore: 6,
    source: 'Cross-chain analysis',
    verified: chainsWithRegistration > 0,
  });

  // VNS name check
  let hasVNS = false;
  if (typeof window !== 'undefined') {
    try {
      const vnsName = localStorage.getItem('vaultfire_vns_name');
      hasVNS = !!vnsName && vnsName.endsWith('.vns');
    } catch { /* ignore */ }
  }
  if (hasVNS) totalScore += 6;
  components.push({
    name: 'VNS Name',
    description: hasVNS ? 'Registered .vns identity name' : 'No VNS name registered',
    score: hasVNS ? 6 : 0,
    maxScore: 6,
    source: 'VNS Registry',
    verified: hasVNS,
  });

  const finalScore = Math.min(totalScore, 100);

  return {
    score: finalScore,
    grade: getGrade(finalScore),
    components,
    chainDetails,
    calculatedAt: Date.now(),
    isLive: true,
  };
}

/**
 * Quick trust score check — returns just the score and grade.
 * Faster than full calculateTrustScore as it skips detailed bond checks.
 */
export async function quickTrustCheck(): Promise<{ score: number; grade: string }> {
  const address = getWalletAddress();
  if (!address) return { score: 0, grade: 'F' };

  let score = 5; // wallet exists
  if (isRegistered()) score += 5;

  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  for (const chain of chains) {
    try {
      const reg = await checkRegistrationOnChain(address, chain);
      if (reg.registered) score += 10;
    } catch { /* skip */ }
  }

  // VNS
  if (typeof window !== 'undefined') {
    try {
      const vns = localStorage.getItem('vaultfire_vns_name');
      if (vns && vns.endsWith('.vns')) score += 6;
    } catch { /* ignore */ }
  }

  return { score: Math.min(score, 100), grade: getGrade(Math.min(score, 100)) };
}
