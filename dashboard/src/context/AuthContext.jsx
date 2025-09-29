import React, { createContext, useContext, useMemo, useState } from 'react';
import { loginPartner } from '../services/api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  const authenticate = async ({ userId, token }) => {
    setLoading(true);
    try {
      const response = await loginPartner({ userId, token });
      setSession(response);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => setSession(null);

  const value = useMemo(
    () => ({ session, loading, authenticate, logout }),
    [session, loading]
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
