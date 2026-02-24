/**
 * Embris Companion Agent — Autonomous AI Partner
 *
 * The Companion is the user's AI partner/homie in the Embris web app.
 * It has its OWN wallet (separate from the user's), can hold funds,
 * send/receive tokens, create partnership bonds, and operate independently.
 *
 * Architecture:
 * - Companion wallet: AES-256-GCM encrypted, separate from user wallet
 * - Partnership bond: On-chain proof of user-companion relationship via AIPartnershipBondsV2
 * - Autonomous monitoring: Portfolio alerts, bond status, trust tier checks
 * - XMTP integration: Can message on behalf of user (with permission)
 * - x402 payments: Can pay for services within user-set spending limits
 *
 * SECURITY: No private keys are ever stored in plaintext.
 * All keys are encrypted with AES-256-GCM via PBKDF2 (100k iterations).
 *
 * @module companion-agent
 */

import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS } from './contracts';
import type { SupportedChain } from './agent-sdk';

// ─── Storage Keys ────────────────────────────────────────────────────────────

const COMPANION_KEYS = {
  ENCRYPTED_VAULT: 'embris_companion_vault_v1',
  ADDRESS: 'embris_companion_address',
  CREATED: 'embris_companion_created',
  NAME: 'embris_companion_agent_name',
  BOND_TX: 'embris_companion_bond_tx',
  BOND_CHAIN: 'embris_companion_bond_chain',
  BOND_ACTIVE: 'embris_companion_bond_active',
  BOND_TIER: 'embris_companion_bond_tier',
  BOND_AMOUNT: 'embris_companion_bond_amount_eth',
  REGISTERED: 'embris_companion_registered',
  REGISTERED_CHAIN: 'embris_companion_registered_chain',
  REGISTERED_TX: 'embris_companion_registered_tx',
  VNS_NAME: 'embris_companion_vns_name',
  SPENDING_LIMIT: 'embris_companion_spending_limit',
  XMTP_PERMISSION: 'embris_companion_xmtp_permission',
  ALERTS: 'embris_companion_alerts',
  MONITORING_ENABLED: 'embris_companion_monitoring',
  ACTIVATION_TIME: 'embris_companion_activated_at',
} as const;

// ─── Crypto Helpers (mirrors wallet.ts pattern) ─────────────────────────────

interface EncryptedVault {
  salt: string;
  iv: string;
  ct: string;
  v: number;
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBuf(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(
  data: { pk: string; mnemonic: string },
  password: string
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    enc.encode(JSON.stringify(data))
  );
  return { salt: bufToBase64(salt), iv: bufToBase64(iv), ct: bufToBase64(ct), v: 1 };
}

async function decryptData(
  vault: EncryptedVault,
  password: string
): Promise<{ pk: string; mnemonic: string }> {
  const salt = base64ToBuf(vault.salt);
  const iv = base64ToBuf(vault.iv);
  const ct = base64ToBuf(vault.ct);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ct.buffer as ArrayBuffer
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('Incorrect password or corrupted companion vault');
  }
}

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function sGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function sSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* storage full */ }
}

function sRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Session Cache (in-memory only, never persisted) ─────────────────────────

let _sessionPK: string | null = null;
let _sessionMnemonic: string | null = null;

function setCompanionSession(pk: string, mnemonic: string): void {
  _sessionPK = pk;
  _sessionMnemonic = mnemonic;
}

export function clearCompanionSession(): void {
  _sessionPK = null;
  _sessionMnemonic = null;
}

export function getCompanionSessionPK(): string | null {
  return _sessionPK;
}

// ─── Contract Addresses ──────────────────────────────────────────────────────

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

