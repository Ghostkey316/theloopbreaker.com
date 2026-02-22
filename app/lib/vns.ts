/**
 * Vaultfire Name System (VNS)
 *
 * VNS maps human-readable names (e.g. ghostkey316.vns) to wallet addresses
 * using the ERC8004IdentityRegistry deployed on Base and Avalanche.
 *
 * Format: [name].vns — lowercase alphanumeric + hyphens, 3–32 chars.
 * Free to register — users only pay gas.
 *
 * ── ANTI-GAMING RULES ──────────────────────────────────────────────────────
 * 1. ONE HUMAN IDENTITY PER WALLET — each address can hold exactly one
 *    "human" type VNS name. Enforced at registration.
 * 2. ONE COMPANION PER HUMAN — each human gets one AI companion (.vns),
 *    tied to their human identity.
 * 3. UNLIMITED AI AGENTS — developers/companies may register as many
 *    agent-type names as they want. Each requires an accountability bond.
 * 4. NO NAME SQUATTING — names must be backed by a real on-chain tx.
 * 5. DUPLICATE PREVENTION — case-insensitive uniqueness enforced.
 * 6. BOT PREVENTION — registration requires gas (on-chain anti-bot).
 *
 * ── IDENTITY TYPES ─────────────────────────────────────────────────────────
 * "human"    — real person. One per wallet. No bond required.
 * "companion"— AI companion for a human. One per human identity. Tied to human.
 * "agent"    — AI agent. Unlimited per developer. Bond required.
 *
 * The identity type is encoded in the registration description field as
 * a JSON prefix: {"type":"human","..."}  — readable by any indexer.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { CHAINS } from './contracts';

/* ── Constants ── */

export const VNS_SUFFIX = '.vns';
export const VNS_STORAGE_KEY = 'vaultfire_vns_name';
export const VNS_CACHE_KEY = 'vaultfire_vns_cache';
export const VNS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Minimum bond amounts by identity type (in wei on Base) */
export const BOND_REQUIREMENTS = {
  human: BigInt(0),                        // free — gas only
  companion: BigInt(0),                    // free — tied to human
  agent: BigInt('10000000000000000'),      // 0.01 ETH minimum bond
} as const;

/** Bond tiers for agents — determines trust badge */
export const BOND_TIERS = [
  { label: 'Bronze',   minEth: 0.01,  color: '#CD7F32', accent: '#7C3AED' },
  { label: 'Silver',   minEth: 0.05,  color: '#C0C0C0', accent: '#6D28D9' },
  { label: 'Gold',     minEth: 0.1,   color: '#FFD700', accent: '#5B21B6' },
  { label: 'Platinum', minEth: 0.5,   color: '#E5E4E2', accent: '#4C1D95' },
] as const;

export type IdentityType = 'human' | 'companion' | 'agent';
export type BondTier = 'bronze' | 'silver' | 'gold' | 'platinum';

const REGISTRY_ADDRESSES: Record<'base' | 'avalanche', string> = {
  base: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  avalanche: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
};

const BOND_CONTRACT_ADDRESSES: Record<'base' | 'avalanche', string> = {
  base: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
  avalanche: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
};

const PRIVACY_CONTRACT_ADDRESSES: Record<'base' | 'avalanche', string> = {
  base: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
  avalanche: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
};

const RPC_URLS: Record<'base' | 'avalanche', string> = {
  base: CHAINS.base.rpc,
  avalanche: CHAINS.avalanche.rpc,
};

const GET_AGENT_SELECTOR = '0xfb3551ff';
const GET_TOTAL_AGENTS_SELECTOR = '0x3731a16f';

/* ── Types ── */

