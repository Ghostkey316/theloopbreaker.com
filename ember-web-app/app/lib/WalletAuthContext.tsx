'use client';
/**
 * WalletAuthContext — Global wallet session state for Vaultfire.
 *
 * Provides:
 *   - isUnlocked: boolean — whether the wallet is currently unlocked
 *   - address: string | null — the wallet's Ethereum address
 *   - unlock(pk, mnemonic, address) — call after successful password entry
 *   - logout() — clear session and lock wallet
 *   - isRestoring: boolean — true while checking sessionStorage on first load
 *
 * Wrap the app in <WalletAuthProvider> and consume with useWalletAuth().
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  persistSession, restoreSession, clearSession,
  getSessionPK, getSessionMnemonic, getSessionAddress, isSessionActive,
} from './auth';
import { setSessionKey, clearSession as clearWalletSession, isWalletCreated } from './wallet';

interface WalletAuthState {
  isUnlocked: boolean;
  address: string | null;
  isRestoring: boolean;
  unlock: (pk: string, mnemonic: string, address: string) => Promise<void>;
  logout: () => void;
}

const WalletAuthContext = createContext<WalletAuthState>({
  isUnlocked: false,
  address: null,
  isRestoring: true,
  unlock: async () => {},
  logout: () => {},
});

export function WalletAuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // On mount: try to restore session from sessionStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isWalletCreated()) {
        const restored = await restoreSession();
        if (!cancelled && restored) {
          const pk = getSessionPK();
          const mnemonic = getSessionMnemonic();
          const addr = getSessionAddress();
          if (pk && addr) {
            // Re-hydrate the wallet.ts in-memory session too
            setSessionKey(pk, mnemonic || '');
            setIsUnlocked(true);
            setAddress(addr);
          }
        }
      }
      if (!cancelled) setIsRestoring(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const unlock = useCallback(async (pk: string, mnemonic: string, addr: string) => {
    // Persist to sessionStorage and update wallet.ts in-memory cache
    await persistSession(pk, mnemonic, addr);
    setSessionKey(pk, mnemonic);
    setIsUnlocked(true);
    setAddress(addr);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    clearWalletSession();
    setIsUnlocked(false);
    setAddress(null);
  }, []);

  return (
    <WalletAuthContext.Provider value={{ isUnlocked, address, isRestoring, unlock, logout }}>
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth(): WalletAuthState {
  return useContext(WalletAuthContext);
}
