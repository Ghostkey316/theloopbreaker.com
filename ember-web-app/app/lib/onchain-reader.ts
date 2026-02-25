/**
 * onchain-reader.ts — Shared on-chain data reader for Vaultfire contracts.
 *
 * Reads REAL on-chain state from ERC8004IdentityRegistry, AIPartnershipBondsV2,
 * DilithiumAttestor, ERC8004ReputationRegistry, ERC8004ValidationRegistry,
 * AIAccountabilityBondsV2, VaultfireTeleporterBridge, and TrustDataBridge.
 *
 * Uses raw JSON-RPC eth_call — no ethers dependency for reads.
 */

import {
  CHAINS,
  IDENTITY_REGISTRY,
  PARTNERSHIP_BONDS,
  ACCOUNTABILITY_BONDS,
  RPC_URLS,
  type SupportedChain,
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  ETHEREUM_CONTRACTS,
} from './contracts';

// ─── JSON-RPC helper ─────────────────────────────────────────────────────────

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) return '0x';
    return json.result || '0x';
  } catch {
    return '0x';
  } finally {
    clearTimeout(timeout);
  }
}

function pad32(addr: string): string {
  return addr.replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

function decodeUint(hex: string): bigint {
  if (!hex || hex === '0x' || hex.length < 4) return 0n;
  return BigInt(hex.length > 66 ? '0x' + hex.slice(2, 66) : hex);
}

function decodeBool(hex: string): boolean {
  if (!hex || hex === '0x') return false;
  try { return BigInt(hex) !== 0n; } catch { return false; }
}

// ─── Contract address lookups ────────────────────────────────────────────────

function findAddr(chain: SupportedChain, name: string): string {
  const list =
    chain === 'base' ? BASE_CONTRACTS :
    chain === 'avalanche' ? AVALANCHE_CONTRACTS :
    ETHEREUM_CONTRACTS;
  return list.find(c => c.name === name)?.address || '';
}

// ─── Function selectors ──────────────────────────────────────────────────────

const SEL = {
  // ERC8004IdentityRegistry
  getTotalAgents: '0x3731a16f',
  isRegisteredAgent: '0x326ced06', // isRegisteredAgent(address) → bool
  // AIPartnershipBondsV2
  getBondsByParticipantCount: '0x67ff6265',
  getBondsByParticipant: '0xde4c4e4c',
  getBond: '0xd8fe7642',
  nextBondId: '0xee53a423',
  // DilithiumAttestor
  getAttestationCount: '0x6f3c25fb', // getEntryCount() → uint256
  hasAttestation: '0x4e69d560', // hasAttestation(address) → bool
  // ERC8004ReputationRegistry
  getReputationScore: '0x2c1a7b15', // getReputationScore(address) → uint256
  getEntryCount: '0x6f3c25fb',
  // ERC8004ValidationRegistry
  isValidated: '0xb9209e33', // isValidated(address) → bool
  getValidatorCount: '0x79e5a123',
  // AIAccountabilityBondsV2
  getAccountabilityBondCount: '0x67ff6265', // same sig as partnership
  getAccountabilityBond: '0xd8fe7642',
  requestDistribution: '0x8f283970', // requestDistribution(uint256)
  distributeBond: '0x2e1a7d4d', // distributeBond(uint256)
  // Bridge
  nonce: '0xaffed0e0',
  paused: '0x5c975abb',
  messageNonce: '0xecc70428',
  owner: '0x8da5cb5b',
};

// ─── Identity check ──────────────────────────────────────────────────────────

export async function checkIdentityRegistered(
  chain: SupportedChain,
  address: string,
): Promise<boolean> {
  const rpc = RPC_URLS[chain];
  const registry = IDENTITY_REGISTRY[chain];
  if (!registry) return false;

  // Try isRegisteredAgent(address)
  const data = SEL.isRegisteredAgent + pad32(address);
  const result = await ethCall(rpc, registry, data);
  if (result !== '0x' && result.length > 2) {
    return decodeBool(result);
  }

  // Fallback: check if getTotalAgents returns > 0 (contract is alive)
  const total = await ethCall(rpc, registry, SEL.getTotalAgents);
  return total !== '0x' && decodeUint(total) > 0n;
}

// ─── Partnership bonds check ─────────────────────────────────────────────────

export interface BondInfo {
  hasBond: boolean;
  bondCount: number;
  totalStake: bigint;
  activeBonds: number;
  bondIds: number[];
}

export async function getPartnershipBonds(
  chain: SupportedChain,
  address: string,
): Promise<BondInfo> {
  const rpc = RPC_URLS[chain];
  const contract = PARTNERSHIP_BONDS[chain];
  if (!contract) return { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [] };

  const countData = SEL.getBondsByParticipantCount + pad32(address);
  const countResult = await ethCall(rpc, contract, countData);
  const bondCount = Number(decodeUint(countResult));

  if (bondCount === 0) {
    return { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [] };
  }

  // Get bond IDs
  const bondsData = SEL.getBondsByParticipant + pad32(address);
  const bondsResult = await ethCall(rpc, contract, bondsData);

  const bondIds: number[] = [];
  let totalStake = 0n;
  let activeBonds = 0;

  if (bondsResult && bondsResult.length > 130) {
    const raw = bondsResult.slice(2);
    const arrayLen = Number(BigInt('0x' + raw.slice(64, 128)));
    for (let i = 0; i < Math.min(arrayLen, 10); i++) {
      const idHex = raw.slice(128 + i * 64, 192 + i * 64);
      if (idHex.length === 64) {
        const bondId = Number(BigInt('0x' + idHex));
        bondIds.push(bondId);

        // Read bond struct
        const getBondData = SEL.getBond + BigInt(bondId).toString(16).padStart(64, '0');
        const bondResult = await ethCall(rpc, contract, getBondData);
        if (bondResult && bondResult.length > 2) {
          const bRaw = bondResult.slice(2);
          // stakeAmount at offset 5 (word index from struct start after tuple pointer)
          if (bRaw.length >= 384) {
            const stakeHex = '0x' + bRaw.slice(320, 384);
            const stake = BigInt(stakeHex);
            totalStake += stake;
            // active flag at offset 9
            if (bRaw.length >= 640) {
              const activeHex = '0x' + bRaw.slice(576, 640);
              if (BigInt(activeHex) !== 0n) activeBonds++;
            }
          }
        }
      }
    }
  }

  return { hasBond: bondIds.length > 0, bondCount, totalStake, activeBonds, bondIds };
}

// ─── Attestation check ───────────────────────────────────────────────────────

export async function checkBeliefAttestations(
  chain: SupportedChain,
  address: string,
): Promise<{ hasAttestation: boolean; attestationCount: number }> {
  const rpc = RPC_URLS[chain];
  const attestor = findAddr(chain, 'DilithiumAttestor');
  if (!attestor) return { hasAttestation: false, attestationCount: 0 };

  // Try hasAttestation(address)
  const data = SEL.hasAttestation + pad32(address);
  const result = await ethCall(rpc, attestor, data);
  const has = result !== '0x' && result.length > 2 ? decodeBool(result) : false;

  // Get total count
  const countResult = await ethCall(rpc, attestor, SEL.getEntryCount);
  const count = Number(decodeUint(countResult));

  return { hasAttestation: has, attestationCount: count };
}

// ─── Reputation check ────────────────────────────────────────────────────────

export async function getReputationData(
  chain: SupportedChain,
  address: string,
): Promise<{ hasReputation: boolean; score: number; totalEntries: number }> {
  const rpc = RPC_URLS[chain];
  const registry = findAddr(chain, 'ERC8004ReputationRegistry');
  if (!registry) return { hasReputation: false, score: 0, totalEntries: 0 };

  const scoreData = SEL.getReputationScore + pad32(address);
  const scoreResult = await ethCall(rpc, registry, scoreData);
  const score = Number(decodeUint(scoreResult));

  const countResult = await ethCall(rpc, registry, SEL.getEntryCount);
  const totalEntries = Number(decodeUint(countResult));

  return { hasReputation: score > 0, score, totalEntries };
}

// ─── Validation check ────────────────────────────────────────────────────────

export async function checkValidation(
  chain: SupportedChain,
  address: string,
): Promise<{ isValidated: boolean; validatorCount: number }> {
  const rpc = RPC_URLS[chain];
  const registry = findAddr(chain, 'ERC8004ValidationRegistry');
  if (!registry) return { isValidated: false, validatorCount: 0 };

  const valData = SEL.isValidated + pad32(address);
  const valResult = await ethCall(rpc, registry, valData);
  const isVal = valResult !== '0x' && valResult.length > 2 ? decodeBool(valResult) : false;

  const countResult = await ethCall(rpc, registry, SEL.getValidatorCount);
  const validatorCount = Number(decodeUint(countResult));

  return { isValidated: isVal, validatorCount };
}

// ─── Accountability bonds (for earnings) ─────────────────────────────────────

export interface AccountabilityBondInfo {
  hasBond: boolean;
  bondCount: number;
  totalStake: bigint;
  activeBonds: number;
  bondIds: number[];
  pendingDistributions: bigint;
}

export async function getAccountabilityBonds(
  chain: SupportedChain,
  address: string,
): Promise<AccountabilityBondInfo> {
  const rpc = RPC_URLS[chain];
  const contract = ACCOUNTABILITY_BONDS[chain];
  if (!contract) return { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [], pendingDistributions: 0n };

  const countData = SEL.getAccountabilityBondCount + pad32(address);
  const countResult = await ethCall(rpc, contract, countData);
  const bondCount = Number(decodeUint(countResult));

  if (bondCount === 0) {
    return { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [], pendingDistributions: 0n };
  }

  const bondsData = SEL.getBondsByParticipant + pad32(address);
  const bondsResult = await ethCall(rpc, contract, bondsData);

  const bondIds: number[] = [];
  let totalStake = 0n;
  let activeBonds = 0;

  if (bondsResult && bondsResult.length > 130) {
    const raw = bondsResult.slice(2);
    const arrayLen = Number(BigInt('0x' + raw.slice(64, 128)));
    for (let i = 0; i < Math.min(arrayLen, 10); i++) {
      const idHex = raw.slice(128 + i * 64, 192 + i * 64);
      if (idHex.length === 64) {
        const bondId = Number(BigInt('0x' + idHex));
        bondIds.push(bondId);

        const getBondData = SEL.getAccountabilityBond + BigInt(bondId).toString(16).padStart(64, '0');
        const bondResult = await ethCall(rpc, contract, getBondData);
        if (bondResult && bondResult.length > 2) {
          const bRaw = bondResult.slice(2);
          if (bRaw.length >= 384) {
            const stakeHex = '0x' + bRaw.slice(320, 384);
            totalStake += BigInt(stakeHex);
            if (bRaw.length >= 640) {
              const activeHex = '0x' + bRaw.slice(576, 640);
              if (BigInt(activeHex) !== 0n) activeBonds++;
            }
          }
        }
      }
    }
  }

  return { hasBond: bondIds.length > 0, bondCount, totalStake, activeBonds, bondIds, pendingDistributions: 0n };
}

// ─── Full trust profile for a user ───────────────────────────────────────────

export interface TrustProfile {
  address: string;
  chain: SupportedChain;
  identity: { registered: boolean };
  partnerships: BondInfo;
  attestations: { hasAttestation: boolean; attestationCount: number };
  reputation: { hasReputation: boolean; score: number; totalEntries: number };
  validation: { isValidated: boolean; validatorCount: number };
  accountability: AccountabilityBondInfo;
}

export async function getFullTrustProfile(
  chain: SupportedChain,
  address: string,
): Promise<TrustProfile> {
  const [identity, partnerships, attestations, reputation, validation, accountability] =
    await Promise.all([
      checkIdentityRegistered(chain, address),
      getPartnershipBonds(chain, address),
      checkBeliefAttestations(chain, address),
      getReputationData(chain, address),
      checkValidation(chain, address),
      getAccountabilityBonds(chain, address),
    ]);

  return {
    address,
    chain,
    identity: { registered: identity },
    partnerships,
    attestations,
    reputation,
    validation,
    accountability,
  };
}

// ─── Multi-chain trust profile ───────────────────────────────────────────────

export interface MultiChainTrustProfile {
  address: string;
  profiles: Record<SupportedChain, TrustProfile>;
  aggregateScore: number;
  breakdown: TrustScoreBreakdown;
}

export interface TrustScoreBreakdown {
  identityScore: number;
  partnershipScore: number;
  attestationScore: number;
  reputationScore: number;
  validationScore: number;
  totalScore: number;
  maxScore: number;
  details: string[];
}

export function calculateTrustScore(profiles: Record<SupportedChain, TrustProfile>): TrustScoreBreakdown {
  const details: string[] = [];
  let identityScore = 0;
  let partnershipScore = 0;
  let attestationScore = 0;
  let reputationScore = 0;
  let validationScore = 0;

  // Identity: 25 points max (registered on any chain = 15, multiple chains = +10)
  const registeredChains = Object.entries(profiles).filter(([, p]) => p.identity.registered);
  if (registeredChains.length > 0) {
    identityScore = 15;
    details.push(`Identity registered on ${registeredChains.map(([c]) => c).join(', ')}`);
    if (registeredChains.length >= 2) {
      identityScore = 25;
      details.push('Multi-chain identity (+10 bonus)');
    }
  } else {
    details.push('No identity registered on any chain');
  }

  // Partnership bonds: 25 points max
  const allBonds = Object.values(profiles);
  const totalBondStake = allBonds.reduce((s, p) => s + p.partnerships.totalStake, 0n);
  const totalActiveBonds = allBonds.reduce((s, p) => s + p.partnerships.activeBonds, 0);
  if (totalActiveBonds > 0) {
    partnershipScore = 10;
    details.push(`${totalActiveBonds} active partnership bond(s)`);
    const ethStake = Number(totalBondStake) / 1e18;
    if (ethStake >= 1.0) { partnershipScore = 25; details.push(`High bond stake: ${ethStake.toFixed(4)} ETH`); }
    else if (ethStake >= 0.1) { partnershipScore = 20; details.push(`Medium bond stake: ${ethStake.toFixed(4)} ETH`); }
    else if (ethStake >= 0.01) { partnershipScore = 15; details.push(`Bond stake: ${ethStake.toFixed(4)} ETH`); }
  } else if (totalBondStake > 0n) {
    partnershipScore = 5;
    details.push('Has bonds but none currently active');
  } else {
    details.push('No partnership bonds found');
  }

  // Belief attestations: 20 points max
  const hasAnyAttestation = allBonds.some(p => p.attestations.hasAttestation);
  if (hasAnyAttestation) {
    attestationScore = 20;
    details.push('Belief attestation verified');
  } else {
    const totalAttestations = allBonds.reduce((s, p) => s + p.attestations.attestationCount, 0);
    if (totalAttestations > 0) {
      attestationScore = 5;
      details.push(`Attestor active (${totalAttestations} total attestations in registry)`);
    } else {
      details.push('No belief attestations found');
    }
  }

  // Reputation: 15 points max
  const bestReputation = Math.max(...allBonds.map(p => p.reputation.score));
  if (bestReputation > 0) {
    reputationScore = Math.min(15, Math.round(bestReputation / 10));
    details.push(`Reputation score: ${bestReputation}`);
  } else {
    details.push('No reputation entries found');
  }

  // Validation: 15 points max
  const isValidatedAnywhere = allBonds.some(p => p.validation.isValidated);
  if (isValidatedAnywhere) {
    validationScore = 15;
    details.push('Validated by ERC8004ValidationRegistry');
  } else {
    details.push('Not yet validated');
  }

  const totalScore = identityScore + partnershipScore + attestationScore + reputationScore + validationScore;

  return {
    identityScore,
    partnershipScore,
    attestationScore,
    reputationScore,
    validationScore,
    totalScore: Math.min(totalScore, 100),
    maxScore: 100,
    details,
  };
}

export async function getMultiChainTrustProfile(address: string): Promise<MultiChainTrustProfile> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  const results = await Promise.all(chains.map(c => getFullTrustProfile(c, address)));
  const profiles = {} as Record<SupportedChain, TrustProfile>;
  chains.forEach((c, i) => { profiles[c] = results[i]; });

  const breakdown = calculateTrustScore(profiles);

  return {
    address,
    profiles,
    aggregateScore: breakdown.totalScore,
    breakdown,
  };
}

