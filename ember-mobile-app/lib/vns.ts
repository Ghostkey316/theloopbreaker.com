/**
 * Embris by Vaultfire — VNS (Vaultfire Naming System) for Mobile
 * Register and manage .vns names on-chain.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS } from '@/constants/contracts';

// ─── Types ───────────────────────────────────────────────────────────────────
export type IdentityType = 'human' | 'agent';
export type BondTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type SupportedChain = 'base' | 'avalanche' | 'ethereum';

export interface VNSProfile {
  name: string;
  fullName: string;
  address: string;
  identityType: IdentityType;
  chain: SupportedChain;
  bondTier: BondTier;
  bondAmount: string;
  registeredAt: number;
  trustScore: number;
  isVerified: boolean;
}

export interface KnownAgent {
  name: string;
  address: string;
  identityType: IdentityType;
  chain: SupportedChain;
  bondTier: BondTier;
  trustScore: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const VNS_STORAGE_KEY = 'embris_vns_profile';
const VNS_AGENTS_KEY = 'embris_vns_known_agents';
const VNS_SUFFIX = '.vns';

export const BOND_TIERS: { tier: BondTier; label: string; color: string; minBond: string; icon: string }[] = [
  { tier: 'none', label: 'Unverified', color: '#71717A', minBond: '0', icon: '○' },
  { tier: 'bronze', label: 'Bronze', color: '#CD7F32', minBond: '0.01', icon: '◉' },
  { tier: 'silver', label: 'Silver', color: '#C0C0C0', minBond: '0.05', icon: '◈' },
  { tier: 'gold', label: 'Gold', color: '#FFD700', minBond: '0.1', icon: '★' },
  { tier: 'platinum', label: 'Platinum', color: '#E5E4E2', minBond: '0.5', icon: '◆' },
];

export function getBondTierInfo(tier: BondTier) {
  return BOND_TIERS.find(t => t.tier === tier) || BOND_TIERS[0];
}

export function getBondTier(bondAmount: number): BondTier {
  if (bondAmount >= 0.5) return 'platinum';
  if (bondAmount >= 0.1) return 'gold';
  if (bondAmount >= 0.05) return 'silver';
  if (bondAmount >= 0.01) return 'bronze';
  return 'none';
}

// ─── VNS Name Validation ─────────────────────────────────────────────────────
export function isValidVNSName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length < 3) return { valid: false, error: 'Name must be at least 3 characters' };
  if (name.length > 32) return { valid: false, error: 'Name must be 32 characters or less' };
  if (!/^[a-z0-9_-]+$/.test(name)) return { valid: false, error: 'Only lowercase letters, numbers, hyphens, and underscores' };
  if (name.startsWith('-') || name.endsWith('-')) return { valid: false, error: 'Cannot start or end with a hyphen' };
  return { valid: true };
}

// ─── Profile CRUD ────────────────────────────────────────────────────────────
export async function getMyVNSProfile(): Promise<VNSProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(VNS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveMyVNSProfile(profile: VNSProfile): Promise<void> {
  await AsyncStorage.setItem(VNS_STORAGE_KEY, JSON.stringify(profile));
}

export async function getMyVNSName(): Promise<string | null> {
  const profile = await getMyVNSProfile();
  return profile?.name || null;
}

export async function getMyVNSFullName(): Promise<string | null> {
  const profile = await getMyVNSProfile();
  return profile?.fullName || null;
}

export async function getMyIdentityType(): Promise<IdentityType | null> {
  const profile = await getMyVNSProfile();
  return profile?.identityType || null;
}

// ─── Known Agents ────────────────────────────────────────────────────────────
export async function getKnownAgents(): Promise<KnownAgent[]> {
  try {
    const raw = await AsyncStorage.getItem(VNS_AGENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addKnownAgent(agent: KnownAgent): Promise<void> {
  const agents = await getKnownAgents();
  const idx = agents.findIndex(a => a.address === agent.address);
  if (idx >= 0) agents[idx] = agent;
  else agents.push(agent);
  await AsyncStorage.setItem(VNS_AGENTS_KEY, JSON.stringify(agents));
}

// ─── On-Chain Registration (simulated for mobile — actual tx via wallet) ─────
export async function registerVNSName(
  name: string,
  address: string,
  identityType: IdentityType,
  chain: SupportedChain,
): Promise<VNSProfile> {
  const fullName = `${name}${VNS_SUFFIX}`;
  const profile: VNSProfile = {
    name,
    fullName,
    address,
    identityType,
    chain,
    bondTier: 'none',
    bondAmount: '0',
    registeredAt: Date.now(),
    trustScore: 0,
    isVerified: false,
  };
  await saveMyVNSProfile(profile);
  return profile;
}

// ─── Resolve VNS Name ────────────────────────────────────────────────────────
export async function resolveVNSName(name: string): Promise<string | null> {
  const agents = await getKnownAgents();
  const agent = agents.find(a => a.name === name.replace(VNS_SUFFIX, ''));
  return agent?.address || null;
}

// ─── Contract Addresses ──────────────────────────────────────────────────────
export function getIdentityRegistryAddress(chain: SupportedChain): string {
  const contracts = chain === 'base' ? BASE_CONTRACTS : chain === 'avalanche' ? AVALANCHE_CONTRACTS : ETHEREUM_CONTRACTS;
  return contracts.find(c => c.name === 'ERC8004IdentityRegistry')?.address || '';
}

export function getBondContractAddress(chain: SupportedChain): string {
  const contracts = chain === 'base' ? BASE_CONTRACTS : chain === 'avalanche' ? AVALANCHE_CONTRACTS : ETHEREUM_CONTRACTS;
  return contracts.find(c => c.name === 'AIPartnershipBondsV2')?.address || '';
}