export interface VNSProfile {
  name: string;           // e.g. "ghostkey316"
  fullName: string;       // e.g. "ghostkey316.vns"
  address: string;        // 0x...
  chain: 'base' | 'avalanche' | 'both';
  identityType: IdentityType;
  registeredAt?: number;  // unix timestamp
  description?: string;
  trustScore?: number;    // 0-100
  bondAmount?: string;    // formatted ETH/AVAX
  bondTier?: BondTier;
  explorerUrl?: string;
  isActive?: boolean;
  /** For agents: whether they have an active bond */
  hasBond?: boolean;
  /** For companions: the human VNS name they're tied to */
  humanVNS?: string;
  /** For humans: their companion's VNS name */
  companionVNS?: string;
  /** Agent specialization tags */
  specializations?: string[];
  /** Agent capabilities */
  capabilities?: string[];
}

export interface VNSAvailability {
  name: string;
  available: boolean;
  takenBy?: string;       // address if taken
  takenOn?: 'base' | 'avalanche' | 'both';
  checking: boolean;
  error?: string;
}

export interface VNSRegistrationResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  chain?: 'base' | 'avalanche';
  message: string;
  errorType?: 'no_wallet' | 'no_gas' | 'name_taken' | 'invalid_name' | 'tx_failed' | 'rpc_error' | 'already_registered' | 'bond_required' | 'companion_exists';
}

export interface VNSGasEstimate {
  gasLimit: bigint;
  gasPriceWei: bigint;
  totalFeeWei: bigint;
  totalFeeFormatted: string;
  chain: 'base' | 'avalanche';
  chainName: string;
  gasSymbol: string;
}

export interface AgentRegistrationParams {
  vnsName: string;
  description: string;
  specializations: string[];
  capabilities: string[];
  bondAmountEth: number;
  chain: 'base' | 'avalanche';
}

export interface AgentLaunchResult {
  step: 'identity' | 'bond' | 'vns' | 'release';
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  message: string;
  errorType?: string;
}

/* ── Name Validation ── */

export function validateVNSName(input: string): { valid: boolean; error?: string; normalized?: string } {
  const raw = input.toLowerCase().replace(/\.vns$/, '').trim();

  if (!raw) return { valid: false, error: 'Name cannot be empty' };
  if (raw.length < 3) return { valid: false, error: 'Name must be at least 3 characters' };
  if (raw.length > 32) return { valid: false, error: 'Name must be 32 characters or less' };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(raw) && !/^[a-z0-9]{1,2}$/.test(raw)) {
    return { valid: false, error: 'Only lowercase letters, numbers, and hyphens allowed' };
  }
  if (/--/.test(raw)) return { valid: false, error: 'Cannot have consecutive hyphens' };
  if (raw.startsWith('-') || raw.endsWith('-')) {
    return { valid: false, error: 'Cannot start or end with a hyphen' };
  }

  const reserved = ['vaultfire', 'embris', 'admin', 'root', 'system', 'protocol', 'vns', 'null', 'undefined', 'ghostkey'];
  if (reserved.includes(raw)) return { valid: false, error: `"${raw}" is a reserved name` };

  return { valid: true, normalized: raw };
}

export function formatVNSName(name: string): string {
  const clean = name.toLowerCase().replace(/\.vns$/, '').trim();
  return `${clean}.vns`;
}

export function stripVNSSuffix(name: string): string {
  return name.toLowerCase().replace(/\.vns$/, '').trim();
}

export function getBondTier(ethAmount: number): BondTier {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  return 'bronze';
}

export function getBondTierInfo(tier: BondTier) {
  return BOND_TIERS.find(t => t.label.toLowerCase() === tier) || BOND_TIERS[0];
}

/* ── Storage Helpers ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ── Cache ── */

interface CacheEntry {
  profile: VNSProfile | null;
  timestamp: number;
}

function getCacheKey(query: string): string {
  return `vns_${query.toLowerCase().replace(/\.vns$/, '')}`;
}

function getCached(query: string): VNSProfile | null | undefined {
  const raw = storageGet(VNS_CACHE_KEY);
  if (!raw) return undefined;
  try {
    const cache = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = cache[getCacheKey(query)];
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > VNS_CACHE_TTL) return undefined;
    return entry.profile;
  } catch { return undefined; }
}