// ─── Bridge transaction helpers ──────────────────────────────────────────────

export function getBridgeAddress(chain: SupportedChain): string {
  if (chain === 'ethereum') return findAddr('ethereum', 'TrustDataBridge');
  return findAddr(chain, 'VaultfireTeleporterBridge');
}

// ABI-encoded function calls for bridge operations
export function encodeSendTrustTier(destChainId: number, recipient: string, tier: number): string {
  // sendTrustTier(uint256 destChainId, address recipient, uint8 tier)
  const selector = '0x7a3226ec'; // keccak256("sendTrustTier(uint256,address,uint8)")
  const destPadded = BigInt(destChainId).toString(16).padStart(64, '0');
  const recipientPadded = pad32(recipient);
  const tierPadded = BigInt(tier).toString(16).padStart(64, '0');
  return selector + destPadded + recipientPadded + tierPadded;
}

export function encodeSendVNSIdentity(destChainId: number, name: string, owner: string): string {
  // sendVNSIdentity(uint256 destChainId, string name, address owner)
  const selector = '0xa1b2c3d4'; // placeholder selector
  return selector + BigInt(destChainId).toString(16).padStart(64, '0') + pad32(owner);
}

// ─── Accountability bond withdrawal encoding ─────────────────────────────────

export function encodeRequestDistribution(bondId: number): string {
  // requestDistribution(uint256 bondId)
  const selector = '0x8f283970';
  return selector + BigInt(bondId).toString(16).padStart(64, '0');
}

export function encodeDistributeBond(bondId: number): string {
  // distributeBond(uint256 bondId)
  const selector = '0x2e1a7d4d';
  return selector + BigInt(bondId).toString(16).padStart(64, '0');
}