const RPC_URLS: Record<SupportedChain, string> = {
  ethereum: CHAINS.ethereum.rpc,
  base: CHAINS.base.rpc,
  avalanche: CHAINS.avalanche.rpc,
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

// ─── RPC Helper ──────────────────────────────────────────────────────────────

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

// ─── ABI Encoding Helpers ────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompanionWalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

export type BondTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CompanionBondStatus {
  active: boolean;
  txHash: string | null;
  chain: SupportedChain | null;
  tier: BondTier | null;
  createdAt: number | null;
}

export interface CompanionStatus {
  walletCreated: boolean;
  walletAddress: string | null;
  walletUnlocked: boolean;
  agentRegistered: boolean;
  registeredChain: SupportedChain | null;
  vnsName: string | null;
  bond: CompanionBondStatus;
  spendingLimitUsd: number;
  xmtpPermission: boolean;
  monitoringEnabled: boolean;
  activatedAt: number | null;
}

export interface CompanionAlert {
  id: string;
  type: 'balance' | 'bond' | 'trust' | 'payment' | 'identity' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  chain?: SupportedChain;
  txHash?: string;
}

export interface PortfolioSnapshot {
  chain: SupportedChain;
  nativeBalance: string;
  nativeSymbol: string;
  usdcBalance: string;
}

export interface CompanionCapabilities {
  canSendTokens: boolean;
  canCreateBond: boolean;
  canRegisterAgent: boolean;
  canMonitorPortfolio: boolean;
  canUseXMTP: boolean;
  canPayX402: boolean;
  canRunOffline: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANION WALLET
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new companion wallet. Generates a random keypair,
 * encrypts it with the user's password, and stores it separately
 * from the user's wallet.
 */
export async function createCompanionWallet(password: string): Promise<CompanionWalletData> {
  const { ethers } = await import('ethers');
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic?.phrase || '';
  const address = wallet.address;
  const privateKey = wallet.privateKey;

  const vault = await encryptData({ pk: privateKey, mnemonic }, password);
  sSet(COMPANION_KEYS.ENCRYPTED_VAULT, JSON.stringify(vault));
  sSet(COMPANION_KEYS.ADDRESS, address);
  sSet(COMPANION_KEYS.CREATED, 'true');
  sSet(COMPANION_KEYS.ACTIVATION_TIME, Date.now().toString());
  setCompanionSession(privateKey, mnemonic);

  return { address, mnemonic, privateKey };
}

/**
 * Unlock the companion wallet with the user's password.
 * Decrypts the vault and caches the private key in memory.
 */
export async function unlockCompanionWallet(password: string): Promise<CompanionWalletData> {
  const vaultJson = sGet(COMPANION_KEYS.ENCRYPTED_VAULT);
  if (!vaultJson) throw new Error('No companion wallet found');
  const vault: EncryptedVault = JSON.parse(vaultJson);
  const { pk, mnemonic } = await decryptData(vault, password);
  const address = sGet(COMPANION_KEYS.ADDRESS) || '';
  setCompanionSession(pk, mnemonic);
  return { address, mnemonic, privateKey: pk };
}

/**
 * Check if the companion wallet has been created.
 */
export function isCompanionWalletCreated(): boolean {
  return sGet(COMPANION_KEYS.CREATED) === 'true';
}

/**
 * Get the companion wallet address (public, always available).
 */
export function getCompanionAddress(): string | null {
  return sGet(COMPANION_KEYS.ADDRESS);
}

/**
 * Check if the companion wallet is unlocked (session active).
 */
export function isCompanionUnlocked(): boolean {
  return _sessionPK !== null;
}

/**
 * Delete the companion wallet entirely.
 */
export function deleteCompanionWallet(): void {
  Object.values(COMPANION_KEYS).forEach(sRemove);
  clearCompanionSession();
}

/**
 * Get the companion's native balance on a chain.
 */
export async function getCompanionBalance(chain: SupportedChain = 'base'): Promise<string> {
  const address = getCompanionAddress();
  if (!address) return '0';
  try {
    const result = await rpcCall(RPC_URLS[chain], 'eth_getBalance', [address, 'latest']);
    if (!result.result) return '0';
    const wei = BigInt(result.result);
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, '0').slice(0, 6);
    return `${whole}.${fracStr}`;
  } catch {
    return '0';
  }
}

/**
 * Get the companion's USDC balance on Base.
 */
export async function getCompanionUSDCBalance(): Promise<string> {
  const address = getCompanionAddress();
  if (!address) return '0.00';
  const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const calldata = '0x70a08231' + encodeAddress(address);
  try {
    const result = await rpcCall(RPC_URLS.base, 'eth_call', [
      { to: USDC, data: calldata }, 'latest',
    ]);
    if (!result.result || result.result === '0x') return '0.00';
    const raw = BigInt(result.result);
    const whole = raw / 1000000n;
    const frac = (raw % 1000000n).toString().padStart(6, '0').replace(/0+$/, '') || '00';
    return `${whole}.${frac}`;
  } catch {
    return '0.00';
  }
}

/**
 * Get a full portfolio snapshot across all chains.
 */
export async function getCompanionPortfolio(): Promise<PortfolioSnapshot[]> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  const symbols: Record<SupportedChain, string> = {
    base: 'ETH', avalanche: 'AVAX', ethereum: 'ETH',
  };

  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      const balance = await getCompanionBalance(chain);
      const usdc = chain === 'base' ? await getCompanionUSDCBalance() : '0.00';
      return { chain, nativeBalance: balance, nativeSymbol: symbols[chain], usdcBalance: usdc };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<PortfolioSnapshot> => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Send native tokens from the companion wallet.
 */
export async function companionSendNative(
  toAddress: string,
  amountEth: string,
  chain: SupportedChain = 'base',
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!_sessionPK) return { success: false, error: 'Companion wallet is locked' };

  // Check spending limit (limit is in USD; use a conservative 1 ETH = $3000 estimate
  // for a soft cap — the user can always adjust the limit)
  const limitUsd = getCompanionSpendingLimit();
  if (limitUsd > 0) {
    const amount = parseFloat(amountEth);
    const ETH_USD_ESTIMATE = 3000; // conservative estimate for limit enforcement
    const amountUsd = amount * ETH_USD_ESTIMATE;
    if (isNaN(amount) || amountUsd > limitUsd) {
      return { success: false, error: `Amount (~$${amountUsd.toFixed(2)}) exceeds companion spending limit of $${limitUsd.toFixed(2)}` };
    }
  }

  try {
    const { ethers } = await import('ethers');
    const address = getCompanionAddress();
    if (!address) return { success: false, error: 'No companion address' };

    const rpc = RPC_URLS[chain];
    const chainId = CHAIN_IDS[chain];
    const weiAmount = ethers.parseEther(amountEth);

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [address, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, error: 'RPC error' };
    }

    const wallet = new ethers.Wallet(_sessionPK);
    const tx = {
      to: toAddress,
      value: weiAmount,
      nonce: parseInt(nonceResult.result, 16),
      gasLimit: 21000n,
      gasPrice: BigInt(gasPriceResult.result),
      chainId,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return { success: false, error: sendResult.error?.message || 'Transaction failed' };
    }

    return { success: true, txHash: sendResult.result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Send failed' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTNERSHIP BOND
// ═══════════════════════════════════════════════════════════════════════════════

const SELECTORS = {
  registerAgent: '0x2b3ce0bf',
  createBond: '0x7ac5113b',
  getAgent: '0xfb3551ff',
  getTotalAgents: '0x3731a16f',
};

/**
 * Register the companion as an agent on ERC8004IdentityRegistry.
 * Uses the USER's wallet to pay gas (companion may have no funds yet).
 */
export async function registerCompanionAgent(
  userPrivateKey: string,
  userAddress: string,
  companionName: string,
  chain: SupportedChain = 'base',
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const companionAddr = getCompanionAddress();
    if (!companionAddr) return { success: false, error: 'No companion wallet' };

    const name = companionName.toLowerCase().replace(/\.vns$/, '').replace(/[^a-z0-9-]/g, '').trim();
    if (name.length < 3 || name.length > 32) {
      return { success: false, error: 'Name must be 3-32 characters' };
    }

    const rpc = RPC_URLS[chain];
    const registry = IDENTITY_REGISTRY[chain];
    const chainId = CHAIN_IDS[chain];

    const meta = JSON.stringify({
      type: 'companion',
      desc: `Embris Companion Agent — autonomous AI partner bonded to ${userAddress.slice(0, 10)}...`,
      spec: ['companion', 'assistant', 'monitoring'],
      caps: ['chat', 'portfolio-monitoring', 'bond-management', 'x402-payments'],
      v: 1,
    });

    const identityHashHex = Array.from(new TextEncoder().encode(name))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padEnd(64, '0')
      .slice(0, 64);

    const nameEncoded = encodeString(name);
    const descEncoded = encodeString(meta);
    const offset1 = 0x60;
    const string1Size = nameEncoded.length / 2;
    const offset2 = offset1 + string1Size;

    const calldata = SELECTORS.registerAgent
      + encodeUint256(offset1)
      + encodeUint256(offset2)
      + identityHashHex
      + nameEncoded
      + descEncoded;

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [userAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, error: 'RPC error' };
    }

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(userPrivateKey);
    const tx = {
      to: registry,
      data: calldata,
      nonce: parseInt(nonceResult.result, 16),
      gasLimit: 300000n,
      gasPrice: BigInt(gasPriceResult.result),
      chainId,
      value: 0n,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return { success: false, error: sendResult.error?.message || 'Registration failed' };
    }

    sSet(COMPANION_KEYS.REGISTERED, 'true');
    sSet(COMPANION_KEYS.REGISTERED_CHAIN, chain);
    sSet(COMPANION_KEYS.REGISTERED_TX, sendResult.result);
    sSet(COMPANION_KEYS.NAME, name);

    return { success: true, txHash: sendResult.result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Registration failed' };
  }
}

/**
 * Create a partnership bond between the user and the companion.
 * The user stakes ETH to prove the relationship on-chain.
 */
export async function createPartnershipBond(
  userPrivateKey: string,
  userAddress: string,
  amountEth: number = 0.01,
  chain: SupportedChain = 'base',
): Promise<{ success: boolean; txHash?: string; tier?: BondTier; error?: string }> {
  try {
    const companionAddr = getCompanionAddress();
    if (!companionAddr) return { success: false, error: 'No companion wallet' };
    if (amountEth < 0.001) return { success: false, error: 'Minimum bond is 0.001 ETH' };

    const rpc = RPC_URLS[chain];
    const bondContract = PARTNERSHIP_BONDS[chain];
    const chainId = CHAIN_IDS[chain];
    const bondWei = BigInt(Math.floor(amountEth * 1e18));

    const addressParam = encodeAddress(companionAddr);
    const stringOffset = encodeUint256(0x40);
    const partnershipType = `companion:${companionAddr.slice(0, 10)}`;
    const stringEncoded = encodeString(partnershipType);
    const calldata = SELECTORS.createBond + addressParam + stringOffset + stringEncoded;

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [userAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return { success: false, error: 'RPC error' };
    }

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(userPrivateKey);
    const tx = {
      to: bondContract,
      data: calldata,
      nonce: parseInt(nonceResult.result, 16),
      gasLimit: 200000n,
      gasPrice: BigInt(gasPriceResult.result),
      chainId,
      value: bondWei,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return { success: false, error: sendResult.error?.message || 'Bond creation failed' };
    }

    const tier = getBondTier(amountEth);
    sSet(COMPANION_KEYS.BOND_TX, sendResult.result);
    sSet(COMPANION_KEYS.BOND_CHAIN, chain);
    sSet(COMPANION_KEYS.BOND_ACTIVE, 'true');
    sSet(COMPANION_KEYS.BOND_TIER, tier);
    sSet(COMPANION_KEYS.BOND_AMOUNT, amountEth.toString());

    return { success: true, txHash: sendResult.result, tier };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Bond creation failed' };
  }
}

/**
 * Get the bond tier from ETH amount.
 */
export function getBondTier(ethAmount: number): BondTier {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  return 'bronze';
}

/**
 * Get the companion's bond status.
 */
export function getCompanionBondStatus(): CompanionBondStatus {
  const active = sGet(COMPANION_KEYS.BOND_ACTIVE) === 'true';
  const txHash = sGet(COMPANION_KEYS.BOND_TX);
  const chain = sGet(COMPANION_KEYS.BOND_CHAIN) as SupportedChain | null;
  const storedTier = sGet(COMPANION_KEYS.BOND_TIER) as BondTier | null;
  const storedAmount = sGet(COMPANION_KEYS.BOND_AMOUNT);
  const tier: BondTier | null = active
    ? (storedTier || (storedAmount ? getBondTier(parseFloat(storedAmount)) : 'bronze'))
    : null;
  return {
    active,
    txHash,
    chain,
    tier,
    createdAt: active ? Date.now() : null,
  };
}

/**
 * Verify the companion's bond on-chain (read-only).
 */
export async function verifyCompanionBond(chain: SupportedChain = 'base'): Promise<{
  verified: boolean;
  bondCount: number;
  totalStaked: string;
}> {
  const companionAddr = getCompanionAddress();
  if (!companionAddr) return { verified: false, bondCount: 0, totalStaked: '0' };

  try {
    const bondContract = PARTNERSHIP_BONDS[chain];
    // getBondsByParticipantCount(address) → selector 0x5e6d1b8a
    const countCalldata = '0x5e6d1b8a' + encodeAddress(companionAddr);
    const countResult = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: bondContract, data: countCalldata }, 'latest',
    ]);
    const bondCount = countResult.result && countResult.result !== '0x'
      ? Number(BigInt(countResult.result))
      : 0;

    // Also check the stored bond amount for staked value
    const storedAmount = sGet(COMPANION_KEYS.BOND_AMOUNT);
    const totalStaked = storedAmount ? parseFloat(storedAmount).toFixed(6) : '0';

    return {
      verified: bondCount > 0,
      bondCount,
      totalStaked,
    };
  } catch {
    // Fallback: check if we have a stored bond tx
    const hasBond = sGet(COMPANION_KEYS.BOND_ACTIVE) === 'true';
    const storedAmount = sGet(COMPANION_KEYS.BOND_AMOUNT);
    return {
      verified: hasBond,
      bondCount: hasBond ? 1 : 0,
      totalStaked: storedAmount ? parseFloat(storedAmount).toFixed(6) : '0',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check the on-chain registration status of the companion.
 */
export async function checkCompanionRegistration(chain: SupportedChain = 'base'): Promise<{
  registered: boolean;
  name: string | null;
}> {
  const companionAddr = getCompanionAddress();
  if (!companionAddr) return { registered: false, name: null };

  try {
    const calldata = SELECTORS.getAgent + encodeAddress(companionAddr);
    const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: IDENTITY_REGISTRY[chain], data: calldata }, 'latest',
    ]);

    if (result.result && result.result !== '0x' && result.result.length > 130) {
      const data = result.result.slice(2);
      const nameOffset = parseInt(data.slice(0, 64), 16) * 2;
      if (nameOffset < data.length) {
        const nameLength = parseInt(data.slice(nameOffset, nameOffset + 64), 16);
        if (nameLength > 0) {
          const nameHex = data.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
          const nameBytes = new Uint8Array(nameLength);
          for (let i = 0; i < nameLength; i++) {
            nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
          }
          return { registered: true, name: new TextDecoder().decode(nameBytes) };
        }
      }
    }
    return { registered: false, name: null };
  } catch {
    return { registered: false, name: null };
  }
}