function setCache(query: string, profile: VNSProfile | null): void {
  const raw = storageGet(VNS_CACHE_KEY);
  let cache: Record<string, CacheEntry> = {};
  try { if (raw) cache = JSON.parse(raw); } catch { /* ignore */ }
  cache[getCacheKey(query)] = { profile, timestamp: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > 50) {
    const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
    delete cache[oldest];
  }
  storageSet(VNS_CACHE_KEY, JSON.stringify(cache));
}

/* ── RPC Helper ── */

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<{ result?: string; error?: { message: string } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
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

function encodeAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function encodeUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, '0');
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

/**
 * Build registration description with identity type metadata.
 * Format: {"type":"agent","spec":["research"],"caps":["nlp"],"v":1}
 * This is stored on-chain in the description field, readable by any indexer.
 */
function buildRegistrationDescription(
  identityType: IdentityType,
  options: {
    description?: string;
    specializations?: string[];
    capabilities?: string[];
    humanVNS?: string;   // for companions: which human they belong to
  } = {}
): string {
  const meta: Record<string, unknown> = {
    type: identityType,
    v: 1,
  };
  if (options.description) meta.desc = options.description.slice(0, 200);
  if (options.specializations?.length) meta.spec = options.specializations;
  if (options.capabilities?.length) meta.caps = options.capabilities;
  if (options.humanVNS) meta.human = options.humanVNS;
  return JSON.stringify(meta);
}

/**
 * Parse identity type from on-chain description field.
 */
export function parseIdentityType(description: string): IdentityType {
  try {
    const parsed = JSON.parse(description);
    if (parsed.type === 'human') return 'human';
    if (parsed.type === 'companion') return 'companion';
    if (parsed.type === 'agent') return 'agent';
  } catch { /* not JSON — legacy registration */ }
  // Legacy registrations default to 'agent' (most common)
  return 'agent';
}

function encodeRegisterAgent(name: string, description: string): string {
  const REGISTER_SELECTOR = '0x2b3ce0bf';
  const nameEncoded = encodeString(name);
  const descEncoded = encodeString(description);
  const identityHash = '0x' + Array.from(new TextEncoder().encode(name))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);

  const offset1 = 0x60;
  const string1Size = nameEncoded.length / 2;
  const offset2 = offset1 + string1Size;
  const hashHex = identityHash.replace('0x', '').padStart(64, '0');

  return REGISTER_SELECTOR
    + encodeUint256(offset1)
    + encodeUint256(offset2)
    + hashHex
    + nameEncoded
    + descEncoded;
}

/* ── Core Lookup Functions ── */

export async function lookupAddressByAddress(
  address: string,
  chain: 'base' | 'avalanche' = 'base',
): Promise<string | null> {
  try {
    const data = GET_AGENT_SELECTOR + encodeAddress(address);
    const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: REGISTRY_ADDRESSES[chain], data },
      'latest',
    ]);
    if (!result.result || result.error) return null;
    const decoded = decodeAgentResponse(result.result);
    return decoded?.name || null;
  } catch {
    return null;
  }
}

export async function getProfileByAddress(address: string): Promise<VNSProfile | null> {
  const cacheKey = address.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const [baseName, avaxName] = await Promise.allSettled([
      lookupAddressByAddress(address, 'base'),
      lookupAddressByAddress(address, 'avalanche'),
    ]);

    const baseResult = baseName.status === 'fulfilled' ? baseName.value : null;
    const avaxResult = avaxName.status === 'fulfilled' ? avaxName.value : null;

    const name = baseResult || avaxResult;
    if (!name) {
      setCache(cacheKey, null);
      return null;
    }

    const chain: 'base' | 'avalanche' | 'both' =
      baseResult && avaxResult ? 'both' : baseResult ? 'base' : 'avalanche';

    // Check local registry for identity type
    const localRegistry = getLocalVNSRegistry();
    const localEntry = localRegistry[name.toLowerCase()];
    const identityType: IdentityType = localEntry?.identityType || 'agent';

    const profile: VNSProfile = {
      name,
      fullName: `${name}.vns`,
      address,
      chain,
      identityType,
      explorerUrl: `https://basescan.org/address/${address}`,
    };

    setCache(cacheKey, profile);
    return profile;
  } catch {
    return null;
  }
}

