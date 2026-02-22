/**
 * Embris On-Chain Registration Gate — Multi-Chain
 *
 * Manages user registration on Base AND Avalanche via the ERC8004IdentityRegistry
 * contract deployed on both chains. Users can register on one chain or both.
 *
 * Registration flow:
 * 1. User picks a chain (Base, Avalanche, or both)
 * 2. Pre-flight: validate address, check native token balance for gas
 * 3. Send registerAgent(string,string,bytes32) to the chosen chain(s)
 * 4. Wait for confirmation, store tx hash(es)
 * 5. Features unlock after the first successful chain registration
 *
 * Contract: registerAgent(string name, string description, bytes32 identityHash)
 * Selector: 0x2b3ce0bf — permissionless on both chains.
 */

import { CHAINS } from './contracts';
import { getWalletPrivateKey } from './wallet';

/* ── Chain Registry Config ── */

export type SupportedChain = 'base' | 'avalanche';

interface ChainRegistryConfig {
  chain: SupportedChain;
  chainId: number;
  name: string;
  rpc: string;
  registryAddress: string;
  explorerTxUrl: string;
  explorerName: string;
  gasSymbol: string;
  color: string;
}

const CHAIN_REGISTRY: Record<SupportedChain, ChainRegistryConfig> = {
  base: {
    chain: 'base',
    chainId: 8453,
    name: 'Base',
    rpc: CHAINS.base.rpc,
    registryAddress: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
    explorerTxUrl: 'https://basescan.org/tx/',
    explorerName: 'BaseScan',
    gasSymbol: 'ETH',
    color: '#00D9FF',
  },
  avalanche: {
    chain: 'avalanche',
    chainId: 43114,
    name: 'Avalanche',
    rpc: CHAINS.avalanche.rpc,
    registryAddress: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
    explorerTxUrl: 'https://snowtrace.io/tx/',
    explorerName: 'SnowTrace',
    gasSymbol: 'AVAX',
    color: '#E84142',
  },
};

export function getChainConfig(chain: SupportedChain): ChainRegistryConfig {
  return CHAIN_REGISTRY[chain];
}

export function getAllChainConfigs(): ChainRegistryConfig[] {
  return Object.values(CHAIN_REGISTRY);
}

/* ── Constants ── */

const REGISTRATION_KEY = 'embris_registration_v2';
const NUDGE_COUNTER_KEY = 'embris_nudge_counter';
const REGISTER_AGENT_SELECTOR = '0x2b3ce0bf';
const GET_AGENT_SELECTOR = '0xfb3551ff';

/* ── Types ── */

export interface ChainRegistration {
  chain: SupportedChain;
  chainId: number;
  txHash: string;
  explorerUrl: string;
  verified: boolean;
  registeredAt: number;
  gasUsed?: string;
}

export interface RegistrationData {
  walletAddress: string;
  registeredAt: number;
  embrisLevel: 'basic' | 'full';
  chains: ChainRegistration[];
  // Legacy compat fields (point to first chain)
  registrationTxHash: string;
  chainId: number;
  verified: boolean;
  basescanUrl: string;
  gasUsed?: string;
}

export interface RegistrationResult {
  success: boolean;
  registration: RegistrationData | null;
  message: string;
  txHash?: string;
  explorerUrl?: string;
  chainResults?: ChainTxResult[];
  errorType?: 'no_wallet' | 'no_private_key' | 'no_gas' | 'already_registered' | 'tx_failed' | 'rpc_error' | 'invalid_address';
}

export interface ChainTxResult {
  chain: SupportedChain;
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  message: string;
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

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/* ── RPC Helper ── */

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<{ result?: string; error?: { message: string; code?: number } }> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  return response.json();
}

/* ── ABI Encoding ── */

