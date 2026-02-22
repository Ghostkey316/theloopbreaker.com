/**
 * Vaultfire Wallet Core
 *
 * Native wallet with keypair generation, secure storage, and multi-chain balance fetching.
 * Private key NEVER leaves the device — stored encrypted via Expo SecureStore.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Secure Storage Abstraction ──────────────────────────────────────

const SECURE_KEYS = {
  PRIVATE_KEY: "vaultfire_wallet_pk",
  MNEMONIC: "vaultfire_wallet_mnemonic",
  ADDRESS: "vaultfire_wallet_address",
  WALLET_CREATED: "vaultfire_wallet_created",
} as const;

/**
 * Cross-platform secure storage.
 * Uses Expo SecureStore on native, AsyncStorage on web (with warning).
 */
async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    // Web fallback — NOT truly secure, but functional for development
    await AsyncStorage.setItem(`secure_${key}`, value);
  } else {
    const SecureStore = require("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(`secure_${key}`);
  } else {
    const SecureStore = require("expo-secure-store");
    return SecureStore.getItemAsync(key);
  }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(`secure_${key}`);
  } else {
    const SecureStore = require("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  }
}

// ─── Chain Configuration ─────────────────────────────────────────────

export interface ChainConfig {
  name: string;
  chainId: number;
  rpc: string;
  symbol: string;
  color: string;
  explorerUrl: string;
  /** Emoji or icon identifier */
  logo: string;
}

/**
 * Modular chain configuration array.
 * Adding a new EVM chain is as simple as adding an entry here.
 */
export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    name: "Ethereum",
    chainId: 1,
    rpc: "https://eth.llamarpc.com",
    symbol: "ETH",
    color: "#627EEA",
    explorerUrl: "https://etherscan.io",
    logo: "⟠",
  },
  {
    name: "Base",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    symbol: "ETH",
    color: "#0052FF",
    explorerUrl: "https://basescan.org",
    logo: "🔵",
  },
  {
    name: "Avalanche",
    chainId: 43114,
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    symbol: "AVAX",
    color: "#E84142",
    explorerUrl: "https://snowtrace.io",
    logo: "🔺",
  },
  // Add Solana, Arbitrum, Polygon here when ready
  // {
  //   name: "Arbitrum",
  //   chainId: 42161,
  //   rpc: "https://arb1.arbitrum.io/rpc",
  //   symbol: "ETH",
  //   color: "#28A0F0",
  //   explorerUrl: "https://arbiscan.io",
  //   logo: "🔷",
  // },
  // {
  //   name: "Polygon",
  //   chainId: 137,
  //   rpc: "https://polygon-rpc.com",
  //   symbol: "MATIC",
  //   color: "#8247E5",
  //   explorerUrl: "https://polygonscan.com",
  //   logo: "🟣",
  // },
];

// ─── Wallet Types ────────────────────────────────────────────────────

export interface WalletInfo {
  address: string;
  mnemonic: string | null;
}

export interface ChainBalance {
  chain: ChainConfig;
  balanceWei: string;
  balanceFormatted: string;
  balanceUsd: string | null; // Placeholder for future price integration
  error: boolean;
}

export interface WalletState {
  isCreated: boolean;
  address: string | null;
  balances: ChainBalance[];
  loading: boolean;
}

// ─── Wallet Generation ───────────────────────────────────────────────

/**
 * Generate a new Ethereum wallet with a random 12-word mnemonic.
 * Uses ethers.js Wallet.createRandom() for cryptographically secure generation.
 */
export async function createWallet(): Promise<WalletInfo> {
  const { Wallet } = await import("ethers");
  const wallet = Wallet.createRandom();

  const address = wallet.address;
  const mnemonic = wallet.mnemonic?.phrase ?? null;
  const privateKey = wallet.privateKey;

  // Store securely on device
  await secureSet(SECURE_KEYS.PRIVATE_KEY, privateKey);
  if (mnemonic) {
    await secureSet(SECURE_KEYS.MNEMONIC, mnemonic);
  }
  await secureSet(SECURE_KEYS.ADDRESS, address);
  await AsyncStorage.setItem(SECURE_KEYS.WALLET_CREATED, "true");

  return { address, mnemonic };
}

/**
 * Import a wallet from a seed phrase (mnemonic).
 */
export async function importFromMnemonic(mnemonic: string): Promise<WalletInfo> {
  const { Wallet, HDNodeWallet } = await import("ethers");
  const trimmed = mnemonic.trim().toLowerCase();

  // Validate word count
  const words = trimmed.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    throw new Error("Seed phrase must be 12 or 24 words");
  }

  const hdWallet = HDNodeWallet.fromPhrase(trimmed);
  const address = hdWallet.address;
  const privateKey = hdWallet.privateKey;

  await secureSet(SECURE_KEYS.PRIVATE_KEY, privateKey);
  await secureSet(SECURE_KEYS.MNEMONIC, trimmed);
  await secureSet(SECURE_KEYS.ADDRESS, address);
  await AsyncStorage.setItem(SECURE_KEYS.WALLET_CREATED, "true");

  return { address, mnemonic: trimmed };
}