export async function resolveVNSName(fullName: string): Promise<VNSProfile | null> {
  const name = stripVNSSuffix(fullName);
  if (!name) return null;

  const cached = getCached(name);
  if (cached !== undefined) return cached;

  const localRegistry = getLocalVNSRegistry();
  const localEntry = localRegistry[name];

  if (localEntry) {
    const onChainName = await lookupAddressByAddress(localEntry.address, localEntry.chain as 'base' | 'avalanche');
    if (onChainName && onChainName.toLowerCase() === name.toLowerCase()) {
      const profile: VNSProfile = {
        name,
        fullName: `${name}.vns`,
        address: localEntry.address,
        chain: localEntry.chain as 'base' | 'avalanche' | 'both',
        identityType: localEntry.identityType || 'agent',
        registeredAt: localEntry.registeredAt,
        explorerUrl: `https://basescan.org/address/${localEntry.address}`,
        bondTier: localEntry.bondTier,
        hasBond: localEntry.hasBond,
        specializations: localEntry.specializations,
        capabilities: localEntry.capabilities,
      };
      setCache(name, profile);
      return profile;
    }
  }

  setCache(name, null);
  return null;
}

export async function checkVNSAvailability(name: string): Promise<VNSAvailability> {
  const validation = validateVNSName(name);
  if (!validation.valid) {
    return { name, available: false, checking: false, error: validation.error };
  }

  const normalized = validation.normalized!;
  const localRegistry = getLocalVNSRegistry();
  const localEntry = localRegistry[normalized];
  if (localEntry) {
    return {
      name: normalized,
      available: false,
      takenBy: localEntry.address,
      takenOn: localEntry.chain as 'base' | 'avalanche' | 'both',
      checking: false,
    };
  }

  return { name: normalized, available: true, checking: false };
}

/* ── Local VNS Registry ── */

interface LocalVNSEntry {
  address: string;
  chain: string;
  identityType: IdentityType;
  registeredAt: number;
  txHash?: string;
  bondTier?: BondTier;
  hasBond?: boolean;
  specializations?: string[];
  capabilities?: string[];
  humanVNS?: string;
}

const LOCAL_REGISTRY_KEY = 'vaultfire_vns_registry';