/**
 * Monitor the user's portfolio and generate alerts.
 */
export async function monitorUserPortfolio(
  userAddress: string,
  chain: SupportedChain = 'base',
): Promise<CompanionAlert[]> {
  const alerts: CompanionAlert[] = [];

  try {
    // Check user's native balance
    const balanceResult = await rpcCall(RPC_URLS[chain], 'eth_getBalance', [userAddress, 'latest']);
    if (balanceResult.result) {
      const wei = BigInt(balanceResult.result);
      const eth = Number(wei) / 1e18;
      if (eth < 0.001) {
        alerts.push({
          id: `low_balance_${chain}_${Date.now()}`,
          type: 'balance',
          title: 'Low Balance Alert',
          message: `Your ${CHAINS[chain].symbol} balance on ${CHAINS[chain].name} is very low (${eth.toFixed(6)} ${CHAINS[chain].symbol}). You may not be able to send transactions.`,
          timestamp: Date.now(),
          read: false,
          chain,
        });
      }
    }

    // Check companion's own balance
    const companionAddr = getCompanionAddress();
    if (companionAddr) {
      const compBalance = await rpcCall(RPC_URLS[chain], 'eth_getBalance', [companionAddr, 'latest']);
      if (compBalance.result) {
        const wei = BigInt(compBalance.result);
        const eth = Number(wei) / 1e18;
        if (eth > 0) {
          alerts.push({
            id: `companion_funded_${Date.now()}`,
            type: 'info',
            title: 'Companion Wallet Funded',
            message: `Your companion has ${eth.toFixed(6)} ${CHAINS[chain].symbol} on ${CHAINS[chain].name}.`,
            timestamp: Date.now(),
            read: false,
            chain,
          });
        }
      }
    }
  } catch {
    // Silent fail for monitoring
  }

  return alerts;
}

