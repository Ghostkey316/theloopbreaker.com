/**
 * Wallet Service
 * Manages wallet address, on-chain balance lookups, and data display
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";

const WALLET_ADDRESS_KEY = "vaultfire_wallet_address";

export interface WalletData {
  address: string;
  balanceBase: string;
  balanceAvalanche: string;
  lastUpdated: number;
}

async function jsonRpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/**
 * Format a hex balance (wei) to a human-readable ETH string with 4 decimal places.
 * Uses pure BigInt math — no ethers.js dependency needed.
 */
function formatWeiToEth(hexBalance: string): string {
  try {
    const wei = BigInt(hexBalance);
    const whole = wei / BigInt(10 ** 18);
    const remainder = wei % BigInt(10 ** 18);
    // Get 4 decimal places
    const decimals = (remainder * BigInt(10000)) / BigInt(10 ** 18);
    const decStr = decimals.toString().padStart(4, "0");
    return `${whole.toString()}.${decStr}`;
  } catch {
    return "0.0000";
  }
}

export async function saveWalletAddress(address: string): Promise<void> {
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error("Invalid Ethereum address format");
  }
  await AsyncStorage.setItem(WALLET_ADDRESS_KEY, address.toLowerCase());
}

export async function getWalletAddress(): Promise<string | null> {
  return AsyncStorage.getItem(WALLET_ADDRESS_KEY);
}

export async function clearWalletAddress(): Promise<void> {
  await AsyncStorage.removeItem(WALLET_ADDRESS_KEY);
}

export async function validateAddress(address: string): Promise<boolean> {
  return address.match(/^0x[a-fA-F0-9]{40}$/) !== null;
}

/**
 * Fetch real on-chain balances for a wallet address on both Ethereum, Base, and Avalanche.
 */
export async function getWalletData(address: string): Promise<WalletData> {
  const [baseBalanceHex, avaxBalanceHex] = await Promise.allSettled([
    jsonRpcCall(CHAINS.base.rpc, "eth_getBalance", [address, "latest"]) as Promise<string>,
    jsonRpcCall(CHAINS.avalanche.rpc, "eth_getBalance", [address, "latest"]) as Promise<string>,
  ]);

  const balanceBase =
    baseBalanceHex.status === "fulfilled"
      ? formatWeiToEth(baseBalanceHex.value)
      : "0.0000";

  const balanceAvalanche =
    avaxBalanceHex.status === "fulfilled"
      ? formatWeiToEth(avaxBalanceHex.value)
      : "0.0000";

  return {
    address: address.toLowerCase(),
    balanceBase,
    balanceAvalanche,
    lastUpdated: Date.now(),
  };
}
