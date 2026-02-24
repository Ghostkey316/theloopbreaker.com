/**
 * Embris by Vaultfire — x402 Payment Client (Mobile)
 * EIP-712 USDC signing for x402 payment protocol.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface X402PaymentPayload {
  url: string;
  amount: string;
  asset: string;
  network: string;
  payTo: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  scheme: string;
  mimeType?: string;
}

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
  recipientVNS?: string;
  senderVNS?: string;
}

export interface X402SignatureResult {
  signature: string;
  payload: X402PaymentPayload;
  timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const X402_STORAGE_KEY = 'vaultfire_x402_payments';

export const X402_HEADERS = {
  PAYMENT_REQUIRED: 'X-PAYMENT-REQUIRED',
  PAYMENT_SIGNATURE: 'X-PAYMENT',
  PAYMENT_RESPONSE: 'X-PAYMENT-RESPONSE',
} as const;

// USDC contract addresses
export const USDC_ADDRESSES: Record<string, string> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

// ─── EIP-712 Domain ──────────────────────────────────────────────────────────
export const EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  verifyingContract: USDC_ADDRESSES.base,
};

export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ─── Payment Record CRUD ─────────────────────────────────────────────────────
export async function getPaymentHistory(): Promise<X402PaymentRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(X402_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function savePaymentRecord(record: X402PaymentRecord): Promise<void> {
  const records = await getPaymentHistory();
  records.unshift(record);
  // Keep last 100 records
  const trimmed = records.slice(0, 100);
  await AsyncStorage.setItem(X402_STORAGE_KEY, JSON.stringify(trimmed));
}

export async function clearPaymentHistory(): Promise<void> {
  await AsyncStorage.removeItem(X402_STORAGE_KEY);
}

// ─── Payment Parsing ─────────────────────────────────────────────────────────
export function parseX402Header(header: string): X402PaymentPayload | null {
  try {
    return JSON.parse(atob(header)) as X402PaymentPayload;
  } catch {
    try {
      return JSON.parse(header) as X402PaymentPayload;
    } catch { return null; }
  }
}

export function formatUSDCAmount(amountWei: string): string {
  const num = parseFloat(amountWei) / 1e6;
  return num.toFixed(2);
}

export function parseUSDCAmount(amountUSD: string): string {
  return Math.floor(parseFloat(amountUSD) * 1e6).toString();
}

// ─── Payment Stats ───────────────────────────────────────────────────────────
export async function getPaymentStats(): Promise<{
  totalPaid: number;
  totalReceived: number;
  transactionCount: number;
  averageAmount: number;
}> {
  const records = await getPaymentHistory();
  let totalPaid = 0;
  let totalReceived = 0;

  for (const r of records) {
    const amount = parseFloat(r.amountFormatted) || 0;
    if (r.status === 'settled' || r.status === 'signed') {
      totalPaid += amount;
    }
  }

  return {
    totalPaid,
    totalReceived,
    transactionCount: records.length,
    averageAmount: records.length > 0 ? totalPaid / records.length : 0,
  };
}
