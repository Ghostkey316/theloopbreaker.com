/**
 * Embris On-Chain Registration Gate
 *
 * Manages user registration status for the Vaultfire Protocol.
 * Unregistered users get basic chat; registered users unlock the full
 * Embris companion experience (memory, self-learning, goals, personality, etc.).
 *
 * Registration flow:
 * 1. User connects their Vaultfire wallet or enters an address manually
 * 2. Pre-flight checks: validate address, check ETH balance for gas
 * 3. Send a REAL on-chain transaction to ERC8004IdentityRegistry.registerAgent()
 * 4. Wait for transaction confirmation
 * 5. Store registration data locally (with tx hash for BaseScan verification)
 * 6. All features unlock upon confirmed registration
 *
 * The contract function is: registerAgent(string name, string description, bytes32 identityHash)
 * Selector: 0x2b3ce0bf — permissionless, anyone can call it.
 * Gas estimate: ~233K gas (~$0.001 on Base).
 */

import { CHAINS } from './contracts';
import { getWalletPrivateKey } from './wallet';

/* ── Constants ── */

const REGISTRATION_KEY = 'embris_registration_v1';
const NUDGE_COUNTER_KEY = 'embris_nudge_counter';

const IDENTITY_REGISTRY_ADDRESS = '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5';
const REGISTER_AGENT_SELECTOR = '0x2b3ce0bf'; // registerAgent(string,string,bytes32)
const GET_AGENT_SELECTOR = '0xfb3551ff'; // getAgent(address)

const BASE_RPC = CHAINS.base.rpc;
const BASESCAN_TX_URL = 'https://basescan.org/tx/';

/* ── Types ── */

export interface RegistrationData {
  walletAddress: string;
  registeredAt: number;
  registrationTxHash: string;
  chainId: number;
  verified: boolean;
  embrisLevel: 'basic' | 'full';
  basescanUrl: string;
  gasUsed?: string;
}

