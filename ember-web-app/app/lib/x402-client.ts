/**
 * Vaultfire x402 Payment Client — Coinbase HTTP 402 Payment Protocol
 *
 * Implements the x402 open standard for internet-native payments using
 * USDC on Base mainnet via EIP-3009 (transferWithAuthorization).
 *
 * Protocol flow:
 *   1. Client requests a resource from a server
 *   2. Server responds HTTP 402 + PAYMENT-REQUIRED header
 *   3. Client signs a USDC transferWithAuthorization (EIP-712)
 *   4. Client resends request with PAYMENT-SIGNATURE header
 *   5. Facilitator verifies + settles, server returns resource
 *
 * References:
 *   - https://github.com/coinbase/x402
 *   - https://docs.x402.org
 *   - EIP-3009: transferWithAuthorization
 *   - EIP-712: Typed structured data signing
 *
 * @module x402-client
 */

import { getWalletAddress, getWalletPrivateKey, isWalletUnlocked } from './wallet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base mainnet USDC contract (EIP-3009 compatible) */
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/** Base mainnet chain ID */
export const BASE_CHAIN_ID = 8453;

/** x402 network identifier for Base mainnet */
export const BASE_NETWORK = 'eip155:8453';

/** Default facilitator URL (Coinbase x402 facilitator) */
export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

/** USDC decimals */
export const USDC_DECIMALS = 6;

/** Default payment timeout in seconds */
export const DEFAULT_TIMEOUT_SECONDS = 60;

/** x402 protocol version */
export const X402_VERSION = 2;

/** Header names per x402 v2 spec */
export const HEADERS = {
  PAYMENT_REQUIRED: 'X-PAYMENT-REQUIRED',
  PAYMENT_SIGNATURE: 'X-PAYMENT',
  PAYMENT_RESPONSE: 'X-PAYMENT-RESPONSE',
} as const;

// ---------------------------------------------------------------------------
// EIP-712 Domain & Types for USDC transferWithAuthorization (EIP-3009)
// ---------------------------------------------------------------------------

/**
 * EIP-712 domain for Base USDC.
 * USDC uses name="USD Coin", version="2".
 */
export const USDC_EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: BASE_CHAIN_ID,
  verifyingContract: BASE_USDC_ADDRESS,
} as const;

/**
 * EIP-712 type definition for TransferWithAuthorization (EIP-3009).
 * This is the standard type used by USDC for gasless transfers.
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resource description in x402 payment requirements */
export interface X402Resource {
  url: string;
  description?: string;
  mimeType?: string;
}

/** Extra fields for EVM exact scheme */
export interface X402ExtraEVM {
  assetTransferMethod: 'eip3009' | 'permit2';
  name: string;
  version: string;
}

/** A single payment requirement from the server */
export interface X402PaymentRequirement {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: X402ExtraEVM;
}

/** The full 402 response payload (decoded from PAYMENT-REQUIRED header) */
export interface X402PaymentRequired {
  x402Version: number;
  accepts: X402PaymentRequirement[];
  resource?: X402Resource;
  error?: string;
}

/** EIP-3009 authorization parameters */
export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/** The payload sent in the PAYMENT-SIGNATURE header */
export interface X402PaymentPayload {
  x402Version: number;
  resource?: X402Resource;
  accepted: X402PaymentRequirement;
  payload: {
    signature: string;
    authorization: EIP3009Authorization;
  };
}

/** Settlement response from the facilitator/server */
export interface X402SettlementResponse {
  success: boolean;
  txHash?: string;
  network?: string;
  error?: string;
}

/** Result of an x402 payment-gated fetch */
export interface X402FetchResult {
  response: Response;
  paid: boolean;
  paymentPayload?: X402PaymentPayload;
  settlement?: X402SettlementResponse;
  error?: string;
}

/** x402 payment history entry (persisted in localStorage) */
export interface X402PaymentRecord {
  id: string;
  timestamp: number;
  url: string;
  amount: string;
  amountFormatted: string;
  asset: string;
  network: string;
  payTo: string;
  from: string;
  txHash?: string;
  status: 'signed' | 'settled' | 'failed';
  description?: string;
}

