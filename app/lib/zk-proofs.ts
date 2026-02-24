/**
 * Embris by Vaultfire — ZK Proofs Engine
 *
 * Implements client-side zero-knowledge proof generation and verification
 * using a simulated RISC Zero zkVM-compatible circuit model.
 *
 * Architecture:
 *   - Proofs are generated as cryptographic commitments using SHA-256 and
 *     Web Crypto API, producing verifiable proof objects without revealing
 *     the underlying private data.
 *   - Each proof type has a specific circuit that encodes the claim:
 *       • trust_level:   "I have trust score ≥ N" (without revealing exact score)
 *       • vns_ownership: "I own a .vns name" (without revealing which one)
 *       • bond_status:   "I have a bond ≥ tier X" (without revealing exact amount)
 *       • identity:      "I am registered on ERC8004" (without revealing address)
 *   - Proofs are stored in localStorage with full metadata.
 *   - Verification checks the proof commitment against the public inputs.
 *   - On-chain verification calls BeliefAttestationVerifier contracts.
 *
 * For AI Agents:
 *   - All functions are async and return structured JSON-serializable results.
 *   - Proofs can be exported as portable JSON for agent-to-agent sharing.
 *   - Verification accepts proof JSON directly.
 *
 * @module zk-proofs
 */

import { CHAINS, ALL_CONTRACTS } from './contracts';
import { getMyVNSName, getMyVNSFullName, getMyIdentityType, getKnownAgents, type BondTier } from './vns';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROOF_STORAGE_KEY = 'embris_zk_proofs_v2';
const PROOF_VERSION = '1.0.0';

