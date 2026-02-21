/**
 * Wallet Service
 * Manages wallet address and on-chain data lookups
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getContractBalance, getAgentCount } from "./contract-reader";
import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";

const WALLET_ADDRESS_KEY = "vaultfire_wallet_address";

export interface WalletData {
  address: string;
  balanceBase: string;
  balanceAvalanche: string;
  agentCountBase: number;
  agentCountAvalanche: number;
  lastUpdated: number;
}

export async function saveWalletAddress(address: string): Promise<void> {
  // Validate address format
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

export async function getWalletData(address: string): Promise<WalletData> {
  try {
    const [baseBalance, avaxBalance] = await Promise.all([
      getContractBalance("base", address),
      getContractBalance("avalanche", address),
    ]);

    // Get agent counts from identity registries
    const baseIdentityRegistry = BASE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry")?.address || "";
    const avaxIdentityRegistry = AVALANCHE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry")?.address || "";
    const baseAgentCount = baseIdentityRegistry ? await getAgentCount("base", baseIdentityRegistry) : 0;
    const avaxAgentCount = avaxIdentityRegistry ? await getAgentCount("avalanche", avaxIdentityRegistry) : 0;

    return {
      address: address.toLowerCase(),
      balanceBase: baseBalance.balanceEth,
      balanceAvalanche: avaxBalance.balanceEth,
      agentCountBase: baseAgentCount,
      agentCountAvalanche: avaxAgentCount,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error("Failed to get wallet data:", error);
    throw error;
  }
}

export async function validateAddress(address: string): Promise<boolean> {
  return address.match(/^0x[a-fA-F0-9]{40}$/) !== null;
}