/** Configuration for the x402 client */
export interface X402ClientConfig {
  /** Facilitator URL (default: Coinbase facilitator) */
  facilitatorUrl?: string;
  /** Auto-pay on 402 without prompting (default: false) */
  autoPay?: boolean;
  /** Maximum amount in USDC (human-readable) to auto-pay (default: 1.00) */
  maxAutoPayAmount?: string;
  /** Custom signer function (overrides wallet.ts integration) */
  customSigner?: (domain: object, types: object, value: object) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Payment History (localStorage persistence)
// ---------------------------------------------------------------------------

const PAYMENT_HISTORY_KEY = 'vaultfire_x402_payments';
const MAX_HISTORY_ENTRIES = 200;

/** Get all x402 payment records from local storage */
export function getPaymentHistory(): X402PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as X402PaymentRecord[];
  } catch {
    return [];
  }
}

/** Save a payment record to local storage */
export function savePaymentRecord(record: X402PaymentRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getPaymentHistory();
    history.unshift(record);
    // Keep only the most recent entries
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.length = MAX_HISTORY_ENTRIES;
    }
    localStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full — silently fail
  }
}

/** Update the status/txHash of an existing payment record */
export function updatePaymentRecord(
  id: string,
  updates: Partial<Pick<X402PaymentRecord, 'status' | 'txHash'>>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getPaymentHistory();
    const idx = history.findIndex((r) => r.id === id);
    if (idx >= 0) {
      history[idx] = { ...history[idx], ...updates };
      localStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(history));
    }
  } catch {
    // ignore
  }
}

