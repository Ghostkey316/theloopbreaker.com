import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSyncStatus, subscribeToSync, syncBeliefPayload } from '../services/api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connect = async ({ wallet, ens, signature, message, payload }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await syncBeliefPayload({ wallet, ens, signature, message, payload });
      const summary = await fetchSyncStatus();
      setSession({
        wallet: response.entry.wallet,
        ens: response.entry.ens,
        tier: response.entry.tier,
        multiplier: response.entry.multiplier,
        lastSync: response.entry.timestamp,
      });
      setStatus(summary);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    const data = await fetchSyncStatus();
    setStatus(data);
    return data;
  };

  const logout = () => {
    setSession(null);
    setStatus(null);
    setError(null);
  };

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let unsubscribe = () => {};
    let cancelled = false;

    refreshStatus().catch(() => {});

    unsubscribe = subscribeToSync({
      onSync: () => {
        if (!cancelled) {
          refreshStatus().catch(() => {});
        }
      },
      onError: (message) => {
        if (!cancelled) {
          setError(message);
        }
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session]);

  const value = useMemo(
    () => ({ session, status, loading, error, connect, logout, refreshStatus }),
    [session, status, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