function encodeUint256(n: number): string {
  return n.toString(16).padStart(64, '0');
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

function encodeRegisterAgent(name: string, description: string, identityHash: string): string {
  const nameEncoded = encodeString(name);
  const descEncoded = encodeString(description);
  const offset1 = 0x60;
  const string1Size = nameEncoded.length / 2;
  const offset2 = offset1 + string1Size;
  const hashHex = identityHash.replace('0x', '').padStart(64, '0');
  return REGISTER_AGENT_SELECTOR
    + encodeUint256(offset1)
    + encodeUint256(offset2)
    + hashHex
    + nameEncoded
    + descEncoded;
}

function encodeGetAgent(address: string): string {
  const addr = address.replace('0x', '').toLowerCase().padStart(64, '0');
  return GET_AGENT_SELECTOR + addr;
}

/* ── On-Chain Checks (chain-aware) ── */

async function checkExistingRegistration(
  address: string,
  chain: SupportedChain,
): Promise<string | null> {
  const cfg = CHAIN_REGISTRY[chain];
  try {
    const data = encodeGetAgent(address);
    const result = await rpcCall(cfg.rpc, 'eth_call', [{ to: cfg.registryAddress, data }, 'latest']);
    if (!result.result || result.result === '0x' || result.error) return null;
    const hex = result.result.slice(2);
    if (hex.length < 128) return null;
    const nameOffset = parseInt(hex.slice(0, 64), 16) * 2;
    if (nameOffset >= hex.length) return null;
    const nameLength = parseInt(hex.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return null;
    const nameHex = hex.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(nameBytes) || null;
  } catch {
    return null;
  }
}

async function checkBalance(
  address: string,
  chain: SupportedChain,
): Promise<{ hasGas: boolean; balanceWei: bigint; balanceFormatted: string }> {
  const cfg = CHAIN_REGISTRY[chain];
  try {
    const result = await rpcCall(cfg.rpc, 'eth_getBalance', [address, 'latest']);
    if (!result.result || result.error) {
      return { hasGas: false, balanceWei: 0n, balanceFormatted: '0' };
    }
    const balanceWei = BigInt(result.result);
    const minRequired = BigInt(300000) * BigInt(100000000); // 0.00003 in native token
    const balanceNative = Number(balanceWei) / 1e18;
    return {
      hasGas: balanceWei >= minRequired,
      balanceWei,
      balanceFormatted: balanceNative < 0.0001 ? '< 0.0001' : balanceNative.toFixed(6),
    };
  } catch {
    return { hasGas: false, balanceWei: 0n, balanceFormatted: '0' };
  }
}

async function estimateGas(
  from: string,
  calldata: string,
  chain: SupportedChain,
): Promise<bigint | null> {
  const cfg = CHAIN_REGISTRY[chain];
  try {
    const result = await rpcCall(cfg.rpc, 'eth_estimateGas', [
      { from, to: cfg.registryAddress, data: calldata },
    ]);
    if (result.result && !result.error) return BigInt(result.result);
    return null;
  } catch {
    return null;
  }
}

async function getGasPrice(chain: SupportedChain): Promise<bigint> {
  const cfg = CHAIN_REGISTRY[chain];
  try {
    const result = await rpcCall(cfg.rpc, 'eth_gasPrice', []);
    if (result.result) return BigInt(result.result);
    return BigInt(100000000);
  } catch {
    return BigInt(100000000);
  }
}

async function getNonce(address: string, chain: SupportedChain): Promise<number> {
  const cfg = CHAIN_REGISTRY[chain];
  const result = await rpcCall(cfg.rpc, 'eth_getTransactionCount', [address, 'latest']);
  if (result.result) return parseInt(result.result, 16);
  throw new Error(`Failed to get nonce on ${cfg.name}`);
}

/* ── Transaction Receipt Polling ── */

interface TxReceipt {
  status: string;
  gasUsed: string;
  blockNumber: string;
  transactionHash: string;
}

async function waitForReceipt(
  txHash: string,
  chain: SupportedChain,
  timeoutSeconds: number,
): Promise<TxReceipt | null> {
  const cfg = CHAIN_REGISTRY[chain];
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const result = await rpcCall(cfg.rpc, 'eth_getTransactionReceipt', [txHash]);
      if (result.result && typeof result.result === 'object') {
        const receipt = result.result as unknown as TxReceipt;
        if (receipt.blockNumber) return receipt;
      }
    } catch { /* continue */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

/* ── Registration Status ── */

export function getRegistration(): RegistrationData | null {
  // Try v2 first, then migrate v1
  let raw = storageGet(REGISTRATION_KEY);
  if (!raw) {
    // Check for v1 data and migrate
    const v1 = storageGet('embris_registration_v1');
    if (v1) {
      try {
        const old = JSON.parse(v1) as {
          walletAddress: string; registeredAt: number; registrationTxHash?: string;
          chainId: number; verified: boolean; embrisLevel: string; basescanUrl?: string; gasUsed?: string;
        };
        const migrated: RegistrationData = {
          walletAddress: old.walletAddress,
          registeredAt: old.registeredAt,
          embrisLevel: old.embrisLevel as 'basic' | 'full',
          chains: [{
            chain: old.chainId === 43114 ? 'avalanche' : 'base',
            chainId: old.chainId,
            txHash: old.registrationTxHash || '',
            explorerUrl: old.basescanUrl || '',
            verified: old.verified,
            registeredAt: old.registeredAt,
            gasUsed: old.gasUsed,
          }],
          registrationTxHash: old.registrationTxHash || '',
          chainId: old.chainId,
          verified: old.verified,
          basescanUrl: old.basescanUrl || '',
          gasUsed: old.gasUsed,
        };
        storageSet(REGISTRATION_KEY, JSON.stringify(migrated));
        storageRemove('embris_registration_v1');
        return migrated;
      } catch { /* ignore */ }
    }
    return null;
  }
  try { return JSON.parse(raw) as RegistrationData; } catch { return null; }
}

export function isRegistered(): boolean {
  const reg = getRegistration();
  return reg !== null && reg.embrisLevel === 'full';
}

export function getRegisteredWalletAddress(): string | null {
  return getRegistration()?.walletAddress || null;
}

export function getRegisteredChains(): SupportedChain[] {
  const reg = getRegistration();
  if (!reg) return [];
  return reg.chains.map(c => c.chain);
}

export function isRegisteredOnChain(chain: SupportedChain): boolean {
  const reg = getRegistration();
  if (!reg) return false;
  return reg.chains.some(c => c.chain === chain);
}

/* ── Single-Chain Registration Transaction ── */

async function registerOnChain(
  walletAddress: string,
  privateKey: string,
  chain: SupportedChain,
): Promise<ChainTxResult> {
  const cfg = CHAIN_REGISTRY[chain];

  try {
    // Check if already registered on this chain
    const existing = await checkExistingRegistration(walletAddress, chain);
    if (existing) {
      return {
        chain,
        success: true,
        message: `Already registered on ${cfg.name} as "${existing}".`,
      };
    }

    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(cfg.rpc);
    const signer = new ethers.Wallet(privateKey, provider);
    const signerAddress = signer.address.toLowerCase();

    // Check balance
    const balance = await checkBalance(signerAddress, chain);
    if (!balance.hasGas) {
      return {
        chain,
        success: false,
        message: `Insufficient ${cfg.gasSymbol} for gas on ${cfg.name}. Balance: ${balance.balanceFormatted} ${cfg.gasSymbol}. Send a small amount to ${signerAddress}.`,
      };
    }

    // Build calldata
    const identityHash = ethers.keccak256(ethers.getBytes(walletAddress.padEnd(66, '0').slice(0, 42)));
    const calldata = encodeRegisterAgent(
      'Embris User',
      `Registered via Vaultfire Protocol — theloopbreaker.com`,
      identityHash,
    );

    // Estimate gas
    const gasEst = await estimateGas(signerAddress, calldata, chain);
    const gasLimit = gasEst ? (gasEst * 130n / 100n) : 300000n;

    const [gasPrice, nonce] = await Promise.all([
      getGasPrice(chain),
      getNonce(signerAddress, chain),
    ]);

    // Cost check
    const maxCost = gasLimit * gasPrice;
    if (balance.balanceWei < maxCost) {
      const costNative = Number(maxCost) / 1e18;
      return {
        chain,
        success: false,
        message: `Gas cost (~${costNative.toFixed(6)} ${cfg.gasSymbol}) exceeds balance (${balance.balanceFormatted} ${cfg.gasSymbol}) on ${cfg.name}.`,
      };
    }

    // Sign and send
    const tx = {
      to: cfg.registryAddress,
      data: calldata,
      gasLimit,
      gasPrice,
      nonce,
      chainId: cfg.chainId,
      value: 0,
    };
    const signedTx = await signer.signTransaction(tx);
    const sendResult = await rpcCall(cfg.rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error) {
      const errMsg = sendResult.error.message || 'Transaction rejected';
      if (errMsg.includes('insufficient funds') || errMsg.includes('gas')) {
        return { chain, success: false, message: `Insufficient ${cfg.gasSymbol} for gas on ${cfg.name}.` };
      }
      if (errMsg.includes('nonce') || errMsg.includes('replacement')) {
        return { chain, success: false, message: `Nonce conflict on ${cfg.name}. Wait a moment and try again.` };
      }
      return { chain, success: false, message: `${cfg.name} tx failed: ${errMsg}` };
    }

    const txHash = sendResult.result;
    if (!txHash) {
      return { chain, success: false, message: `No tx hash from ${cfg.name} RPC.` };
    }

    // Wait for confirmation
    const receipt = await waitForReceipt(txHash, chain, 60);

    if (receipt && receipt.status === '0x0') {
      return {
        chain,
        success: false,
        txHash,
        explorerUrl: cfg.explorerTxUrl + txHash,
        message: `Transaction reverted on ${cfg.name}. Check ${cfg.explorerName} for details.`,
      };
    }

    return {
      chain,
      success: true,
      txHash,
      explorerUrl: cfg.explorerTxUrl + txHash,
      message: receipt
        ? `Confirmed on ${cfg.name}!`
        : `Sent on ${cfg.name} — confirmation pending.`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    if (errMsg.includes('insufficient funds') || errMsg.includes('INSUFFICIENT_FUNDS')) {
      return { chain, success: false, message: `Insufficient ${cfg.gasSymbol} on ${cfg.name}.` };
    }
    return { chain, success: false, message: `${cfg.name} failed: ${errMsg}` };
  }
}

/* ── Manual Address (proxy via Vaultfire wallet) ── */

async function registerManualOnChain(
  manualAddress: string,
  privateKey: string,
  chain: SupportedChain,
): Promise<ChainTxResult> {
  const cfg = CHAIN_REGISTRY[chain];
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(cfg.rpc);
    const signer = new ethers.Wallet(privateKey, provider);
    const signerAddress = signer.address.toLowerCase();

    const balance = await checkBalance(signerAddress, chain);
    if (!balance.hasGas) {
      return {
        chain,
        success: false,
        message: `Vaultfire wallet needs ${cfg.gasSymbol} on ${cfg.name}. Balance: ${balance.balanceFormatted}.`,
      };
    }

    const identityHash = ethers.keccak256(ethers.getBytes(manualAddress.padEnd(66, '0').slice(0, 42)));
    const calldata = encodeRegisterAgent(
      `Embris:${manualAddress}`,
      'Registered via Vaultfire Protocol — theloopbreaker.com',
      identityHash,
    );

    const gasEst = await estimateGas(signerAddress, calldata, chain);
    const gasLimit = gasEst ? (gasEst * 130n / 100n) : 300000n;
    const [gasPrice, nonce] = await Promise.all([getGasPrice(chain), getNonce(signerAddress, chain)]);

    const maxCost = gasLimit * gasPrice;
    if (balance.balanceWei < maxCost) {
      return { chain, success: false, message: `Gas exceeds balance on ${cfg.name}.` };
    }

    const tx = { to: cfg.registryAddress, data: calldata, gasLimit, gasPrice, nonce, chainId: cfg.chainId, value: 0 };
    const signedTx = await signer.signTransaction(tx);
    const sendResult = await rpcCall(cfg.rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error) {
      return { chain, success: false, message: `${cfg.name}: ${sendResult.error.message}` };
    }

    const txHash = sendResult.result;
    if (!txHash) return { chain, success: false, message: `No tx hash from ${cfg.name}.` };

    const receipt = await waitForReceipt(txHash, chain, 60);
    return {
      chain,
      success: receipt ? receipt.status !== '0x0' : true,
      txHash,
      explorerUrl: cfg.explorerTxUrl + txHash,
      message: receipt && receipt.status !== '0x0'
        ? `Confirmed on ${cfg.name}!`
        : `Sent on ${cfg.name}.`,
    };
  } catch (err) {
    return { chain, success: false, message: `${cfg.name}: ${err instanceof Error ? err.message : 'failed'}` };
  }
}

/* ── Main Registration Function ── */

export async function registerWallet(
  walletAddress: string,
  options?: {
    useVaultfireWallet?: boolean;
    chains?: SupportedChain[];
  },
): Promise<RegistrationResult> {
  // Validate
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return { success: false, registration: null, message: 'Invalid wallet address.', errorType: 'invalid_address' };
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const targetChains = options?.chains || ['base'];
  const privateKey = getWalletPrivateKey();
  const useVaultfire = options?.useVaultfireWallet !== false;

  if (!privateKey) {
    return {
      success: false,
      registration: null,
      message: 'No Vaultfire wallet found. Create a wallet first in the Wallet section, then register.',
      errorType: 'no_private_key',
    };
  }

  // Register on each selected chain
  const chainResults: ChainTxResult[] = [];

  for (const chain of targetChains) {
    const result = useVaultfire
      ? await registerOnChain(normalizedAddress, privateKey, chain)
      : await registerManualOnChain(normalizedAddress, privateKey, chain);
    chainResults.push(result);
  }

  const anySuccess = chainResults.some(r => r.success);

  if (!anySuccess) {
    // All chains failed
    const messages = chainResults.map(r => r.message).join(' ');
    const hasGasError = chainResults.some(r =>
      r.message.includes('Insufficient') || r.message.includes('gas') || r.message.includes('balance')
    );
    return {
      success: false,
      registration: null,
      message: messages,
      chainResults,
      errorType: hasGasError ? 'no_gas' : 'tx_failed',
    };
  }

  // Build registration data
  const existingReg = getRegistration();
  const existingChains = existingReg?.chains || [];

  const newChains: ChainRegistration[] = [...existingChains];
  for (const cr of chainResults) {
    if (!cr.success) continue;
    // Remove existing entry for this chain if any
    const idx = newChains.findIndex(c => c.chain === cr.chain);
    if (idx >= 0) newChains.splice(idx, 1);
    newChains.push({
      chain: cr.chain,
      chainId: CHAIN_REGISTRY[cr.chain].chainId,
      txHash: cr.txHash || '',
      explorerUrl: cr.explorerUrl || '',
      verified: true,
      registeredAt: Date.now(),
    });
  }

  const firstChain = newChains[0];
  const registration: RegistrationData = {
    walletAddress: normalizedAddress,
    registeredAt: Date.now(),
    embrisLevel: 'full',
    chains: newChains,
    // Legacy compat
    registrationTxHash: firstChain?.txHash || '',
    chainId: firstChain?.chainId || 8453,
    verified: firstChain?.verified || false,
    basescanUrl: firstChain?.explorerUrl || '',
    gasUsed: undefined,
  };

  storageSet(REGISTRATION_KEY, JSON.stringify(registration));

  // Build summary message
  const successChains = chainResults.filter(r => r.success);
  const failedChains = chainResults.filter(r => !r.success);
  let message = '';

  if (successChains.length === targetChains.length) {
    if (targetChains.length === 1) {
      message = `Registration confirmed on ${CHAIN_REGISTRY[targetChains[0]].name}!`;
    } else {
      message = `Registration confirmed on both Base and Avalanche!`;
    }
  } else {
    const successNames = successChains.map(r => CHAIN_REGISTRY[r.chain].name).join(' and ');
    const failedNames = failedChains.map(r => CHAIN_REGISTRY[r.chain].name).join(' and ');
    message = `Registered on ${successNames}. ${failedNames} failed: ${failedChains.map(r => r.message).join(' ')}`;
  }

  return {
    success: true,
    registration,
    message,
    txHash: successChains[0]?.txHash,
    explorerUrl: successChains[0]?.explorerUrl,
    chainResults,
  };
}

/* ── Unregister ── */

export function unregister(): void {
  storageRemove(REGISTRATION_KEY);
}

/* ── Re-verify ── */

export async function reverifyRegistration(): Promise<{
  verified: boolean;
  agentName: string | null;
  message: string;
}> {
  const reg = getRegistration();
  if (!reg) return { verified: false, agentName: null, message: 'No registration found.' };

  // Check first chain
  const chain = reg.chains[0]?.chain || 'base';
  const agentName = await checkExistingRegistration(reg.walletAddress, chain);
  const verified = agentName !== null;

  if (verified !== reg.verified) {
    reg.verified = verified;
    storageSet(REGISTRATION_KEY, JSON.stringify(reg));
  }

  return {
    verified,
    agentName,
    message: verified
      ? `Verified on-chain as "${agentName}".`
      : 'On-chain record not found. Registration may still be pending.',
  };
}

/* ── Feature Gating ── */

export function getAvailableFeatures(): {
  chat: boolean;
  memory: boolean;
  selfLearning: boolean;
  emotionalIntelligence: boolean;
  goals: boolean;
  personality: boolean;
  sessionSummaries: boolean;
  proactiveSuggestions: boolean;
  export: boolean;
  contractKnowledge: boolean;
} {
  const registered = isRegistered();
  return {
    chat: true,
    memory: registered,
    selfLearning: registered,
    emotionalIntelligence: registered,
    goals: registered,
    personality: registered,
    sessionSummaries: registered,
    proactiveSuggestions: registered,
    export: registered,
    contractKnowledge: true,
  };
}

/* ── Nudge Logic ── */

export function shouldNudgeRegistration(): boolean {
  if (isRegistered()) return false;
  const raw = storageGet(NUDGE_COUNTER_KEY);
  const count = raw ? parseInt(raw, 10) : 0;
  const newCount = count + 1;
  storageSet(NUDGE_COUNTER_KEY, newCount.toString());
  const nudgePoints = [3, 7, 12, 18, 25, 35, 50];
  return nudgePoints.includes(newCount) || (newCount > 50 && newCount % 15 === 0);
}

export function resetNudgeCounter(): void {
  storageRemove(NUDGE_COUNTER_KEY);
}

/* ── Export / Import ── */

export function exportRegistrationData(): RegistrationData | null {
  return getRegistration();
}

export function importRegistrationData(data: RegistrationData | null): void {
  if (data) storageSet(REGISTRATION_KEY, JSON.stringify(data));
}

export function clearRegistrationData(): void {
  storageRemove(REGISTRATION_KEY);
  storageRemove(NUDGE_COUNTER_KEY);
}