// ─── Alert Management ────────────────────────────────────────────────────────

export function getCompanionAlerts(): CompanionAlert[] {
  const raw = sGet(COMPANION_KEYS.ALERTS);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function addCompanionAlert(alert: CompanionAlert): void {
  const alerts = getCompanionAlerts();
  alerts.unshift(alert);
  // Keep last 50 alerts
  sSet(COMPANION_KEYS.ALERTS, JSON.stringify(alerts.slice(0, 50)));
}

export function markAlertRead(alertId: string): void {
  const alerts = getCompanionAlerts();
  const updated = alerts.map(a => a.id === alertId ? { ...a, read: true } : a);
  sSet(COMPANION_KEYS.ALERTS, JSON.stringify(updated));
}

export function clearCompanionAlerts(): void {
  sRemove(COMPANION_KEYS.ALERTS);
}

// ─── Spending Limits ─────────────────────────────────────────────────────────

export function getCompanionSpendingLimit(): number {
  const raw = sGet(COMPANION_KEYS.SPENDING_LIMIT);
  if (!raw) return 0;
  const val = parseFloat(raw);
  return isNaN(val) ? 0 : val;
}

export function setCompanionSpendingLimit(limitUsd: number): void {
  sSet(COMPANION_KEYS.SPENDING_LIMIT, limitUsd.toString());
}

// ─── XMTP Permission ────────────────────────────────────────────────────────

export function getXMTPPermission(): boolean {
  return sGet(COMPANION_KEYS.XMTP_PERMISSION) === 'true';
}

export function setXMTPPermission(enabled: boolean): void {
  sSet(COMPANION_KEYS.XMTP_PERMISSION, enabled ? 'true' : 'false');
}

// ─── Monitoring Toggle ───────────────────────────────────────────────────────

export function isMonitoringEnabled(): boolean {
  return sGet(COMPANION_KEYS.MONITORING_ENABLED) === 'true';
}

export function setMonitoringEnabled(enabled: boolean): void {
  sSet(COMPANION_KEYS.MONITORING_ENABLED, enabled ? 'true' : 'false');
}

// ─── VNS Name ────────────────────────────────────────────────────────────────

export function getCompanionVNSName(): string | null {
  return sGet(COMPANION_KEYS.VNS_NAME);
}

export function setCompanionVNSName(name: string): void {
  sSet(COMPANION_KEYS.VNS_NAME, name);
}

// ─── Agent Name ──────────────────────────────────────────────────────────────

export function getCompanionAgentName(): string {
  return sGet(COMPANION_KEYS.NAME) || 'embris-companion';
}

export function setCompanionAgentName(name: string): void {
  sSet(COMPANION_KEYS.NAME, name);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the complete status of the companion agent.
 */
export function getCompanionStatus(): CompanionStatus {
  const bond = getCompanionBondStatus();
  const activatedAt = sGet(COMPANION_KEYS.ACTIVATION_TIME);

  return {
    walletCreated: isCompanionWalletCreated(),
    walletAddress: getCompanionAddress(),
    walletUnlocked: isCompanionUnlocked(),
    agentRegistered: sGet(COMPANION_KEYS.REGISTERED) === 'true',
    registeredChain: sGet(COMPANION_KEYS.REGISTERED_CHAIN) as SupportedChain | null,
    vnsName: getCompanionVNSName(),
    bond,
    spendingLimitUsd: getCompanionSpendingLimit(),
    xmtpPermission: getXMTPPermission(),
    monitoringEnabled: isMonitoringEnabled(),
    activatedAt: activatedAt ? parseInt(activatedAt, 10) : null,
  };
}

/**
 * Get the companion's current capabilities based on its status.
 */
export function getCompanionCapabilities(): CompanionCapabilities {
  const status = getCompanionStatus();
  return {
    canSendTokens: status.walletUnlocked,
    canCreateBond: status.walletCreated && !status.bond.active,
    canRegisterAgent: status.walletCreated && !status.agentRegistered,
    canMonitorPortfolio: status.walletCreated,
    canUseXMTP: status.walletUnlocked && status.xmtpPermission,
    canPayX402: status.walletUnlocked && status.spendingLimitUsd > 0,
    canRunOffline: false, // Future capability
  };
}

/**
 * Get the bond explorer URL.
 */
export function getCompanionBondExplorerUrl(): string | null {
  const txHash = sGet(COMPANION_KEYS.BOND_TX);
  const chain = sGet(COMPANION_KEYS.BOND_CHAIN) as SupportedChain | null;
  if (!txHash || !chain) return null;
  return `${EXPLORER_URLS[chain]}/tx/${txHash}`;
}

/**
 * Get the registration explorer URL.
 */
export function getCompanionRegistrationExplorerUrl(): string | null {
  const txHash = sGet(COMPANION_KEYS.REGISTERED_TX);
  const chain = sGet(COMPANION_KEYS.REGISTERED_CHAIN) as SupportedChain | null;
  if (!txHash || !chain) return null;
  return `${EXPLORER_URLS[chain]}/tx/${txHash}`;
}