/** Clear all payment history */
export function clearPaymentHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PAYMENT_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/** Get payment history summary stats */
export function getPaymentStats(): {
  totalPayments: number;
  totalAmountUsdc: string;
  settledCount: number;
  failedCount: number;
} {
  const history = getPaymentHistory();
  let totalMicro = 0n;
  let settled = 0;
  let failed = 0;

  for (const record of history) {
    try {
      totalMicro += BigInt(record.amount);
    } catch {
      // skip invalid amounts
    }
    if (record.status === 'settled') settled++;
    if (record.status === 'failed') failed++;
  }

  return {
    totalPayments: history.length,
    totalAmountUsdc: formatUsdc(totalMicro.toString()),
    settledCount: settled,
    failedCount: failed,
  };
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Format USDC micro-units (6 decimals) to human-readable string */
export function formatUsdc(microAmount: string): string {
  try {
    const n = BigInt(microAmount);
    const whole = n / 1000000n;
    const frac = n % 1000000n;
    const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
    if (!fracStr) return `${whole}.00`;
    return `${whole}.${fracStr}`;
  } catch {
    return '0.00';
  }
}

/** Parse human-readable USDC amount to micro-units string */
export function parseUsdc(humanAmount: string): string {
  try {
    const [whole = '0', frac = ''] = humanAmount.split('.');
    const fracPadded = frac.slice(0, 6).padEnd(6, '0');
    const micro = BigInt(whole) * 1000000n + BigInt(fracPadded);
    return micro.toString();
  } catch {
    return '0';
  }
}

/** Generate a random bytes32 nonce for EIP-3009 */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a unique payment ID */
function generatePaymentId(): string {
  return `x402_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Base64 encode a JSON object (for x402 headers) */
function encodeHeaderPayload(obj: object): string {
  if (typeof btoa === 'function') {
    return btoa(JSON.stringify(obj));
  }
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

/** Base64 decode a header string to JSON */
function decodeHeaderPayload<T>(b64: string): T {
  try {
    if (typeof atob === 'function') {
      return JSON.parse(atob(b64)) as T;
    }
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as T;
  } catch {
    throw new Error('Failed to decode x402 header payload');
  }
}

// ---------------------------------------------------------------------------
// EIP-712 Signing (uses ethers.js via wallet private key)
// ---------------------------------------------------------------------------

/**
 * Sign an EIP-3009 TransferWithAuthorization using EIP-712 typed data.
 *
 * Uses the Vaultfire wallet's private key (from session memory) to produce
 * a signature that authorizes the facilitator to call transferWithAuthorization
 * on the USDC contract.
 *
 * @param authorization - The transfer parameters to sign
 * @param customSigner  - Optional custom signer function
 * @returns The 65-byte hex signature
 */
export async function signTransferAuthorization(
  authorization: EIP3009Authorization,
  customSigner?: X402ClientConfig['customSigner'],
): Promise<string> {
  // Build the EIP-712 domain and value
  const domain: Record<string, unknown> = { ...USDC_EIP712_DOMAIN };
  const types: Record<string, Array<{ name: string; type: string }>> = { ...TRANSFER_WITH_AUTHORIZATION_TYPES };
  const value = {
    from: authorization.from,
    to: authorization.to,
    value: authorization.value,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
  };

  // Use custom signer if provided
  if (customSigner) {
    return customSigner(domain, types, value);
  }

  // Use the Vaultfire wallet's private key
  if (!isWalletUnlocked()) {
    throw new Error('Wallet is locked. Unlock your wallet before making x402 payments.');
  }

  const privateKey = getWalletPrivateKey();
  if (!privateKey) {
    throw new Error('No private key available. Unlock your wallet first.');
  }

  // Dynamic import ethers to keep the module tree-shakeable
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);

  // Sign the EIP-712 typed data
  const signature = await wallet.signTypedData(domain, types, value);
  return signature;
}

// ---------------------------------------------------------------------------
// x402 Protocol Operations
// ---------------------------------------------------------------------------

/**
 * Check if a Response is an x402 Payment Required response.
 */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/**
 * Parse the payment requirements from a 402 response.
 *
 * Checks both the PAYMENT-REQUIRED header and the response body.
 */
export async function parsePaymentRequired(
  response: Response,
): Promise<X402PaymentRequired | null> {
  // Try the header first (x402 v2 standard)
  const headerValue =
    response.headers.get(HEADERS.PAYMENT_REQUIRED) ||
    response.headers.get('payment-required');

  if (headerValue) {
    try {
      return decodeHeaderPayload<X402PaymentRequired>(headerValue);
    } catch {
      // Fall through to body parsing
    }
  }

  // Try parsing the response body as JSON
  try {
    const cloned = response.clone();
    const body = await cloned.json();
    if (body && (body.accepts || body.x402Version)) {
      return body as X402PaymentRequired;
    }
  } catch {
    // Not JSON or no payment info in body
  }

  return null;
}

/**
 * Select the best payment requirement from the server's accepted options.
 *
 * Prioritizes:
 *   1. Base USDC with EIP-3009 (our native support)
 *   2. Any EVM USDC with EIP-3009
 *   3. Any EVM option
 */
export function selectPaymentRequirement(
  requirements: X402PaymentRequired,
): X402PaymentRequirement | null {
  if (!requirements.accepts || requirements.accepts.length === 0) return null;

  // Priority 1: Base USDC with EIP-3009
  const baseUsdc3009 = requirements.accepts.find(
    (r) =>
      r.network === BASE_NETWORK &&
      r.asset.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase() &&
      r.extra?.assetTransferMethod === 'eip3009',
  );
  if (baseUsdc3009) return baseUsdc3009;

  // Priority 2: Base USDC (any method)
  const baseUsdc = requirements.accepts.find(
    (r) =>
      r.network === BASE_NETWORK &&
      r.asset.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase(),
  );
  if (baseUsdc) return baseUsdc;

  // Priority 3: Any Base network option
  const baseAny = requirements.accepts.find((r) => r.network === BASE_NETWORK);
  if (baseAny) return baseAny;

  // Priority 4: Any EVM option with EIP-3009
  const evm3009 = requirements.accepts.find(
    (r) => r.network.startsWith('eip155:') && r.extra?.assetTransferMethod === 'eip3009',
  );
  if (evm3009) return evm3009;

  // Fallback: first option
  return requirements.accepts[0];
}

/**
 * Create and sign an x402 payment payload for a given requirement.
 *
 * This builds the EIP-3009 authorization, signs it with EIP-712,
 * and returns the complete PaymentPayload ready for the header.
 *
 * @param requirement - The payment requirement to fulfill
 * @param resource    - Optional resource description
 * @param config      - Client configuration
 * @returns The signed payment payload
 */
export async function createPaymentPayload(
  requirement: X402PaymentRequirement,
  resource?: X402Resource,
  config: X402ClientConfig = {},
): Promise<X402PaymentPayload> {
  const walletAddress = getWalletAddress();
  if (!walletAddress) {
    throw new Error('No wallet address available. Create or import a wallet first.');
  }

  const now = Math.floor(Date.now() / 1000);
  const timeout = requirement.maxTimeoutSeconds || DEFAULT_TIMEOUT_SECONDS;

  // Build the EIP-3009 authorization
  const authorization: EIP3009Authorization = {
    from: walletAddress,
    to: requirement.payTo,
    value: requirement.amount,
    validAfter: (now - 5).toString(), // 5 seconds grace period
    validBefore: (now + timeout).toString(),
    nonce: generateNonce(),
  };

  // Sign with EIP-712
  const signature = await signTransferAuthorization(authorization, config.customSigner);

  const payload: X402PaymentPayload = {
    x402Version: X402_VERSION,
    resource,
    accepted: requirement,
    payload: {
      signature,
      authorization,
    },
  };

  return payload;
}

/**
 * Execute an x402 payment-gated fetch.
 *
 * This is the main entry point for making x402-aware HTTP requests.
 * It handles the full protocol flow:
 *   1. Makes the initial request
 *   2. If 402, parses requirements and signs a payment
 *   3. Resends with the payment header
 *   4. Returns the final response
 *
 * @param url     - The URL to fetch
 * @param init    - Standard fetch init options
 * @param config  - x402 client configuration
 * @returns The fetch result with payment metadata
 */
export async function x402Fetch(
  url: string,
  init: RequestInit = {},
  config: X402ClientConfig = {},
): Promise<X402FetchResult> {
  // Step 1: Make the initial request
  const initialResponse = await fetch(url, init);

  // If not 402, return as-is
  if (!isPaymentRequired(initialResponse)) {
    return { response: initialResponse, paid: false };
  }

  // Step 2: Parse payment requirements
  const requirements = await parsePaymentRequired(initialResponse);
  if (!requirements) {
    return {
      response: initialResponse,
      paid: false,
      error: 'Server returned 402 but no valid payment requirements found',
    };
  }

  // Step 3: Select the best payment option
  const selected = selectPaymentRequirement(requirements);
  if (!selected) {
    return {
      response: initialResponse,
      paid: false,
      error: 'No compatible payment option found in server requirements',
    };
  }

  // Step 4: Check auto-pay limits
  if (!config.autoPay) {
    return {
      response: initialResponse,
      paid: false,
      error: 'Payment required but auto-pay is disabled. Call payAndRetry() to proceed.',
    };
  }

  const maxAutoPayMicro = parseUsdc(config.maxAutoPayAmount || '1.00');
  if (BigInt(selected.amount) > BigInt(maxAutoPayMicro)) {
    return {
      response: initialResponse,
      paid: false,
      error: `Payment amount ${formatUsdc(selected.amount)} USDC exceeds auto-pay limit of ${config.maxAutoPayAmount || '1.00'} USDC`,
    };
  }

  // Step 5: Create and sign the payment
  return payAndRetry(url, init, selected, requirements.resource, config);
}

/**
 * Sign a payment and retry the request with the payment header.
 *
 * Use this when you want manual control over the payment flow
 * (e.g., after prompting the user for confirmation).
 *
 * @param url         - The URL to fetch
 * @param init        - Standard fetch init options
 * @param requirement - The selected payment requirement
 * @param resource    - Optional resource description
 * @param config      - Client configuration
 * @returns The fetch result with payment metadata
 */
export async function payAndRetry(
  url: string,
  init: RequestInit = {},
  requirement: X402PaymentRequirement,
  resource?: X402Resource,
  config: X402ClientConfig = {},
): Promise<X402FetchResult> {
  const paymentId = generatePaymentId();
  const walletAddress = getWalletAddress() || 'unknown';

  try {
    // Create the signed payment payload
    const paymentPayload = await createPaymentPayload(requirement, resource, config);

    // Record the payment attempt
    const record: X402PaymentRecord = {
      id: paymentId,
      timestamp: Date.now(),
      url,
      amount: requirement.amount,
      amountFormatted: formatUsdc(requirement.amount),
      asset: requirement.asset,
      network: requirement.network,
      payTo: requirement.payTo,
      from: walletAddress,
      status: 'signed',
      description: resource?.description,
    };
    savePaymentRecord(record);

    // Encode the payload for the header
    const encodedPayload = encodeHeaderPayload(paymentPayload);

    // Build the new request with the payment header
    const headers = new Headers(init.headers);
    headers.set(HEADERS.PAYMENT_SIGNATURE, encodedPayload);

    const paidResponse = await fetch(url, {
      ...init,
      headers,
    });

    // Check for settlement response in headers
    let settlement: X402SettlementResponse | undefined;
    const settlementHeader =
      paidResponse.headers.get(HEADERS.PAYMENT_RESPONSE) ||
      paidResponse.headers.get('payment-response');

    if (settlementHeader) {
      try {
        settlement = decodeHeaderPayload<X402SettlementResponse>(settlementHeader);
        // Update the record with settlement info
        updatePaymentRecord(paymentId, {
          status: settlement.success ? 'settled' : 'failed',
          txHash: settlement.txHash,
        });
      } catch {
        // Settlement header parse failed
      }
    }

    // If the response is successful, mark as settled
    if (paidResponse.ok && !settlement) {
      updatePaymentRecord(paymentId, { status: 'settled' });
    }

    return {
      response: paidResponse,
      paid: true,
      paymentPayload,
      settlement,
    };
  } catch (err) {
    // Record the failure
    updatePaymentRecord(paymentId, { status: 'failed' });

    const errorMessage = err instanceof Error ? err.message : 'Unknown payment error';
    return {
      response: new Response(JSON.stringify({ error: errorMessage }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }),
      paid: false,
      error: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience: x402-aware wrapper for common HTTP methods
// ---------------------------------------------------------------------------

/**
 * x402-aware GET request.
 */
export async function x402Get(
  url: string,
  config: X402ClientConfig = {},
): Promise<X402FetchResult> {
  return x402Fetch(url, { method: 'GET' }, config);
}

/**
 * x402-aware POST request.
 */
export async function x402Post(
  url: string,
  body: object,
  config: X402ClientConfig = {},
): Promise<X402FetchResult> {
  return x402Fetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config,
  );
}

// ---------------------------------------------------------------------------
// Verification helpers (for server-side / agent use)
// ---------------------------------------------------------------------------

/**
 * Verify an x402 payment signature locally.
 *
 * Recovers the signer address from the EIP-712 signature and checks
 * that it matches the authorization.from field.
 *
 * @param payload - The payment payload to verify
 * @returns Whether the signature is valid and the recovered address
 */
export async function verifyPaymentSignature(
  payload: X402PaymentPayload,
): Promise<{ valid: boolean; recoveredAddress: string; error?: string }> {
  try {
    const { ethers } = await import('ethers');

    const domain: Record<string, unknown> = { ...USDC_EIP712_DOMAIN };

    // Adjust domain for the payload's network if different from Base
    if (payload.accepted.network !== BASE_NETWORK) {
      const chainIdMatch = payload.accepted.network.match(/eip155:(\d+)/);
      if (chainIdMatch) {
        domain.chainId = parseInt(chainIdMatch[1], 10);
      }
      if (payload.accepted.asset) {
        domain.verifyingContract = payload.accepted.asset;
      }
    }

    const types: Record<string, Array<{ name: string; type: string }>> = { ...TRANSFER_WITH_AUTHORIZATION_TYPES };
    const value = {
      from: payload.payload.authorization.from,
      to: payload.payload.authorization.to,
      value: payload.payload.authorization.value,
      validAfter: payload.payload.authorization.validAfter,
      validBefore: payload.payload.authorization.validBefore,
      nonce: payload.payload.authorization.nonce,
    };

    const recoveredAddress = ethers.verifyTypedData(domain, types, value, payload.payload.signature);

    const valid =
      recoveredAddress.toLowerCase() === payload.payload.authorization.from.toLowerCase();

    return { valid, recoveredAddress };
  } catch (err) {
    return {
      valid: false,
      recoveredAddress: '',
      error: err instanceof Error ? err.message : 'Verification failed',
    };
  }
}

/**
 * Verify an x402 payment via a facilitator's /verify endpoint.
 *
 * @param payload       - The payment payload to verify
 * @param requirement   - The original payment requirement
 * @param facilitatorUrl - Facilitator URL (default: Coinbase)
 */
export async function verifyPaymentViaFacilitator(
  payload: X402PaymentPayload,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string = DEFAULT_FACILITATOR_URL,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload,
        requirement,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const result = await res.json();
    return {
      valid: result.valid === true,
      error: result.error,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Facilitator verification failed',
    };
  }
}

// ---------------------------------------------------------------------------
// USDC Balance Check (for pre-flight validation)
// ---------------------------------------------------------------------------

/** balanceOf(address) selector */
const BALANCE_OF_SELECTOR = '0x70a08231';

/**
 * Check the wallet's USDC balance on Base.
 * Returns the balance in micro-units (6 decimals).
 */
export async function getUsdcBalance(address?: string): Promise<string> {
  const addr = address || getWalletAddress();
  if (!addr) return '0';

  const paddedAddress = addr.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const calldata = BALANCE_OF_SELECTOR + paddedAddress;

  try {
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: BASE_USDC_ADDRESS, data: calldata }, 'latest'],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const json = await res.json();
    if (json.error) return '0';
    if (!json.result || json.result === '0x') return '0';
    return BigInt(json.result).toString();
  } catch {
    return '0';
  }
}

/**
 * Check if the wallet has enough USDC to cover a payment.
 *
 * @param amountMicro - Amount in USDC micro-units
 * @param address     - Wallet address (defaults to current wallet)
 */
export async function hasEnoughUsdc(
  amountMicro: string,
  address?: string,
): Promise<boolean> {
  const balance = await getUsdcBalance(address);
  return BigInt(balance) >= BigInt(amountMicro);
}

// ---------------------------------------------------------------------------
// High-level payment initiation (for XMTP / agent use)
// ---------------------------------------------------------------------------

/**
 * Initiate an x402 payment to a specific address for a given USDC amount.
 *
 * This creates a signed authorization that can be submitted to a facilitator
 * or sent as an XMTP transaction reference.
 *
 * @param recipientAddress - The address to pay
 * @param amountUsdc       - Amount in human-readable USDC (e.g., "1.50")
 * @param description      - Optional payment description
 * @param config           - Client configuration
 * @returns The signed payment payload and record
 */
export async function initiatePayment(
  recipientAddress: string,
  amountUsdc: string,
  description?: string,
  config: X402ClientConfig = {},
): Promise<{ payload: X402PaymentPayload; record: X402PaymentRecord }> {
  const amountMicro = parseUsdc(amountUsdc);
  const walletAddress = getWalletAddress();

  if (!walletAddress) {
    throw new Error('No wallet address available');
  }

  // Build a synthetic requirement
  const requirement: X402PaymentRequirement = {
    scheme: 'exact',
    network: BASE_NETWORK,
    amount: amountMicro,
    asset: BASE_USDC_ADDRESS,
    payTo: recipientAddress,
    maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    extra: {
      assetTransferMethod: 'eip3009',
      name: 'USDC',
      version: '2',
    },
  };

  const resource: X402Resource = {
    url: `x402://payment/${recipientAddress}`,
    description: description || `Payment of ${amountUsdc} USDC to ${recipientAddress.slice(0, 10)}...`,
  };

  const payload = await createPaymentPayload(requirement, resource, config);

  const record: X402PaymentRecord = {
    id: generatePaymentId(),
    timestamp: Date.now(),
    url: resource.url,
    amount: amountMicro,
    amountFormatted: amountUsdc,
    asset: BASE_USDC_ADDRESS,
    network: BASE_NETWORK,
    payTo: recipientAddress,
    from: walletAddress,
    status: 'signed',
    description: resource.description,
  };

  savePaymentRecord(record);

  return { payload, record };
}