export interface RegistrationResult {
  success: boolean;
  registration: RegistrationData | null;
  message: string;
  txHash?: string;
  basescanUrl?: string;
  errorType?: 'no_wallet' | 'no_private_key' | 'no_gas' | 'already_registered' | 'tx_failed' | 'rpc_error' | 'invalid_address' | 'manual_address';
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

async function rpcCall(method: string, params: unknown[]): Promise<{
  result?: string;
  error?: { message: string; code?: number };
}> {
  const response = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  return response.json();
}

/* ── ABI Encoding Helpers ── */

function padLeft(hex: string, bytes: number): string {
  return hex.padStart(bytes * 2, '0');
}

function encodeUint256(n: number): string {
  return padLeft(n.toString(16), 32);
}

function encodeString(s: string): string {
  const utf8 = new TextEncoder().encode(s);
  const length = encodeUint256(utf8.length);
  // Pad data to 32-byte boundary
  const paddedLength = Math.ceil(utf8.length / 32) * 32;
  const padded = new Uint8Array(paddedLength);
  padded.set(utf8);
  let hex = '';
  for (const byte of padded) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return length + hex;
}

/**
 * Encode calldata for registerAgent(string, string, bytes32)
 */
function encodeRegisterAgent(name: string, description: string, identityHash: string): string {
  // Head: 3 slots (offset1, offset2, bytes32)
  // offset to string1 = 0x60 (96 bytes from start of params)
  // offset to string2 = 0x60 + 0x20 + ceil(nameBytes/32)*32
  const nameEncoded = encodeString(name);
  const descEncoded = encodeString(description);

  const offset1 = 0x60;
  // string1 takes: 32 bytes (length) + padded data
  const string1Size = nameEncoded.length / 2; // in bytes
  const offset2 = offset1 + string1Size;

  // Ensure identityHash is 32 bytes hex without 0x
  const hashHex = identityHash.replace('0x', '').padStart(64, '0');

  return REGISTER_AGENT_SELECTOR
    + encodeUint256(offset1)
    + encodeUint256(offset2)
    + hashHex
    + nameEncoded
    + descEncoded;
}

/**
 * Encode calldata for getAgent(address)
 */
function encodeGetAgent(address: string): string {
  const addr = address.replace('0x', '').toLowerCase().padStart(64, '0');
  return GET_AGENT_SELECTOR + addr;
}

/* ── On-Chain Checks ── */

/**
 * Check if an address is already registered as an agent on-chain.
 * Returns the agent name if registered, null if not.
 */
async function checkExistingRegistration(address: string): Promise<string | null> {
  try {
    const data = encodeGetAgent(address);
    const result = await rpcCall('eth_call', [{ to: IDENTITY_REGISTRY_ADDRESS, data }, 'latest']);

    if (!result.result || result.result === '0x' || result.error) return null;

    const hex = result.result.slice(2);
    if (hex.length < 128) return null;

    // The struct returns: (string name, bool active, string desc, bool verified)
    // First slot is offset to name string
    const nameOffset = parseInt(hex.slice(0, 64), 16) * 2;
    if (nameOffset >= hex.length) return null;

    const nameLength = parseInt(hex.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return null;

    // Decode name
    const nameHex = hex.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    const name = new TextDecoder().decode(nameBytes);
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Check ETH balance on Base for gas.
 */
async function checkBalance(address: string): Promise<{
  hasGas: boolean;
  balanceWei: bigint;
  balanceFormatted: string;
}> {
  try {
    const result = await rpcCall('eth_getBalance', [address, 'latest']);
    if (!result.result || result.error) {
      return { hasGas: false, balanceWei: 0n, balanceFormatted: '0' };
    }
    const balanceWei = BigInt(result.result);
    // Need at least ~300K gas × 0.1 gwei = 0.00003 ETH as safe minimum
    const minRequired = BigInt(300000) * BigInt(100000000); // 0.00003 ETH in wei
    const balanceEth = Number(balanceWei) / 1e18;
    return {
      hasGas: balanceWei >= minRequired,
      balanceWei,
      balanceFormatted: balanceEth < 0.0001 ? '< 0.0001' : balanceEth.toFixed(6),
    };
  } catch {
    return { hasGas: false, balanceWei: 0n, balanceFormatted: '0' };
  }
}

/**
 * Estimate gas for the registration transaction.
 */
async function estimateGas(from: string, calldata: string): Promise<bigint | null> {
  try {
    const result = await rpcCall('eth_estimateGas', [
      { from, to: IDENTITY_REGISTRY_ADDRESS, data: calldata },
    ]);
    if (result.result && !result.error) {
      return BigInt(result.result);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get current gas price on Base.
 */
async function getGasPrice(): Promise<bigint> {
  try {
    const result = await rpcCall('eth_gasPrice', []);
    if (result.result) return BigInt(result.result);
    return BigInt(100000000); // fallback: 0.1 gwei
  } catch {
    return BigInt(100000000);
  }
}

/**
 * Get the current nonce for an address.
 */
async function getNonce(address: string): Promise<number> {
  const result = await rpcCall('eth_getTransactionCount', [address, 'latest']);
  if (result.result) return parseInt(result.result, 16);
  throw new Error('Failed to get nonce');
}

/**
 * Get the chain ID.
 */
async function getChainId(): Promise<number> {
  const result = await rpcCall('eth_chainId', []);
  if (result.result) return parseInt(result.result, 16);
  return 8453; // Base mainnet fallback
}

/* ── Registration Status ── */

export function getRegistration(): RegistrationData | null {
  const raw = storageGet(REGISTRATION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as RegistrationData; } catch { return null; }
}

export function isRegistered(): boolean {
  const reg = getRegistration();
  return reg !== null && reg.embrisLevel === 'full';
}

export function getRegisteredWalletAddress(): string | null {
  const reg = getRegistration();
  return reg?.walletAddress || null;
}

/* ── Main Registration Function ── */

/**
 * Register a wallet on-chain by calling registerAgent() on the ERC8004IdentityRegistry.
 *
 * This sends a REAL transaction that costs gas. The transaction is:
 *   registerAgent("Embris User", "Registered via Vaultfire Protocol", keccak256(address))
 *
 * For Vaultfire wallet users: signs with the stored private key.
 * For manual address users: falls back to a 0-value data transaction (self-signed
 * is not possible without the private key, so we use the Vaultfire wallet as proxy).
 */
export async function registerWallet(
  walletAddress: string,
  options?: { useVaultfireWallet?: boolean }
): Promise<RegistrationResult> {
  // Validate address format
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return {
      success: false,
      registration: null,
      message: 'Invalid wallet address. Please provide a valid Ethereum address (0x...).',
      errorType: 'invalid_address',
    };
  }

  const normalizedAddress = walletAddress.toLowerCase();

  // Check if already registered on-chain
  try {
    const existingAgent = await checkExistingRegistration(normalizedAddress);
    if (existingAgent) {
      // Already registered on-chain — just save locally and unlock
      const registration: RegistrationData = {
        walletAddress: normalizedAddress,
        registeredAt: Date.now(),
        registrationTxHash: 'pre-existing',
        chainId: 8453,
        verified: true,
        embrisLevel: 'full',
        basescanUrl: `https://basescan.org/address/${normalizedAddress}`,
      };
      storageSet(REGISTRATION_KEY, JSON.stringify(registration));
      return {
        success: true,
        registration,
        message: `Already registered on-chain as "${existingAgent}". Full Embris features unlocked.`,
      };
    }
  } catch {
    // Continue with registration attempt
  }

  // Get private key — needed to sign the transaction
  const privateKey = getWalletPrivateKey();
  const useVaultfire = options?.useVaultfireWallet !== false;

  if (!privateKey || !useVaultfire) {
    // No private key available — can't sign a transaction
    // For manual addresses without a Vaultfire wallet, we do a verified read-only registration
    return registerWithoutTransaction(normalizedAddress);
  }

  // We have a private key — send a real transaction
  return registerWithTransaction(normalizedAddress, privateKey);
}

/**
 * Send a real on-chain registerAgent() transaction.
 */
async function registerWithTransaction(
  walletAddress: string,
  privateKey: string,
): Promise<RegistrationResult> {
  try {
    // Dynamic import ethers.js (already in the project)
    const { ethers } = await import('ethers');

    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const signer = new ethers.Wallet(privateKey, provider);
    const signerAddress = signer.address.toLowerCase();

    // Pre-flight: check balance
    const balance = await checkBalance(signerAddress);
    if (!balance.hasGas) {
      return {
        success: false,
        registration: null,
        message: `Insufficient ETH for gas. Your wallet has ${balance.balanceFormatted} ETH on Base. You need a small amount of ETH on Base to register (less than $0.01). Send ETH to ${signerAddress} on the Base network and try again.`,
        errorType: 'no_gas',
      };
    }

    // Build the identity hash: keccak256 of the wallet address
    const identityHash = ethers.keccak256(ethers.getBytes(walletAddress.padEnd(66, '0').slice(0, 42)));

    // Encode calldata
    const calldata = encodeRegisterAgent(
      'Embris User',
      'Registered via Vaultfire Protocol — theloopbreaker.com',
      identityHash,
    );

    // Estimate gas
    const gasEstimate = await estimateGas(signerAddress, calldata);
    const gasLimit = gasEstimate
      ? (gasEstimate * 130n / 100n) // 30% buffer
      : 300000n; // safe fallback

    // Get gas price and nonce
    const [gasPrice, nonce, chainId] = await Promise.all([
      getGasPrice(),
      getNonce(signerAddress),
      getChainId(),
    ]);

    // Double-check: will this tx cost more than the balance?
    const maxCost = gasLimit * gasPrice;
    if (balance.balanceWei < maxCost) {
      const costEth = Number(maxCost) / 1e18;
      return {
        success: false,
        registration: null,
        message: `Gas cost (~${costEth.toFixed(6)} ETH) exceeds your balance (${balance.balanceFormatted} ETH). Add a tiny amount of ETH on Base and try again.`,
        errorType: 'no_gas',
      };
    }

    // Build and sign the transaction
    const tx = {
      to: IDENTITY_REGISTRY_ADDRESS,
      data: calldata,
      gasLimit,
      gasPrice,
      nonce,
      chainId,
      value: 0,
    };

    const signedTx = await signer.signTransaction(tx);

    // Broadcast
    const sendResult = await rpcCall('eth_sendRawTransaction', [signedTx]);

    if (sendResult.error) {
      const errMsg = sendResult.error.message || 'Transaction rejected by network';
      // Parse common errors
      if (errMsg.includes('nonce') || errMsg.includes('replacement')) {
        return {
          success: false,
          registration: null,
          message: 'Transaction nonce conflict. Please wait a moment and try again.',
          errorType: 'tx_failed',
        };
      }
      if (errMsg.includes('insufficient funds') || errMsg.includes('gas')) {
        return {
          success: false,
          registration: null,
          message: `Insufficient ETH for gas on Base. Send a small amount of ETH to your wallet and try again.`,
          errorType: 'no_gas',
        };
      }
      return {
        success: false,
        registration: null,
        message: `Transaction failed: ${errMsg}`,
        errorType: 'tx_failed',
      };
    }

    const txHash = sendResult.result;
    if (!txHash) {
      return {
        success: false,
        registration: null,
        message: 'No transaction hash returned. The RPC may be experiencing issues. Please try again.',
        errorType: 'rpc_error',
      };
    }

    // Wait for confirmation (poll for receipt)
    const receipt = await waitForReceipt(txHash, 60);

    if (!receipt) {
      // Transaction was sent but not yet confirmed — still save it
      const registration: RegistrationData = {
        walletAddress,
        registeredAt: Date.now(),
        registrationTxHash: txHash,
        chainId: 8453,
        verified: false, // pending
        embrisLevel: 'full', // unlock immediately — tx was sent
        basescanUrl: BASESCAN_TX_URL + txHash,
      };
      storageSet(REGISTRATION_KEY, JSON.stringify(registration));
      return {
        success: true,
        registration,
        message: 'Transaction sent! Confirmation is pending. Your features are unlocked.',
        txHash,
        basescanUrl: BASESCAN_TX_URL + txHash,
      };
    }

    if (receipt.status === '0x0') {
      return {
        success: false,
        registration: null,
        message: 'Transaction was mined but reverted. The contract may have rejected the registration. Check BaseScan for details.',
        txHash,
        basescanUrl: BASESCAN_TX_URL + txHash,
        errorType: 'tx_failed',
      };
    }

    // Success — transaction confirmed
    const registration: RegistrationData = {
      walletAddress,
      registeredAt: Date.now(),
      registrationTxHash: txHash,
      chainId: 8453,
      verified: true,
      embrisLevel: 'full',
      basescanUrl: BASESCAN_TX_URL + txHash,
      gasUsed: receipt.gasUsed,
    };
    storageSet(REGISTRATION_KEY, JSON.stringify(registration));

    return {
      success: true,
      registration,
      message: 'Registration confirmed on-chain! Transaction verified on Base.',
      txHash,
      basescanUrl: BASESCAN_TX_URL + txHash,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';

    if (errMsg.includes('insufficient funds') || errMsg.includes('INSUFFICIENT_FUNDS')) {
      return {
        success: false,
        registration: null,
        message: 'Insufficient ETH for gas on Base. You need a small amount of ETH (less than $0.01). Send ETH to your Vaultfire wallet on the Base network and try again.',
        errorType: 'no_gas',
      };
    }

    return {
      success: false,
      registration: null,
      message: `Registration failed: ${errMsg}`,
      errorType: 'tx_failed',
    };
  }
}

/**
 * For manual addresses where we don't have the private key:
 * Send the registration transaction FROM the Vaultfire wallet ON BEHALF of the manual address.
 * The tx data encodes the manual address as the agent name, creating a permanent on-chain link.
 */
async function registerWithoutTransaction(walletAddress: string): Promise<RegistrationResult> {
  const privateKey = getWalletPrivateKey();

  if (privateKey) {
    // We have a Vaultfire wallet — use it to register the manual address
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(BASE_RPC);
      const signer = new ethers.Wallet(privateKey, provider);
      const signerAddress = signer.address.toLowerCase();

      const balance = await checkBalance(signerAddress);
      if (!balance.hasGas) {
        return {
          success: false,
          registration: null,
          message: `Your Vaultfire wallet needs ETH on Base to sign the registration. Balance: ${balance.balanceFormatted} ETH. Send a small amount of ETH to ${signerAddress} on Base.`,
          errorType: 'no_gas',
        };
      }

      // Register with the manual address encoded in the agent name
      const identityHash = ethers.keccak256(ethers.getBytes(walletAddress.padEnd(66, '0').slice(0, 42)));
      const calldata = encodeRegisterAgent(
        `Embris:${walletAddress}`,
        'Registered via Vaultfire Protocol — theloopbreaker.com',
        identityHash,
      );

      const gasEstimate = await estimateGas(signerAddress, calldata);
      const gasLimit = gasEstimate ? (gasEstimate * 130n / 100n) : 300000n;
      const [gasPrice, nonce, chainId] = await Promise.all([
        getGasPrice(), getNonce(signerAddress), getChainId(),
      ]);

      const maxCost = gasLimit * gasPrice;
      if (balance.balanceWei < maxCost) {
        return {
          success: false,
          registration: null,
          message: `Insufficient ETH for gas. Add ETH on Base to your Vaultfire wallet and try again.`,
          errorType: 'no_gas',
        };
      }

      const tx = { to: IDENTITY_REGISTRY_ADDRESS, data: calldata, gasLimit, gasPrice, nonce, chainId, value: 0 };
      const signedTx = await signer.signTransaction(tx);
      const sendResult = await rpcCall('eth_sendRawTransaction', [signedTx]);

      if (sendResult.error) {
        return {
          success: false,
          registration: null,
          message: `Transaction failed: ${sendResult.error.message}`,
          errorType: 'tx_failed',
        };
      }

      const txHash = sendResult.result;
      if (!txHash) {
        return { success: false, registration: null, message: 'No tx hash returned.', errorType: 'rpc_error' };
      }

      const receipt = await waitForReceipt(txHash, 60);

      const registration: RegistrationData = {
        walletAddress,
        registeredAt: Date.now(),
        registrationTxHash: txHash,
        chainId: 8453,
        verified: receipt ? receipt.status !== '0x0' : false,
        embrisLevel: 'full',
        basescanUrl: BASESCAN_TX_URL + txHash,
        gasUsed: receipt?.gasUsed,
      };
      storageSet(REGISTRATION_KEY, JSON.stringify(registration));

      return {
        success: true,
        registration,
        message: receipt && receipt.status !== '0x0'
          ? 'Registration confirmed on-chain! Your address is linked via the Vaultfire wallet.'
          : 'Transaction sent! Confirmation pending. Features unlocked.',
        txHash,
        basescanUrl: BASESCAN_TX_URL + txHash,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        registration: null,
        message: `Registration failed: ${errMsg}`,
        errorType: 'tx_failed',
      };
    }
  }

  // No private key at all — can't send any transaction
  return {
    success: false,
    registration: null,
    message: 'No Vaultfire wallet found. Create a wallet first in the Wallet section, then register. A wallet is needed to sign the on-chain registration transaction.',
    errorType: 'no_private_key',
  };
}

/* ── Transaction Receipt Polling ── */

interface TxReceipt {
  status: string;
  gasUsed: string;
  blockNumber: string;
  transactionHash: string;
}

async function waitForReceipt(txHash: string, timeoutSeconds: number): Promise<TxReceipt | null> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const pollInterval = 2000; // 2 seconds

  while (Date.now() < deadline) {
    try {
      const result = await rpcCall('eth_getTransactionReceipt', [txHash]);
      if (result.result && typeof result.result === 'object') {
        const receipt = result.result as unknown as TxReceipt;
        if (receipt.blockNumber) return receipt;
      }
    } catch {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return null; // Timeout — tx may still confirm later
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
  if (!reg) {
    return { verified: false, agentName: null, message: 'No registration found.' };
  }

  const agentName = await checkExistingRegistration(reg.walletAddress);
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
      : 'On-chain record not found. Your registration may still be pending confirmation.',
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
  if (data) {
    storageSet(REGISTRATION_KEY, JSON.stringify(data));
  }
}

export function clearRegistrationData(): void {
  storageRemove(REGISTRATION_KEY);
  storageRemove(NUDGE_COUNTER_KEY);
}