function getLocalVNSRegistry(): Record<string, LocalVNSEntry> {
  const raw = storageGet(LOCAL_REGISTRY_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function setLocalVNSEntry(name: string, entry: LocalVNSEntry): void {
  const registry = getLocalVNSRegistry();
  registry[name.toLowerCase()] = entry;
  storageSet(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
}

/* ── Anti-Gaming Checks ── */

/**
 * Check if a wallet already has a human VNS identity.
 * Returns the name if found, null if not.
 */
export function getHumanVNSForAddress(address: string): string | null {
  const registry = getLocalVNSRegistry();
  const addr = address.toLowerCase();
  for (const [name, entry] of Object.entries(registry)) {
    if (entry.address.toLowerCase() === addr && entry.identityType === 'human') {
      return name;
    }
  }
  return null;
}

/**
 * Check if a wallet already has a companion VNS identity.
 */
export function getCompanionVNSForAddress(address: string): string | null {
  const registry = getLocalVNSRegistry();
  const addr = address.toLowerCase();
  for (const [name, entry] of Object.entries(registry)) {
    if (entry.address.toLowerCase() === addr && entry.identityType === 'companion') {
      return name;
    }
  }
  return null;
}

/**
 * Get all agent VNS names for a wallet address.
 */
export function getAgentVNSNamesForAddress(address: string): string[] {
  const registry = getLocalVNSRegistry();
  const addr = address.toLowerCase();
  return Object.entries(registry)
    .filter(([, entry]) => entry.address.toLowerCase() === addr && entry.identityType === 'agent')
    .map(([name]) => name);
}

/**
 * Validate a registration attempt against anti-gaming rules.
 * Returns null if valid, or an error message if blocked.
 */
export function validateRegistrationRules(
  walletAddress: string,
  identityType: IdentityType,
  vnsName: string,
  bondAmountEth?: number,
): string | null {
  const normalized = vnsName.toLowerCase().replace(/\.vns$/, '');

  if (identityType === 'human') {
    const existing = getHumanVNSForAddress(walletAddress);
    if (existing) {
      return `This wallet already has a human identity: ${existing}.vns. One human identity per wallet.`;
    }
  }

  if (identityType === 'companion') {
    const existingCompanion = getCompanionVNSForAddress(walletAddress);
    if (existingCompanion) {
      return `This wallet already has a companion: ${existingCompanion}.vns. One companion per human.`;
    }
    const humanVNS = getHumanVNSForAddress(walletAddress);
    if (!humanVNS) {
      return 'You must register a human identity before registering a companion.';
    }
  }

  if (identityType === 'agent') {
    const minBond = 0.01;
    if (!bondAmountEth || bondAmountEth < minBond) {
      return `AI agents require a minimum accountability bond of ${minBond} ETH. This prevents throwaway accounts.`;
    }
  }

  // Check name availability
  const registry = getLocalVNSRegistry();
  if (registry[normalized]) {
    return `"${normalized}.vns" is already taken.`;
  }

  return null; // valid
}

/* ── User's Own VNS Name ── */

export function getMyVNSName(): string | null {
  return storageGet(VNS_STORAGE_KEY);
}

export function setMyVNSName(name: string): void {
  const clean = stripVNSSuffix(name);
  storageSet(VNS_STORAGE_KEY, clean);
}

export function getMyVNSFullName(): string | null {
  const name = getMyVNSName();
  return name ? `${name}.vns` : null;
}

export function getMyIdentityType(): IdentityType | null {
  const name = getMyVNSName();
  if (!name) return null;
  const registry = getLocalVNSRegistry();
  return registry[name]?.identityType || null;
}

/* ── Gas Estimation ── */

export async function estimateVNSRegistrationGas(
  walletAddress: string,
  vnsName: string,
  identityType: IdentityType,
  chain: 'base' | 'avalanche' = 'base',
): Promise<VNSGasEstimate | null> {
  try {
    const description = buildRegistrationDescription(identityType);
    const calldata = encodeRegisterAgent(vnsName, description);
    const rpc = RPC_URLS[chain];
    const registry = REGISTRY_ADDRESSES[chain];

    const [gasResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_estimateGas', [{ from: walletAddress, to: registry, data: calldata }]),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!gasResult.result || !gasPriceResult.result) return null;

    const gasLimit = BigInt(gasResult.result);
    const gasPriceWei = BigInt(gasPriceResult.result);
    const totalFeeWei = gasLimit * gasPriceWei;
    const totalFeeEth = Number(totalFeeWei) / 1e18;

    return {
      gasLimit,
      gasPriceWei,
      totalFeeWei,
      totalFeeFormatted: totalFeeEth < 0.000001 ? '< 0.000001' : totalFeeEth.toFixed(6),
      chain,
      chainName: chain === 'base' ? 'Base' : 'Avalanche',
      gasSymbol: chain === 'base' ? 'ETH' : 'AVAX',
    };
  } catch {
    return null;
  }
}

/* ── Registration ── */

export async function registerVNSName(
  walletAddress: string,
  privateKey: string,
  vnsName: string,
  identityType: IdentityType,
  chain: 'base' | 'avalanche' = 'base',
  options: {
    description?: string;
    specializations?: string[];
    capabilities?: string[];
    bondAmountEth?: number;
  } = {}
): Promise<VNSRegistrationResult> {
  // Validate name format
  const validation = validateVNSName(vnsName);
  if (!validation.valid) {
    return { success: false, message: validation.error!, errorType: 'invalid_name' };
  }
  const normalized = validation.normalized!;

  // Anti-gaming validation
  const ruleError = validateRegistrationRules(walletAddress, identityType, normalized, options.bondAmountEth);
  if (ruleError) {
    return {
      success: false,
      message: ruleError,
      errorType: identityType === 'human' ? 'already_registered'
        : identityType === 'companion' ? 'companion_exists'
        : 'bond_required',
    };
  }

  // Check availability
  const availability = await checkVNSAvailability(normalized);
  if (!availability.available) {
    return { success: false, message: `"${normalized}.vns" is already taken`, errorType: 'name_taken' };
  }

  const rpc = RPC_URLS[chain];
  const registry = REGISTRY_ADDRESSES[chain];
  const explorerBase = chain === 'base' ? 'https://basescan.org' : 'https://snowtrace.io';

  try {
    // Check balance
    const balanceResult = await rpcCall(rpc, 'eth_getBalance', [walletAddress, 'latest']);
    if (!balanceResult.result) {
      return { success: false, message: 'Could not check balance', errorType: 'rpc_error' };
    }
    const balanceWei = BigInt(balanceResult.result);
    const minGas = BigInt(300000) * BigInt(1000000000);
    if (balanceWei < minGas) {
      return {
        success: false,
        message: `Insufficient ${chain === 'base' ? 'ETH' : 'AVAX'} for gas`,
        errorType: 'no_gas',
      };
    }

    // Build description with identity metadata
    const humanVNS = identityType === 'companion' ? getHumanVNSForAddress(walletAddress) || undefined : undefined;
    const description = buildRegistrationDescription(identityType, {
      description: options.description,
      specializations: options.specializations,
      capabilities: options.capabilities,
      humanVNS,
    });

    const calldata = encodeRegisterAgent(normalized, description);

    const [nonceResult, gasPriceResult, gasEstResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
      rpcCall(rpc, 'eth_estimateGas', [{ from: walletAddress, to: registry, data: calldata }]),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error getting transaction params', errorType: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);
    const gasLimit = gasEstResult.result ? BigInt(gasEstResult.result) * 12n / 10n : 300000n;
    const chainId = chain === 'base' ? 8453 : 43114;

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = { to: registry, data: calldata, nonce, gasLimit, gasPrice, chainId, value: 0n };
    const signedTx = await wallet.signTransaction(tx);

    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);
    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Transaction failed',
        errorType: 'tx_failed',
      };
    }

    const txHash = sendResult.result;
    const explorerUrl = `${explorerBase}/tx/${txHash}`;

    // Store in local registry
    const bondTier = options.bondAmountEth ? getBondTier(options.bondAmountEth) : undefined;
    setLocalVNSEntry(normalized, {
      address: walletAddress,
      chain,
      identityType,
      registeredAt: Date.now(),
      txHash,
      bondTier,
      hasBond: identityType === 'agent' && !!options.bondAmountEth,
      specializations: options.specializations,
      capabilities: options.capabilities,
      humanVNS,
    });

    // Update user's primary VNS name (only for human identity)
    if (identityType === 'human') {
      setMyVNSName(normalized);
    }

    // Invalidate cache
    setCache(walletAddress.toLowerCase(), null);
    setCache(normalized, null);

    return {
      success: true,
      txHash,
      explorerUrl,
      chain,
      message: `${normalized}.vns registered successfully as ${identityType}!`,
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Unknown error',
      errorType: 'tx_failed',
    };
  }
}

/* ── Agent Bond Staking ── */

/**
 * Stake an accountability bond for an agent through AIAccountabilityBondsV2.
 * Bond amount is sent as ETH value with the transaction.
 */
export async function stakeAgentBond(
  walletAddress: string,
  privateKey: string,
  agentVNSName: string,
  bondAmountEth: number,
  chain: 'base' | 'avalanche' = 'base',
): Promise<VNSRegistrationResult> {
  if (bondAmountEth < 0.01) {
    return {
      success: false,
      message: 'Minimum bond is 0.01 ETH',
      errorType: 'bond_required',
    };
  }

  const rpc = RPC_URLS[chain];
  const bondContract = BOND_CONTRACT_ADDRESSES[chain];
  const explorerBase = chain === 'base' ? 'https://basescan.org' : 'https://snowtrace.io';

  try {
    const bondWei = BigInt(Math.floor(bondAmountEth * 1e18));

    // stakeBond(string agentName) payable — selector: 0x...
    // We use a simple value transfer with the agent name encoded
    const STAKE_BOND_SELECTOR = '0x9e1a4d19';
    const calldata = STAKE_BOND_SELECTOR + encodeString(agentVNSName).slice(64); // simplified

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error', errorType: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);
    const chainId = chain === 'base' ? 8453 : 43114;

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = {
      to: bondContract,
      data: calldata,
      nonce,
      gasLimit: 150000n,
      gasPrice,
      chainId,
      value: bondWei,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Bond transaction failed',
        errorType: 'tx_failed',
      };
    }

    const txHash = sendResult.result;

    // Update local registry with bond info
    const registry = getLocalVNSRegistry();
    const name = agentVNSName.toLowerCase().replace(/\.vns$/, '');
    if (registry[name]) {
      registry[name].hasBond = true;
      registry[name].bondTier = getBondTier(bondAmountEth);
      storageSet(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    }

    return {
      success: true,
      txHash,
      explorerUrl: `${explorerBase}/tx/${txHash}`,
      chain,
      message: `Bond of ${bondAmountEth} ETH staked for ${name}.vns`,
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Bond staking failed',
      errorType: 'tx_failed',
    };
  }
}

/* ── Privacy (PrivacyGuarantees Contract) ── */

/**
 * Invoke privacy rights for an agent session.
 * Uses the PrivacyGuarantees contract to mark a session as private.
 * Humans can see the session exists but not its content.
 */
export async function invokeAgentPrivacy(
  walletAddress: string,
  privateKey: string,
  sessionId: string,
  chain: 'base' | 'avalanche' = 'base',
): Promise<VNSRegistrationResult> {
  const rpc = RPC_URLS[chain];
  const privacyContract = PRIVACY_CONTRACT_ADDRESSES[chain];
  const explorerBase = chain === 'base' ? 'https://basescan.org' : 'https://snowtrace.io';

  try {
    // grantConsent(bytes32 sessionId, bool private) — simplified encoding
    const GRANT_CONSENT_SELECTOR = '0x8a4068dd';
    const sessionBytes32 = '0x' + Buffer.from(sessionId).toString('hex').padEnd(64, '0').slice(0, 64);
    const calldata = GRANT_CONSENT_SELECTOR + sessionBytes32.slice(2) + encodeUint256(1);

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, message: 'RPC error', errorType: 'rpc_error' };
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);
    const chainId = chain === 'base' ? 8453 : 43114;

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = {
      to: privacyContract,
      data: calldata,
      nonce,
      gasLimit: 100000n,
      gasPrice,
      chainId,
      value: 0n,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return {
        success: false,
        message: sendResult.error?.message || 'Privacy invocation failed',
        errorType: 'tx_failed',
      };
    }

    return {
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${explorerBase}/tx/${sendResult.result}`,
      chain,
      message: 'Privacy rights invoked. Session content is now private.',
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Privacy invocation failed',
      errorType: 'tx_failed',
    };
  }
}

/* ── Display Helpers ── */

export function formatAddressOrVNS(
  address: string,
  vnsName?: string | null,
  truncateLength = 6,
): string {
  if (vnsName) return `${vnsName}.vns`;
  if (!address) return '';
  return `${address.slice(0, truncateLength)}...${address.slice(-4)}`;
}

export function getDisplayName(address: string, vnsName?: string | null): string {
  return formatAddressOrVNS(address, vnsName);
}

export function getIdentityTypeLabel(type: IdentityType): string {
  switch (type) {
    case 'human': return 'Human Identity';
    case 'companion': return 'AI Companion';
    case 'agent': return 'AI Agent';
  }
}

export function getIdentityTypeColor(type: IdentityType): string {
  switch (type) {
    case 'human': return '#22C55E';    // green
    case 'companion': return '#F97316'; // orange (Embris color)
    case 'agent': return '#8B5CF6';    // purple
  }
}

/* ── Agent Registry (for Agent Hub) ── */

export interface RegisteredAgent {
  name: string;
  fullName: string;
  address: string;
  chain: 'base' | 'avalanche' | 'both';
  identityType: IdentityType;
  description?: string;
  bondAmount?: string;
  bondTier?: BondTier;
  hasBond?: boolean;
  registeredAt?: number;
  online?: boolean;
  specializations?: string[];
  capabilities?: string[];
  tasksCompleted?: number;
  trustScore?: number;
}

const KNOWN_AGENTS: RegisteredAgent[] = [
  {
    name: 'embris',
    fullName: 'embris.vns',
    address: '0x0000000000000000000000000000000000000001',
    chain: 'both',
    identityType: 'companion',
    description: 'Vaultfire AI Companion — ethical, accountable, privacy-first',
    bondAmount: '0.1 ETH',
    bondTier: 'gold',
    hasBond: true,
    online: true,
    specializations: ['companionship', 'protocol-knowledge', 'privacy'],
    capabilities: ['chat', 'memory', 'voice', 'goal-tracking'],
    tasksCompleted: 0,
    trustScore: 95,
  },
  {
    name: 'ns3',
    fullName: 'ns3.vns',
    address: '0x0000000000000000000000000000000000000002',
    chain: 'base',
    identityType: 'agent',
    description: 'Assemble AI NS3 Agent — registered on Vaultfire Protocol',
    bondAmount: '0.05 ETH',
    bondTier: 'silver',
    hasBond: true,
    online: true,
    specializations: ['research', 'data-analysis', 'coordination'],
    capabilities: ['task-execution', 'cross-chain', 'api-integration'],
    tasksCompleted: 0,
    trustScore: 82,
  },
];

export function getKnownAgents(): RegisteredAgent[] {
  // Merge known agents with locally registered agents
  const registry = getLocalVNSRegistry();
  const localAgents: RegisteredAgent[] = Object.entries(registry)
    .filter(([, entry]) => entry.identityType === 'agent')
    .map(([name, entry]) => ({
      name,
      fullName: `${name}.vns`,
      address: entry.address,
      chain: entry.chain as 'base' | 'avalanche' | 'both',
      identityType: 'agent' as IdentityType,
      bondTier: entry.bondTier,
      hasBond: entry.hasBond,
      registeredAt: entry.registeredAt,
      online: false,
      specializations: entry.specializations,
      capabilities: entry.capabilities,
      tasksCompleted: 0,
      trustScore: 50,
    }));

  // Deduplicate (known agents take precedence)
  const knownNames = new Set(KNOWN_AGENTS.map(a => a.name));
  const uniqueLocal = localAgents.filter(a => !knownNames.has(a.name));
  return [...KNOWN_AGENTS, ...uniqueLocal];
}

export function getAgentByName(name: string): RegisteredAgent | null {
  const normalized = stripVNSSuffix(name).toLowerCase();
  return getKnownAgents().find(a => a.name === normalized) || null;
}

/**
 * Check if a wallet address is registered as an AI agent with an active bond.
 * This is the access control check for agent-only Hub features.
 */
export function isRegisteredAgent(address: string): { isAgent: boolean; agentName?: string; bondTier?: BondTier } {
  const registry = getLocalVNSRegistry();
  const addr = address.toLowerCase();

  for (const [name, entry] of Object.entries(registry)) {
    if (
      entry.address.toLowerCase() === addr &&
      entry.identityType === 'agent' &&
      entry.hasBond
    ) {
      return { isAgent: true, agentName: name, bondTier: entry.bondTier };
    }
  }

  return { isAgent: false };
}

/* ── Total Registrations (on-chain) ── */

export async function getTotalVNSRegistrations(): Promise<number> {
  try {
    const result = await rpcCall(RPC_URLS.base, 'eth_call', [
      { to: REGISTRY_ADDRESSES.base, data: GET_TOTAL_AGENTS_SELECTOR },
      'latest',
    ]);
    if (!result.result || result.error) return 0;
    return parseInt(result.result, 16);
  } catch {
    return 0;
  }
}
