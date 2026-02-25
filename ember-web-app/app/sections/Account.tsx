'use client';
import { useState, useEffect, useCallback } from 'react';
import { useWalletAuth } from '../lib/WalletAuthContext';
import { createWallet, unlockWallet, isWalletCreated, getWalletAddress, deleteWallet } from '../lib/wallet';
import { getCompanionStatus, getCompanionBondStatus, getCompanionVNSName } from '../lib/companion-agent';
import { showToast } from '../components/Toast';

export default function Account() {
  const { isUnlocked, address, logout, unlock, isRestoring } = useWalletAuth();
  const [mode, setMode] = useState<'login' | 'create' | 'overview'>('login');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletExists, setWalletExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [companionStatus, setCompanionStatus] = useState<any>(null);

  // Determine initial mode based on wallet state
  useEffect(() => {
    const exists = isWalletCreated();
    setWalletExists(exists);
    if (isUnlocked) {
      setMode('overview');
      try { setCompanionStatus(getCompanionStatus()); } catch { /* */ }
    } else if (exists) {
      setMode('login');
    } else {
      setMode('create');
    }
  }, [isUnlocked]);

  const handleCreateWallet = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }

    setLoading(true);
    try {
      const wallet = await createWallet(password);
      await unlock(wallet.privateKey, wallet.mnemonic, wallet.address);
      showToast('Wallet created successfully!', 'success');
      setPassword('');
      setConfirmPassword('');
      setMode('overview');
    } catch (err: any) {
      showToast(err.message || 'Failed to create wallet', 'warning');
    } finally {
      setLoading(false);
    }
  }, [password, confirmPassword, unlock]);

  const handleUnlockWallet = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast('Please enter your password', 'warning');
      return;
    }

    setLoading(true);
    try {
      const wallet = await unlockWallet(password);
      await unlock(wallet.privateKey, wallet.mnemonic, wallet.address);
      showToast('Wallet unlocked!', 'success');
      setPassword('');
      setMode('overview');
    } catch (err: any) {
      showToast(err.message || 'Incorrect password', 'warning');
    } finally {
      setLoading(false);
    }
  }, [password, unlock]);

  const handleLogout = useCallback(() => {
    logout();
    setPassword('');
    setMode(walletExists ? 'login' : 'create');
    showToast('Logged out', 'info');
  }, [logout, walletExists]);

  const handleDeleteWallet = useCallback(() => {
    if (!confirm('Are you sure? This will permanently delete your wallet. Make sure you have backed up your seed phrase.')) return;
    try {
      deleteWallet();
      logout();
      setPassword('');
      setMode('create');
      setWalletExists(false);
      showToast('Wallet deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete wallet', 'warning');
    }
  }, [logout]);

  if (isRestoring) {
    return (
      <div style={{ padding: '48px 40px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#71717A' }}>Loading your account...</p>
        </div>
      </div>
    );
  }

  // ── OVERVIEW: Logged-in account view ──
  if (isUnlocked && mode === 'overview') {
    return (
      <div style={{ padding: '48px 40px', maxWidth: 600, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{
          padding: '32px 28px', borderRadius: 16, marginBottom: 32,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(167,139,250,0.04) 100%)',
          border: '1px solid rgba(249,115,22,0.15)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(249,115,22,0.25)',
          }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F4F4F5', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: '#A1A1AA', margin: 0 }}>
            Your identity, your rules. No surveillance, just trust.
          </p>
        </div>

        {/* Account Info */}
        <div style={{
          padding: '20px', borderRadius: 14, marginBottom: 24,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: 8 }}>
              Wallet Address
            </p>
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: '#22C55E', wordBreak: 'break-all',
            }}>
              {address}
            </div>
          </div>

          {companionStatus?.vnsName && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: 8 }}>
                VNS Identity
              </p>
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                backgroundColor: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.15)',
                fontSize: 13, color: '#38BDF8', fontWeight: 600,
              }}>
                {companionStatus.vnsName}
              </div>
            </div>
          )}

          {companionStatus?.bond?.active && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: 8 }}>
                Companion Bond
              </p>
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                backgroundColor: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.15)',
                fontSize: 13, color: '#22C55E', fontWeight: 600,
              }}>
                Active · {companionStatus.bond.tier?.charAt(0).toUpperCase()}{companionStatus.bond.tier?.slice(1) || ''}
              </div>
            </div>
          )}

          <div>
            <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: 8 }}>
              Account Status
            </p>
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              backgroundColor: 'rgba(249,115,22,0.06)',
              border: '1px solid rgba(249,115,22,0.15)',
              fontSize: 13, color: '#F97316', fontWeight: 600,
            }}>
              ✓ Unlocked & Active
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 20px', borderRadius: 10,
              backgroundColor: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.25)',
              color: '#F97316', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.12)'; }}
          >
            Lock Wallet
          </button>
          <button
            onClick={handleDeleteWallet}
            style={{
              padding: '12px 20px', borderRadius: 10,
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#EF4444', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
          >
            Delete Wallet (Irreversible)
          </button>
        </div>

        {/* Philosophy */}
        <div style={{
          marginTop: 32, padding: '20px 24px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 100%)',
          borderLeft: '3px solid #F97316',
        }}>
          <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.8, margin: 0 }}>
            Your wallet is encrypted locally on this device. No private keys are ever sent to servers.
            No KYC. No surveillance. Just you, your password, and your identity.
          </p>
        </div>
      </div>
    );
  }

  // ── CREATE: New wallet creation ──
  if (mode === 'create') {
    return (
      <div style={{ padding: '48px 40px', maxWidth: 480, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(249,115,22,0.3)',
          }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F4F4F5', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Create Your Wallet
          </h1>
          <p style={{ fontSize: 14, color: '#A1A1AA', margin: 0, lineHeight: 1.6 }}>
            No email. No phone. No KYC. Just a password and you're in. Your identity, your rules.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateWallet} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>
              Password (min 8 characters)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  backgroundColor: '#09090B', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F4F4F5', fontSize: 14,
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#52525B', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                backgroundColor: '#09090B', border: '1px solid rgba(255,255,255,0.08)',
                color: '#F4F4F5', fontSize: 14,
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 10,
              backgroundColor: loading ? '#52525B' : '#F97316',
              border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#FB923C'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#F97316'; }}
          >
            {loading ? 'Creating...' : 'Create Wallet'}
          </button>
        </form>

        {/* Info */}
        <div style={{
          padding: '16px 18px', borderRadius: 12,
          backgroundColor: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.12)',
        }}>
          <p style={{ fontSize: 11, color: '#A1A1AA', lineHeight: 1.6, margin: 0 }}>
            <span style={{ color: '#F97316', fontWeight: 600 }}>🔐 Your password is everything.</span>{' '}
            Write it down. Back it up. Never share it. If you lose it, you lose access to your wallet.
          </p>
        </div>
      </div>
    );
  }

  // ── LOGIN: Existing wallet unlock ──
  return (
    <div style={{ padding: '48px 40px', maxWidth: 480, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(249,115,22,0.3)',
        }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F4F4F5', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Unlock Your Wallet
        </h1>
        <p style={{ fontSize: 14, color: '#A1A1AA', margin: 0, lineHeight: 1.6 }}>
          Enter your password to access your account and continue your journey.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleUnlockWallet} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                backgroundColor: '#09090B', border: '1px solid rgba(255,255,255,0.08)',
                color: '#F4F4F5', fontSize: 14,
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#52525B', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 10,
            backgroundColor: loading ? '#52525B' : '#F97316',
            border: 'none', color: 'white', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#FB923C'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#F97316'; }}
        >
          {loading ? 'Unlocking...' : 'Unlock Wallet'}
        </button>
      </form>

      {/* Info */}
      <div style={{
        padding: '16px 18px', borderRadius: 12,
        backgroundColor: 'rgba(249,115,22,0.06)',
        border: '1px solid rgba(249,115,22,0.12)',
      }}>
        <p style={{ fontSize: 11, color: '#A1A1AA', lineHeight: 1.6, margin: 0 }}>
          <span style={{ color: '#F97316', fontWeight: 600 }}>🔐 Your password unlocks your wallet locally.</span>{' '}
          It is never sent to any server. Complete privacy, complete control.
        </p>
      </div>
    </div>
  );
}
