import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";

const WALLET_ADDRESS_KEY = "vaultfire_wallet_address";

export interface WalletContextType {
  connectedAddress: string | null;
  isConnecting: boolean;
  connectWallet: (address: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isValidAddress: (address: string) => boolean;
  shortenAddress: (address: string) => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadStoredWallet();
  }, []);

  const loadStoredWallet = async () => {
    try {
      const stored = await AsyncStorage.getItem(WALLET_ADDRESS_KEY);
      if (stored && isValidAddress(stored)) {
        setConnectedAddress(stored);
      }
    } catch (error) {
      console.error("Failed to load stored wallet:", error);
    }
  };

  const isValidAddress = (address: string): boolean => {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  };

  const shortenAddress = (address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const connectWallet = async (address: string) => {
    if (!isValidAddress(address)) {
      throw new Error("Invalid Ethereum address");
    }

    setIsConnecting(true);
    try {
      const checksummed = ethers.getAddress(address);
      setConnectedAddress(checksummed);
      await AsyncStorage.setItem(WALLET_ADDRESS_KEY, checksummed);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setConnectedAddress(null);
      await AsyncStorage.removeItem(WALLET_ADDRESS_KEY);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      throw error;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connectedAddress,
        isConnecting,
        connectWallet,
        disconnectWallet,
        isValidAddress,
        shortenAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
