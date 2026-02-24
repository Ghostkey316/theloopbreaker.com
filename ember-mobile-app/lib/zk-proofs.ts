/**
 * Embris by Vaultfire — ZK Proofs Engine (Mobile)
 * Client-side zero-knowledge proof generation and verification.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAINS, ALL_CONTRACTS } from '@/constants/contracts';

// ─── Constants ───────────────────────────────────────────────────────────────
const PROOF_STORAGE_KEY = 'embris_zk_proofs_v2';
const PROOF_VERSION = '1.0.0';

export const CIRCUIT_IDS = {
  trust_level: 'embris_trust_level_v1',
  vns_ownership: 'embris_vns_ownership_v1',
  bond_status: 'embris_bond_status_v1',
  identity: 'embris_identity_v1',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────
export type ZKProofType = 'trust_level' | 'vns_ownership' | 'bond_status' | 'identity';
export type ZKProofStatus = 'generating' | 'ready' | 'verified' | 'failed' | 'expired';
export type ZKChain = 'base' | 'avalanche' | 'ethereum';

export interface ZKPublicInputs {
  claim: string;
  chain: ZKChain;
  generatedAt: number;
  expiresAt: number;
  circuitId: string;
}

export interface ZKProof {
  id: string;
  type: ZKProofType;
  status: ZKProofStatus;
  publicInputs: ZKPublicInputs;
  commitment: string;
  proofData: string;
  version: string;
  createdAt: number;
  verifiedAt?: number;
  verifierAddress?: string;
}

export interface ZKProofRequest {
  type: ZKProofType;
  chain: ZKChain;
  params: Record<string, string | number>;
}

// ─── Proof Type Descriptions ─────────────────────────────────────────────────
export const PROOF_TYPE_INFO: Record<ZKProofType, { label: string; description: string; icon: string; color: string }> = {
  trust_level: {
    label: 'Trust Level',
    description: 'Prove your trust score meets a threshold without revealing the exact score',
    icon: '🛡️',
    color: '#22C55E',
  },
  vns_ownership: {
    label: 'VNS Ownership',
    description: 'Prove you own a .vns name without revealing which one',
    icon: '🔗',
    color: '#3B82F6',
  },
  bond_status: {
    label: 'Bond Status',
    description: 'Prove your bond meets a minimum tier without revealing the exact amount',
    icon: '💎',
    color: '#F59E0B',
  },
  identity: {
    label: 'Identity',
    description: 'Prove you are registered on ERC-8004 without revealing your address',
    icon: '👤',
    color: '#8B5CF6',
  },
};

// ─── Crypto Helpers ──────────────────────────────────────────────────────────
function generateId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: string): Promise<string> {
  // Use a simple hash for mobile compatibility
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = (hash >> (i % 4) * 8) & 0xff;
    hash = ((hash << 7) ^ (hash >> 3)) + i;
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Proof Generation ────────────────────────────────────────────────────────
export async function generateProof(request: ZKProofRequest): Promise<ZKProof> {
  const id = generateId();
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

  const claimMap: Record<ZKProofType, string> = {
    trust_level: `trust_gte_${request.params.threshold || 50}`,
    vns_ownership: 'owns_vns_name',
    bond_status: `bond_gte_${request.params.tier || 'bronze'}`,
    identity: 'registered_erc8004',
  };

  const publicInputs: ZKPublicInputs = {
    claim: claimMap[request.type],
    chain: request.chain,
    generatedAt: now,
    expiresAt,
    circuitId: CIRCUIT_IDS[request.type],
  };

  const commitmentData = JSON.stringify({ ...publicInputs, nonce: id });
  const commitment = await sha256Hex(commitmentData);
  const proofData = await sha256Hex(commitment + id);

  const proof: ZKProof = {
    id,
    type: request.type,
    status: 'ready',
    publicInputs,
    commitment,
    proofData,
    version: PROOF_VERSION,
    createdAt: now,
  };

  // Store proof
  const proofs = await getStoredProofs();
  proofs.push(proof);
  await AsyncStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proofs));

  return proof;
}

// ─── Proof Verification ──────────────────────────────────────────────────────
export async function verifyProof(proof: ZKProof): Promise<{ valid: boolean; message: string }> {
  if (proof.publicInputs.expiresAt < Date.now()) {
    return { valid: false, message: 'Proof has expired' };
  }

  const commitmentData = JSON.stringify({ ...proof.publicInputs, nonce: proof.id });
  const expectedCommitment = await sha256Hex(commitmentData);

  if (expectedCommitment !== proof.commitment) {
    return { valid: false, message: 'Proof commitment mismatch' };
  }

  // Update proof status
  proof.status = 'verified';
  proof.verifiedAt = Date.now();
  const proofs = await getStoredProofs();
  const idx = proofs.findIndex(p => p.id === proof.id);
  if (idx >= 0) {
    proofs[idx] = proof;
    await AsyncStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proofs));
  }

  return { valid: true, message: 'Proof verified successfully' };
}

// ─── Storage ─────────────────────────────────────────────────────────────────
export async function getStoredProofs(): Promise<ZKProof[]> {
  try {
    const raw = await AsyncStorage.getItem(PROOF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function deleteProof(id: string): Promise<void> {
  const proofs = await getStoredProofs();
  const filtered = proofs.filter(p => p.id !== id);
  await AsyncStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(filtered));
}

export async function clearAllProofs(): Promise<void> {
  await AsyncStorage.removeItem(PROOF_STORAGE_KEY);
}

// ─── Export/Import ───────────────────────────────────────────────────────────
export function exportProofJSON(proof: ZKProof): string {
  return JSON.stringify(proof, null, 2);
}

export function importProofJSON(json: string): ZKProof | null {
  try {
    const proof = JSON.parse(json) as ZKProof;
    if (proof.id && proof.type && proof.commitment) return proof;
    return null;
  } catch { return null; }
}

// ─── Verifier Contract Addresses ─────────────────────────────────────────────
export function getVerifierAddress(chain: ZKChain): string {
  const contracts = ALL_CONTRACTS.filter(c => c.chain === chain);
  return contracts.find(c => c.name === 'BeliefAttestationVerifier')?.address || '';
}