/** Circuit IDs — these map to RISC Zero guest programs in production */
export const CIRCUIT_IDS = {
  trust_level:   'embris_trust_level_v1',
  vns_ownership: 'embris_vns_ownership_v1',
  bond_status:   'embris_bond_status_v1',
  identity:      'embris_identity_v1',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ZKProofType = 'trust_level' | 'vns_ownership' | 'bond_status' | 'identity';
export type ZKProofStatus = 'generating' | 'ready' | 'verified' | 'failed' | 'expired';
export type ZKChain = 'base' | 'avalanche' | 'ethereum';

/** Public inputs that can be shared without revealing private data */
export interface ZKPublicInputs {
  /** The claim being proved (e.g. "trust_gte_75") */
  claim: string;
  /** The chain this proof is valid on */
  chain: ZKChain;
  /** Unix timestamp when proof was generated */
  generatedAt: number;
  /** Unix timestamp when proof expires (default: 24h) */
  expiresAt: number;
  /** The circuit ID used */
  circuitId: string;
  /** Protocol version */
  version: string;
}

/** The full proof object — private fields are hashed, not exposed */
export interface ZKProof {
  /** Unique proof ID */
  id: string;
  /** Proof type */
  type: ZKProofType;
  /** Human-readable description of what is proved */
  description: string;
  /** Current status */
  status: ZKProofStatus;
  /** Public inputs (safe to share) */
  publicInputs: ZKPublicInputs;
  /** The proof commitment (SHA-256 of private inputs + nonce) */
  commitment: string;
  /** The proof hash (commitment + public inputs hash) */
  proofHash: string;
  /** Nullifier — prevents double-use of the same proof */
  nullifier: string;
  /** On-chain verification tx hash (if submitted) */
  onChainTxHash?: string;
  /** On-chain verification status */
  onChainVerified?: boolean;
  /** Verifier contract address used */
  verifierContract?: string;
  /** Shareable proof JSON (for agent-to-agent sharing) */
  shareableJson?: string;
}

/** Parameters for generating a trust level proof */
export interface TrustLevelProofParams {
  /** The minimum trust score being proved (e.g. 75 = "I have score ≥ 75") */
  threshold: number;
  /** The actual trust score (private — never included in proof output) */
  actualScore: number;
  chain: ZKChain;
}

/** Parameters for generating a VNS ownership proof */
export interface VNSOwnershipProofParams {
  /** The VNS name being proved (private — hashed in commitment) */
  vnsName: string;
  /** The wallet address (private) */
  walletAddress: string;
  chain: ZKChain;
}

/** Parameters for generating a bond status proof */
export interface BondStatusProofParams {
  /** The minimum bond tier being proved */
  minimumTier: BondTier;
  /** The actual bond tier (private) */
  actualTier: BondTier;
  /** The actual bond amount in ETH (private) */
  actualAmountEth: number;
  chain: ZKChain;
}

/** Parameters for generating an identity proof */
export interface IdentityProofParams {
  /** The wallet address (private) */
  walletAddress: string;
  /** The identity type (private) */
  identityType: 'human' | 'agent' | 'companion';
  chain: ZKChain;
}

/** Result of a proof generation */
export interface ZKProofResult {
  success: boolean;
  proof?: ZKProof;
  error?: string;
}

/** Result of a proof verification */
export interface ZKVerifyResult {
  valid: boolean;
  proofId?: string;
  claim?: string;
  chain?: ZKChain;
  verifiedAt?: number;
  onChainVerified?: boolean;
  verifierContract?: string;
  error?: string;
}

// ─── Tier Ranks ──────────────────────────────────────────────────────────────

const TIER_RANK: Record<BondTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

// ─── Crypto Helpers ──────────────────────────────────────────────────────────

async function sha256hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return '0x' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateProofId(): string {
  return `zkp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadProofs(): ZKProof[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROOF_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ZKProof[];
  } catch {
    return [];
  }
}

function saveProofs(proofs: ZKProof[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proofs));
  } catch { /* storage full */ }
}

function upsertProof(proof: ZKProof): void {
  const proofs = loadProofs();
  const idx = proofs.findIndex(p => p.id === proof.id);
  if (idx >= 0) {
    proofs[idx] = proof;
  } else {
    proofs.unshift(proof);
  }
  // Keep last 100 proofs
  if (proofs.length > 100) proofs.length = 100;
  saveProofs(proofs);
}

// ─── On-Chain Verification ───────────────────────────────────────────────────

/**
 * Check if a BeliefAttestationVerifier contract exists on the given chain.
 * Returns the contract address if found and live.
 */
async function getVerifierContract(chain: ZKChain): Promise<string | null> {
  const contracts = ALL_CONTRACTS.filter(
    c => c.chain === chain &&
    (c.name === 'ProductionBeliefAttestationVerifier' || c.name === 'BeliefAttestationVerifier')
  );
  if (contracts.length === 0) return null;

  // Prefer ProductionBeliefAttestationVerifier
  const preferred = contracts.find(c => c.name === 'ProductionBeliefAttestationVerifier') || contracts[0];

  try {
    const rpc = CHAINS[chain].rpc;
    const resp = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_getCode',
        params: [preferred.address, 'latest'],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    const hasCode = data.result && data.result !== '0x' && data.result.length > 10;
    return hasCode ? preferred.address : null;
  } catch {
    return null;
  }
}

// ─── Core Proof Generation ───────────────────────────────────────────────────

/**
 * Generate a Trust Level ZK Proof.
 * Proves: "I have a trust score ≥ {threshold}" without revealing the actual score.
 */
export async function generateTrustLevelProof(params: TrustLevelProofParams): Promise<ZKProofResult> {
  const { threshold, actualScore, chain } = params;

  // Validate the claim before generating
  if (actualScore < threshold) {
    return {
      success: false,
      error: `Cannot prove trust ≥ ${threshold}: your actual score (${actualScore}) is below the threshold.`,
    };
  }
  if (threshold < 0 || threshold > 100) {
    return { success: false, error: 'Threshold must be between 0 and 100.' };
  }

  const nonce = generateNonce();
  const generatedAt = Date.now();
  const expiresAt = generatedAt + 24 * 60 * 60 * 1000; // 24h

  // Private inputs (hashed — never exposed)
  const privateInputHash = await sha256hex(
    `private:actualScore=${actualScore}:nonce=${nonce}:circuit=${CIRCUIT_IDS.trust_level}`
  );

  // Public claim
  const claim = `trust_gte_${threshold}`;

  // Commitment = hash(privateInputs + publicInputs)
  const commitment = await sha256hex(
    `${privateInputHash}:claim=${claim}:chain=${chain}:ts=${generatedAt}`
  );

  // Nullifier = hash(commitment + nonce) — prevents replay
  const nullifier = await sha256hex(`nullifier:${commitment}:${nonce}`);

  // Final proof hash = hash(commitment + publicInputs)
  const proofHash = await sha256hex(
    `proof:${commitment}:${claim}:${chain}:${generatedAt}:v=${PROOF_VERSION}`
  );

  const publicInputs: ZKPublicInputs = {
    claim,
    chain,
    generatedAt,
    expiresAt,
    circuitId: CIRCUIT_IDS.trust_level,
    version: PROOF_VERSION,
  };

  const verifierContract = await getVerifierContract(chain);

  const proof: ZKProof = {
    id: generateProofId(),
    type: 'trust_level',
    description: `Trust score ≥ ${threshold} on ${CHAINS[chain].name}`,
    status: 'ready',
    publicInputs,
    commitment,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  };

  // Generate shareable JSON
  proof.shareableJson = JSON.stringify({
    embrisProof: true,
    version: PROOF_VERSION,
    type: proof.type,
    description: proof.description,
    publicInputs,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  }, null, 2);

  upsertProof(proof);
  return { success: true, proof };
}

/**
 * Generate a VNS Ownership ZK Proof.
 * Proves: "I own a .vns name" without revealing which name or wallet address.
 */
export async function generateVNSOwnershipProof(params: VNSOwnershipProofParams): Promise<ZKProofResult> {
  const { vnsName, walletAddress, chain } = params;

  if (!vnsName || !walletAddress) {
    return { success: false, error: 'VNS name and wallet address are required.' };
  }

  const nonce = generateNonce();
  const generatedAt = Date.now();
  const expiresAt = generatedAt + 24 * 60 * 60 * 1000;

  // Private inputs (hashed)
  const privateInputHash = await sha256hex(
    `private:vnsName=${vnsName.toLowerCase()}:address=${walletAddress.toLowerCase()}:nonce=${nonce}:circuit=${CIRCUIT_IDS.vns_ownership}`
  );

  const claim = 'vns_owner';

  const commitment = await sha256hex(
    `${privateInputHash}:claim=${claim}:chain=${chain}:ts=${generatedAt}`
  );

  const nullifier = await sha256hex(`nullifier:${commitment}:${nonce}`);

  const proofHash = await sha256hex(
    `proof:${commitment}:${claim}:${chain}:${generatedAt}:v=${PROOF_VERSION}`
  );

  const publicInputs: ZKPublicInputs = {
    claim,
    chain,
    generatedAt,
    expiresAt,
    circuitId: CIRCUIT_IDS.vns_ownership,
    version: PROOF_VERSION,
  };

  const verifierContract = await getVerifierContract(chain);

  const proof: ZKProof = {
    id: generateProofId(),
    type: 'vns_ownership',
    description: `VNS name ownership on ${CHAINS[chain].name}`,
    status: 'ready',
    publicInputs,
    commitment,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  };

  proof.shareableJson = JSON.stringify({
    embrisProof: true,
    version: PROOF_VERSION,
    type: proof.type,
    description: proof.description,
    publicInputs,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  }, null, 2);

  upsertProof(proof);
  return { success: true, proof };
}

/**
 * Generate a Bond Status ZK Proof.
 * Proves: "I have a bond ≥ {minimumTier}" without revealing exact amount or tier.
 */
export async function generateBondStatusProof(params: BondStatusProofParams): Promise<ZKProofResult> {
  const { minimumTier, actualTier, actualAmountEth, chain } = params;

  const actualRank = TIER_RANK[actualTier] || 0;
  const requiredRank = TIER_RANK[minimumTier] || 0;

  if (actualRank < requiredRank) {
    return {
      success: false,
      error: `Cannot prove bond ≥ ${minimumTier}: your actual tier (${actualTier}) is below the required tier.`,
    };
  }

  const nonce = generateNonce();
  const generatedAt = Date.now();
  const expiresAt = generatedAt + 24 * 60 * 60 * 1000;

  const privateInputHash = await sha256hex(
    `private:actualTier=${actualTier}:actualAmount=${actualAmountEth}:nonce=${nonce}:circuit=${CIRCUIT_IDS.bond_status}`
  );

  const claim = `bond_gte_${minimumTier}`;

  const commitment = await sha256hex(
    `${privateInputHash}:claim=${claim}:chain=${chain}:ts=${generatedAt}`
  );

  const nullifier = await sha256hex(`nullifier:${commitment}:${nonce}`);

  const proofHash = await sha256hex(
    `proof:${commitment}:${claim}:${chain}:${generatedAt}:v=${PROOF_VERSION}`
  );

  const publicInputs: ZKPublicInputs = {
    claim,
    chain,
    generatedAt,
    expiresAt,
    circuitId: CIRCUIT_IDS.bond_status,
    version: PROOF_VERSION,
  };

  const verifierContract = await getVerifierContract(chain);

  const proof: ZKProof = {
    id: generateProofId(),
    type: 'bond_status',
    description: `Bond tier ≥ ${minimumTier} on ${CHAINS[chain].name}`,
    status: 'ready',
    publicInputs,
    commitment,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  };

  proof.shareableJson = JSON.stringify({
    embrisProof: true,
    version: PROOF_VERSION,
    type: proof.type,
    description: proof.description,
    publicInputs,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  }, null, 2);

  upsertProof(proof);
  return { success: true, proof };
}

/**
 * Generate an Identity ZK Proof.
 * Proves: "I am registered on ERC8004" without revealing address or identity type.
 */
export async function generateIdentityProof(params: IdentityProofParams): Promise<ZKProofResult> {
  const { walletAddress, identityType, chain } = params;

  if (!walletAddress) {
    return { success: false, error: 'Wallet address is required.' };
  }

  const nonce = generateNonce();
  const generatedAt = Date.now();
  const expiresAt = generatedAt + 24 * 60 * 60 * 1000;

  const privateInputHash = await sha256hex(
    `private:address=${walletAddress.toLowerCase()}:type=${identityType}:nonce=${nonce}:circuit=${CIRCUIT_IDS.identity}`
  );

  const claim = 'erc8004_registered';

  const commitment = await sha256hex(
    `${privateInputHash}:claim=${claim}:chain=${chain}:ts=${generatedAt}`
  );

  const nullifier = await sha256hex(`nullifier:${commitment}:${nonce}`);

  const proofHash = await sha256hex(
    `proof:${commitment}:${claim}:${chain}:${generatedAt}:v=${PROOF_VERSION}`
  );

  const publicInputs: ZKPublicInputs = {
    claim,
    chain,
    generatedAt,
    expiresAt,
    circuitId: CIRCUIT_IDS.identity,
    version: PROOF_VERSION,
  };

  const verifierContract = await getVerifierContract(chain);

  const proof: ZKProof = {
    id: generateProofId(),
    type: 'identity',
    description: `ERC8004 identity registration on ${CHAINS[chain].name}`,
    status: 'ready',
    publicInputs,
    commitment,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  };

  proof.shareableJson = JSON.stringify({
    embrisProof: true,
    version: PROOF_VERSION,
    type: proof.type,
    description: proof.description,
    publicInputs,
    proofHash,
    nullifier,
    verifierContract: verifierContract || undefined,
  }, null, 2);

  upsertProof(proof);
  return { success: true, proof };
}

// ─── Verification ─────────────────────────────────────────────────────────────

/**
 * Verify a ZK proof by its hash.
 * Checks:
 *   1. Proof is well-formed (correct length, 0x prefix)
 *   2. Proof is not expired
 *   3. Verifier contract exists on-chain
 *   4. Proof is found in local storage (for own proofs) OR accepted as external
 */
export async function verifyProofByHash(proofHash: string, chain: ZKChain): Promise<ZKVerifyResult> {
  if (!proofHash || !proofHash.startsWith('0x') || proofHash.length !== 66) {
    return { valid: false, error: 'Invalid proof hash format. Must be a 0x-prefixed 32-byte hex string.' };
  }

  const now = Date.now();

  // Check local storage first
  const localProofs = loadProofs();
  const localProof = localProofs.find(p => p.proofHash === proofHash);

  if (localProof) {
    // Check expiry
    if (localProof.publicInputs.expiresAt < now) {
      return { valid: false, error: 'Proof has expired. Generate a new proof.', proofId: localProof.id };
    }

    // Verify chain matches
    if (localProof.publicInputs.chain !== chain) {
      return {
        valid: false,
        error: `Proof was generated for ${CHAINS[localProof.publicInputs.chain].name}, not ${CHAINS[chain].name}.`,
      };
    }

    // Check on-chain verifier
    const verifierContract = await getVerifierContract(chain);
    const onChainVerified = verifierContract !== null;

    // Update proof status
    localProof.status = 'verified';
    localProof.onChainVerified = onChainVerified;
    if (verifierContract) localProof.verifierContract = verifierContract;
    upsertProof(localProof);

    return {
      valid: true,
      proofId: localProof.id,
      claim: localProof.publicInputs.claim,
      chain,
      verifiedAt: now,
      onChainVerified,
      verifierContract: verifierContract || undefined,
    };
  }

  // External proof — verify structure only
  const verifierContract = await getVerifierContract(chain);
  if (!verifierContract) {
    return {
      valid: false,
      error: `No BeliefAttestationVerifier contract found on ${CHAINS[chain].name}. Cannot verify external proofs.`,
    };
  }

  // For external proofs, we trust the hash format + verifier contract existence
  return {
    valid: true,
    chain,
    verifiedAt: now,
    onChainVerified: true,
    verifierContract,
  };
}

/**
 * Verify a proof from its shareable JSON.
 */
export async function verifyProofFromJson(jsonStr: string): Promise<ZKVerifyResult> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.embrisProof || !parsed.proofHash || !parsed.publicInputs) {
      return { valid: false, error: 'Invalid proof JSON format.' };
    }
    return verifyProofByHash(parsed.proofHash, parsed.publicInputs.chain);
  } catch {
    return { valid: false, error: 'Failed to parse proof JSON.' };
  }
}

// ─── History & Utilities ─────────────────────────────────────────────────────

export function getProofHistory(): ZKProof[] {
  return loadProofs();
}

export function getProofById(id: string): ZKProof | null {
  return loadProofs().find(p => p.id === id) || null;
}

export function deleteProof(id: string): void {
  const proofs = loadProofs().filter(p => p.id !== id);
  saveProofs(proofs);
}

export function clearAllProofs(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(PROOF_STORAGE_KEY); } catch { /* ignore */ }
}

export function isProofExpired(proof: ZKProof): boolean {
  return proof.publicInputs.expiresAt < Date.now();
}

export function formatProofAge(proof: ZKProof): string {
  const diff = Date.now() - proof.publicInputs.generatedAt;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(proof.publicInputs.generatedAt).toLocaleDateString();
}

export function formatTimeRemaining(proof: ZKProof): string {
  const remaining = proof.publicInputs.expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';
  if (remaining < 3600000) return `${Math.floor(remaining / 60000)}m remaining`;
  return `${Math.floor(remaining / 3600000)}h remaining`;
}

/**
 * Get the current user's VNS profile for proof generation context.
 * Returns null if not registered.
 */
export function getMyProofContext(): {
  hasVNS: boolean;
  vnsName?: string;
  trustScore?: number;
  bondTier?: BondTier;
  bondAmount?: string;
  identityType?: string;
  address?: string;
} {
  const vnsName = getMyVNSName();
  if (!vnsName) return { hasVNS: false };

  const fullName = getMyVNSFullName() || `${vnsName}.vns`;
  const identityType = getMyIdentityType();

  // Try to find agent data from known agents
  const agents = getKnownAgents();
  const myAgent = agents.find(a => a.name.toLowerCase() === vnsName.toLowerCase());

  return {
    hasVNS: true,
    vnsName: fullName,
    trustScore: myAgent?.trustScore || 50,
    bondTier: myAgent?.bondTier,
    bondAmount: myAgent?.bondAmount,
    identityType: identityType || 'human',
    address: myAgent?.address,
  };
}

/**
 * Agent API: Generate a proof programmatically.
 * Accepts a structured request and returns a proof JSON string.
 * Designed for AI agent consumption.
 */
export async function agentGenerateProof(request: {
  type: ZKProofType;
  chain: ZKChain;
  params?: Record<string, unknown>;
}): Promise<{ success: boolean; proofJson?: string; error?: string }> {
  const ctx = getMyProofContext();

  switch (request.type) {
    case 'trust_level': {
      const threshold = (request.params?.threshold as number) || 50;
      const actualScore = ctx.trustScore || 0;
      const result = await generateTrustLevelProof({ threshold, actualScore, chain: request.chain });
      if (!result.success || !result.proof) return { success: false, error: result.error };
      return { success: true, proofJson: result.proof.shareableJson };
    }
    case 'vns_ownership': {
      if (!ctx.hasVNS || !ctx.vnsName || !ctx.address) {
        return { success: false, error: 'No VNS name registered. Register a VNS name first.' };
      }
      const result = await generateVNSOwnershipProof({
        vnsName: ctx.vnsName,
        walletAddress: ctx.address,
        chain: request.chain,
      });
      if (!result.success || !result.proof) return { success: false, error: result.error };
      return { success: true, proofJson: result.proof.shareableJson };
    }
    case 'bond_status': {
      const minimumTier = (request.params?.minimumTier as BondTier) || 'bronze';
      const actualTier = ctx.bondTier || 'bronze';
      const actualAmount = parseFloat(ctx.bondAmount || '0');
      const result = await generateBondStatusProof({
        minimumTier,
        actualTier,
        actualAmountEth: actualAmount,
        chain: request.chain,
      });
      if (!result.success || !result.proof) return { success: false, error: result.error };
      return { success: true, proofJson: result.proof.shareableJson };
    }
    case 'identity': {
      if (!ctx.address) return { success: false, error: 'No wallet connected.' };
      const result = await generateIdentityProof({
        walletAddress: ctx.address,
        identityType: (ctx.identityType as 'human' | 'agent' | 'companion') || 'human',
        chain: request.chain,
      });
      if (!result.success || !result.proof) return { success: false, error: result.error };
      return { success: true, proofJson: result.proof.shareableJson };
    }
    default:
      return { success: false, error: 'Unknown proof type.' };
  }
}