/**
 * Import a wallet from a raw private key.
 */
export async function importFromPrivateKey(privateKey: string): Promise<WalletInfo> {
  const { Wallet } = await import("ethers");
  const trimmed = privateKey.trim();

  // Add 0x prefix if missing
  const pk = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  const wallet = new Wallet(pk);
  const address = wallet.address;

  await secureSet(SECURE_KEYS.PRIVATE_KEY, pk);
  await secureSet(SECURE_KEYS.ADDRESS, address);
  await AsyncStorage.setItem(SECURE_KEYS.WALLET_CREATED, "true");

  return { address, mnemonic: null };
}

// ─── Wallet State ────────────────────────────────────────────────────

/**
 * Check if a wallet has been created.
 */
export async function isWalletCreated(): Promise<boolean> {
  const created = await AsyncStorage.getItem(SECURE_KEYS.WALLET_CREATED);
  return created === "true";
}

/**
 * Get the stored wallet address.
 */
export async function getWalletAddress(): Promise<string | null> {
  return secureGet(SECURE_KEYS.ADDRESS);
}

/**
 * Get the stored wallet private key (for transaction signing).
 * Returns null if no wallet is created.
 */
export async function getWalletPrivateKey(): Promise<string | null> {
  return secureGet(SECURE_KEYS.PRIVATE_KEY);
}

/**
 * Get the stored wallet mnemonic (for backup display in settings).
 * Returns null if no mnemonic is stored (e.g., imported via private key).
 */
export async function getWalletMnemonic(): Promise<string | null> {
  return secureGet(SECURE_KEYS.MNEMONIC);
}

/**
 * Delete the wallet and all stored keys.
 */
export async function deleteWallet(): Promise<void> {
  await secureDelete(SECURE_KEYS.PRIVATE_KEY);
  await secureDelete(SECURE_KEYS.MNEMONIC);
  await secureDelete(SECURE_KEYS.ADDRESS);
  await AsyncStorage.removeItem(SECURE_KEYS.WALLET_CREATED);
}

// ─── Balance Fetching ────────────────────────────────────────────────

/**
 * JSON-RPC call helper.
 */
async function jsonRpc(rpc: string, method: string, params: unknown[]): Promise<string> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/**
 * Format wei (hex string) to human-readable ETH with 6 decimal places.
 * Uses BigInt to avoid floating-point precision issues.
 */
export function formatWei(weiHex: string): string {
  if (!weiHex || weiHex === "0x0" || weiHex === "0x") return "0.000000";
  const wei = BigInt(weiHex);
  const divisor = BigInt(10 ** 18);
  const whole = wei / divisor;
  const fraction = wei % divisor;
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fractionStr}`;
}

/**
 * Fetch the native token balance for an address on a specific chain.
 */
export async function getBalance(chain: ChainConfig, address: string): Promise<ChainBalance> {
  try {
    const balanceHex = await jsonRpc(chain.rpc, "eth_getBalance", [address, "latest"]);
    return {
      chain,
      balanceWei: balanceHex,
      balanceFormatted: formatWei(balanceHex),
      balanceUsd: null, // Price feed integration placeholder
      error: false,
    };
  } catch {
    return {
      chain,
      balanceWei: "0x0",
      balanceFormatted: "0.000000",
      balanceUsd: null,
      error: true,
    };
  }
}

/**
 * Fetch balances across all supported chains for an address.
 */
export async function getAllBalances(address: string): Promise<ChainBalance[]> {
  const results = await Promise.allSettled(
    SUPPORTED_CHAINS.map((chain) => getBalance(chain, address))
  );

  return results.map((result, idx) => {
    if (result.status === "fulfilled") return result.value;
    return {
      chain: SUPPORTED_CHAINS[idx],
      balanceWei: "0x0",
      balanceFormatted: "0.000000",
      balanceUsd: null,
      error: true,
    };
  });
}

/**
 * Calculate total portfolio value (sum of all balances in native tokens).
 * Returns a simplified string — in production, this would use price feeds.
 */
export function calculateTotalValue(balances: ChainBalance[]): string {
  let totalWei = BigInt(0);
  for (const b of balances) {
    if (b.balanceWei && b.balanceWei !== "0x0" && b.balanceWei !== "0x") {
      try {
        totalWei += BigInt(b.balanceWei);
      } catch {
        // Skip invalid values
      }
    }
  }
  return formatWei(`0x${totalWei.toString(16)}`);
}

/**
 * Get a summary string of wallet balances for Embris chat context.
 */
export async function getWalletContextForEmbris(): Promise<string | null> {
  const address = await getWalletAddress();
  if (!address) return null;

  try {
    const balances = await getAllBalances(address);
    const balanceLines = balances
      .map((b) => `${b.chain.name} (${b.chain.symbol}): ${b.balanceFormatted}`)
      .join(", ");
    return `User wallet: ${address}. Balances: ${balanceLines}`;
  } catch {
    return `User wallet: ${address}. Balances: unavailable`;
  }
}
