'use client';
/**
 * WalletGate — Inline auth prompt for wallet-gated sections.
 *
 * NOT a blocking modal. Renders inline within the section's scroll area.
 * Shows:
 *   - "Unlock Wallet" if a wallet exists but is locked
 *   - "Create Wallet" if no wallet exists yet
 *   - Nothing (renders children) if wallet is unlocked
 *
 * The unlock/create flow is a minimal inline card — password field + button.
 * On success it calls context.unlock() which updates global state and
 * persists the session to sessionStorage.
 */

import React, { useState, useCallback } from 'react';
import { useWalletAuth } from '../lib/WalletAuthContext';
import { isWalletCreated, unlockWallet, createWallet } from '../lib/wallet';

interface WalletGateProps {
  children: React.ReactNode;
  /** Label shown in the gate card, e.g. "Chat with Embris" */
  featureName?: string;
  /** Brief description shown under the feature name */
  featureDesc?: string;
  /** Navigate to wallet section (for "Create Wallet" CTA) */
  onGoToWallet?: () => void;
}

export default function WalletGate({ children, featureName = 'this feature', featureDesc, onGoToWallet }: WalletGateProps) {
  const { isUnlocked, unlock, isRestoring } = useWalletAuth();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const walletExists = typeof window !== 'undefined' ? isWalletCreated() : false;

  // While restoring session from sessionStorage, show nothing (avoids flash)
  if (isRestoring) {
    return (
      <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #3F3F46', borderTopColor: '#F97316', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  // Already unlocked — render children
  if (isUnlocked) return <>{children}</>;

  // Wallet exists but locked — show unlock form
  if (walletExists) {
    const handleUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) { setError('Enter your password.'); return; }
      setLoading(true);
      setError('');
      try {
        const data = await unlockWallet(password);
        await unlock(data.privateKey, data.mnemonic, data.address);
        setPassword('');
      } catch {
        setError('Incorrect password. Try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div style={{ padding: '32px 24px', maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          borderRadius: 16, backgroundColor: '#111113',
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '28px 24px',
        }}>
          {/* Lock icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F4F4F5', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Unlock to access {featureName}
          </h3>
          {featureDesc && (
            <p style={{ fontSize: 13, color: '#71717A', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
              {featureDesc}
            </p>
          )}
          {!featureDesc && (
            <p style={{ fontSize: 13, color: '#71717A', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
              Enter your wallet password to continue.
            </p>
          )}

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Wallet password"
              autoFocus
              style={{
                padding: '12px 14px', borderRadius: 10,
                backgroundColor: '#0A0A0C', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: '#F4F4F5', fontSize: 14, outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = 'rgba(249,115,22,0.4)'; }}
              onBlur={e => { if (!error) e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />

            {error && (
              <div style={{ fontSize: 12, color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                padding: '12px', borderRadius: 10, border: 'none',
                backgroundColor: loading || !password ? '#27272A' : '#F97316',
                color: loading || !password ? '#52525B' : '#fff',
                fontSize: 14, fontWeight: 600, cursor: loading || !password ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.7s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Unlocking...
                </>
              ) : 'Unlock Wallet'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // No wallet yet — show create wallet CTA
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await createWallet(newPassword);
      await unlock(data.privateKey, data.mnemonic, data.address);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to create wallet. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 420, margin: '0 auto' }}>
      <div style={{
        borderRadius: 16, backgroundColor: '#111113',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '28px 24px',
      }}>
        {/* Wallet icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
            </svg>
          </div>
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F4F4F5', textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Create a wallet to use {featureName}
        </h3>
        <p style={{ fontSize: 13, color: '#71717A', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
          Your Vaultfire wallet is your identity. No MetaMask or external wallet needed.
        </p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError(''); }}
            placeholder="Choose a password (min 8 chars)"
            style={{
              padding: '12px 14px', borderRadius: 10,
              backgroundColor: '#0A0A0C', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: '#F4F4F5', fontSize: 14, outline: 'none',
            }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
            placeholder="Confirm password"
            style={{
              padding: '12px 14px', borderRadius: 10,
              backgroundColor: '#0A0A0C', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: '#F4F4F5', fontSize: 14, outline: 'none',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: '#F87171', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            style={{
              padding: '12px', borderRadius: 10, border: 'none', marginTop: 4,
              backgroundColor: loading || !newPassword || !confirmPassword ? '#27272A' : '#F97316',
              color: loading || !newPassword || !confirmPassword ? '#52525B' : '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: loading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.7s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Creating wallet...
              </>
            ) : 'Create Wallet'}
          </button>
        </form>

        {onGoToWallet && (
          <button
            onClick={onGoToWallet}
            style={{
              width: '100%', marginTop: 10, padding: '10px', borderRadius: 10,
              backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
              color: '#71717A', fontSize: 13, cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#A1A1AA'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717A'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            Import existing wallet instead
          </button>
        )}
      </div>
    </div>
  );
}
