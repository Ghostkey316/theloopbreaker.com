'use client';

/**
 * CompanionPanel — Autonomous Companion Agent Dashboard
 *
 * This panel appears in the Chat section and shows the companion's:
 * - Wallet address and balances
 * - Partnership bond status
 * - Agent registration status
 * - Spending limits and permissions
 * - Alerts and monitoring
 * - Quick actions (fund, bond, register)
 *
 * It does NOT modify the visual style of the site.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCompanionStatus,
  getCompanionCapabilities,
  isCompanionWalletCreated,
  getCompanionAddress,
  isCompanionUnlocked,
  createCompanionWallet,
  unlockCompanionWallet,
  getCompanionBalance,
  getCompanionUSDCBalance,
  getCompanionBondStatus,
  getCompanionBondExplorerUrl,
  getCompanionRegistrationExplorerUrl,
  getCompanionAlerts,
  markAlertRead,
  getCompanionSpendingLimit,
  setCompanionSpendingLimit,
  getXMTPPermission,
  setXMTPPermission,
  isMonitoringEnabled,
  setMonitoringEnabled,
  getCompanionVNSName,
  getCompanionAgentName,
  createPartnershipBond,
  registerCompanionAgent,
  setCompanionVNSName,
  type CompanionStatus,
  type CompanionAlert,
  type BondTier,
} from '../lib/companion-agent';
import { getWalletAddress, getWalletPrivateKey, isWalletUnlocked } from '../lib/wallet';

// ─── Icons ───────────────────────────────────────────────────────────────────

function WalletIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  );
}

function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function BellIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CopyIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlameIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
    </svg>
  );
}

// ─── Tier Colors ─────────────────────────────────────────────────────────────

const TIER_COLORS: Record<BondTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface CompanionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export default function CompanionPanel({ isOpen, onClose, isMobile }: CompanionPanelProps) {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [balance, setBalance] = useState('0');
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [alerts, setAlerts] = useState<CompanionAlert[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<'password' | 'creating' | 'done'>('password');
  const [companionNameInput, setCompanionNameInput] = useState('');
  const [showBondSetup, setShowBondSetup] = useState(false);
  const [bondAmount, setBondAmount] = useState('0.01');
  const [showRegisterSetup, setShowRegisterSetup] = useState(false);
  const [spendingLimitInput, setSpendingLimitInput] = useState('');

  // Load status
  const refreshStatus = useCallback(async () => {
    const s = getCompanionStatus();
    setStatus(s);
    setAlerts(getCompanionAlerts());

    if (s.walletCreated && s.walletAddress) {
      try {
        const [bal, usdc] = await Promise.all([
          getCompanionBalance('base'),
          getCompanionUSDCBalance(),
        ]);
        setBalance(bal);
        setUsdcBalance(usdc);
      } catch { /* silent */ }
    }
  }, []);

  useEffect(() => {
    if (isOpen) refreshStatus();
  }, [isOpen, refreshStatus]);

  // Copy address
  const handleCopy = useCallback(() => {
    const addr = getCompanionAddress();
    if (addr) {
      navigator.clipboard.writeText(addr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, []);

  // Create companion wallet
  const handleCreateWallet = useCallback(async () => {
    if (!passwordInput.trim() || passwordInput.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    setSetupStep('creating');
    try {
      await createCompanionWallet(passwordInput);
      setSetupStep('done');
      setSuccess('Companion wallet created! Your AI partner is ready.');
      setPasswordInput('');
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create wallet');
      setSetupStep('password');
    } finally {
      setLoading(false);
    }
  }, [passwordInput, refreshStatus]);

  // Unlock companion wallet
  const handleUnlock = useCallback(async () => {
    if (!passwordInput.trim()) {
      setError('Enter your companion password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await unlockCompanionWallet(passwordInput);
      setSuccess('Companion unlocked!');
      setPasswordInput('');
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wrong password');
    } finally {
      setLoading(false);
    }
  }, [passwordInput, refreshStatus]);

  // Create bond
  const handleCreateBond = useCallback(async () => {
    const userPK = getWalletPrivateKey();
    const userAddr = getWalletAddress();
    if (!userPK || !userAddr) {
      setError('User wallet must be unlocked first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const amount = parseFloat(bondAmount);
      if (isNaN(amount) || amount < 0.001) {
        setError('Minimum bond is 0.001 ETH');
        setLoading(false);
        return;
      }
      const result = await createPartnershipBond(userPK, userAddr, amount, 'base');
      if (result.success) {
        setSuccess(`Partnership bond created! Tier: ${result.tier}. TX: ${result.txHash?.slice(0, 14)}...`);
        setShowBondSetup(false);
        await refreshStatus();
      } else {
        setError(result.error || 'Bond creation failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bond creation failed');
    } finally {
      setLoading(false);
    }
  }, [bondAmount, refreshStatus]);

  // Register companion agent
  const handleRegister = useCallback(async () => {
    const userPK = getWalletPrivateKey();
    const userAddr = getWalletAddress();
    if (!userPK || !userAddr) {
      setError('User wallet must be unlocked first');
      return;
    }
    const name = companionNameInput.trim() || 'embris-companion';
    setLoading(true);
    setError('');
    try {
      const result = await registerCompanionAgent(userPK, userAddr, name, 'base');
      if (result.success) {
        setCompanionVNSName(`${name}.vns`);
        setSuccess(`Companion registered as ${name}.vns! TX: ${result.txHash?.slice(0, 14)}...`);
        setShowRegisterSetup(false);
        await refreshStatus();
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, [companionNameInput, refreshStatus]);

  // Update spending limit
  const handleSetSpendingLimit = useCallback(() => {
    const val = parseFloat(spendingLimitInput);
    if (isNaN(val) || val < 0) {
      setError('Enter a valid amount');
      return;
    }
    setCompanionSpendingLimit(val);
    setSuccess(`Spending limit set to $${val.toFixed(2)}`);
    setSpendingLimitInput('');
    refreshStatus();
  }, [spendingLimitInput, refreshStatus]);

  if (!isOpen) return null;

  const bondStatus = status ? status.bond : { active: false, txHash: null, chain: null, tier: null, createdAt: null };
  const bondExplorerUrl = getCompanionBondExplorerUrl();
  const regExplorerUrl = getCompanionRegistrationExplorerUrl();
  const unreadAlerts = alerts.filter(a => !a.read).length;

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />
      )}

      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        top: isMobile ? 0 : undefined,
        right: isMobile ? 0 : undefined,
        bottom: isMobile ? 0 : undefined,
        zIndex: isMobile ? 50 : undefined,
        width: isMobile ? 300 : 280,
        flexShrink: 0,
        backgroundColor: '#0C0C0E',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 12px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FlameIcon size={14} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Companion Agent
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 22, height: 22, borderRadius: 5, border: 'none',
              cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.04)',
              color: '#52525B', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Error/Success Messages */}
          {error && (
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11, color: '#EF4444', lineHeight: 1.4,
            }}>
              {error}
              <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 11 }}>×</button>
            </div>
          )}
          {success && (
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              fontSize: 11, color: '#22C55E', lineHeight: 1.4,
            }}>
              {success}
              <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', fontSize: 11 }}>×</button>
            </div>
          )}

          {/* ── Not Created Yet ── */}
          {!status?.walletCreated && !showSetup && (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <FlameIcon size={28} />
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#F4F4F5', marginTop: 12, marginBottom: 6 }}>
                Activate Your Companion
              </h4>
              <p style={{ fontSize: 12, color: '#52525B', lineHeight: 1.5, marginBottom: 16 }}>
                Your AI companion gets its own wallet, on-chain identity, and partnership bond with you. It&apos;s your homie in the Vaultfire ecosystem.
              </p>
              <button
                onClick={() => setShowSetup(true)}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 10,
                  backgroundColor: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  color: '#F97316', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                Activate Companion
              </button>
            </div>
          )}

          {/* ── Setup Flow ── */}
          {!status?.walletCreated && showSetup && (
            <div style={{ padding: '12px 4px' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#F4F4F5', marginBottom: 8 }}>
                {setupStep === 'creating' ? 'Creating...' : setupStep === 'done' ? 'Ready!' : 'Set Companion Password'}
              </h4>
              {setupStep === 'password' && (
                <>
                  <p style={{ fontSize: 11, color: '#52525B', marginBottom: 10, lineHeight: 1.5 }}>
                    This password encrypts your companion&apos;s wallet. It&apos;s separate from your main wallet password.
                  </p>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Companion password (6+ chars)"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                      color: '#F4F4F5', fontSize: 12, outline: 'none',
                      marginBottom: 8,
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWallet(); }}
                  />
                  <button
                    onClick={handleCreateWallet}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '9px 16px', borderRadius: 8,
                      backgroundColor: '#F97316', border: 'none',
                      color: '#09090B', fontSize: 12, fontWeight: 600,
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Creating...' : 'Create Companion Wallet'}
                  </button>
                </>
              )}
              {setupStep === 'creating' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: 24, height: 24, border: '2px solid rgba(249,115,22,0.3)',
                    borderTopColor: '#F97316', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 12px',
                  }} />
                  <p style={{ fontSize: 12, color: '#71717A' }}>Generating keypair & encrypting...</p>
                </div>
              )}
              {setupStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ color: '#22C55E', marginBottom: 8 }}><CheckIcon size={20} /></div>
                  <p style={{ fontSize: 12, color: '#22C55E', fontWeight: 500 }}>Companion activated!</p>
                </div>
              )}
            </div>
          )}

          {/* ── Wallet Created — Show Dashboard ── */}
          {status?.walletCreated && (
            <>
              {/* Wallet Card */}
              <div style={{
                padding: '10px', borderRadius: 10,
                backgroundColor: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <WalletIcon size={12} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Companion Wallet
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 4,
                    backgroundColor: status.walletUnlocked ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: status.walletUnlocked ? '#22C55E' : '#EF4444',
                    fontWeight: 600,
                  }}>
                    {status.walletUnlocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </div>

                {status.walletAddress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, color: '#A1A1AA',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {status.walletAddress.slice(0, 8)}...{status.walletAddress.slice(-6)}
                    </span>
                    <button
                      onClick={handleCopy}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: copied ? '#22C55E' : '#52525B', padding: 2,
                      }}
                    >
                      {copied ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 2 }}>ETH (Base)</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace" }}>
                      {parseFloat(balance).toFixed(6)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 2 }}>USDC</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace" }}>
                      {usdcBalance}
                    </div>
                  </div>
                </div>

                {/* Unlock if locked */}
                {!status.walletUnlocked && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Companion password"
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6,
                        backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#F4F4F5', fontSize: 11, outline: 'none', marginBottom: 6,
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                    />
                    <button
                      onClick={handleUnlock}
                      disabled={loading}
                      style={{
                        width: '100%', padding: '6px', borderRadius: 6,
                        backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)',
                        color: '#F97316', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {loading ? 'Unlocking...' : 'Unlock'}
                    </button>
                  </div>
                )}
              </div>

              {/* Bond Status */}
              <div style={{
                padding: '10px', borderRadius: 10,
                backgroundColor: bondStatus.active ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${bondStatus.active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldIcon size={12} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: bondStatus.active ? '#22C55E' : '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Partnership Bond
                    </span>
                  </div>
                  {bondStatus.active && bondStatus.tier && (
                    <span style={{
                      fontSize: 9, padding: '2px 5px', borderRadius: 4,
                      backgroundColor: `${TIER_COLORS[bondStatus.tier]}20`,
                      color: TIER_COLORS[bondStatus.tier],
                      fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {bondStatus.tier}
                    </span>
                  )}
                </div>

                {bondStatus.active ? (
                  <div>
                    <p style={{ fontSize: 11, color: '#A1A1AA', lineHeight: 1.5 }}>
                      On-chain proof of your partnership with this companion.
                    </p>
                    {bondExplorerUrl && (
                      <a
                        href={bondExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 10, color: '#F97316', marginTop: 4, textDecoration: 'none',
                        }}
                      >
                        <LinkIcon size={9} /> View on Explorer
                      </a>
                    )}
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 11, color: '#52525B', lineHeight: 1.5, marginBottom: 6 }}>
                      No bond yet. Create one to prove your partnership on-chain.
                    </p>
                    {!showBondSetup ? (
                      <button
                        onClick={() => setShowBondSetup(true)}
                        disabled={!isWalletUnlocked()}
                        style={{
                          width: '100%', padding: '6px', borderRadius: 6,
                          backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                          color: '#22C55E', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          opacity: isWalletUnlocked() ? 1 : 0.5,
                        }}
                      >
                        Create Bond
                      </button>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                          <input
                            type="text"
                            value={bondAmount}
                            onChange={(e) => setBondAmount(e.target.value)}
                            placeholder="ETH amount"
                            style={{
                              flex: 1, padding: '5px 8px', borderRadius: 6,
                              backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                              color: '#F4F4F5', fontSize: 11, outline: 'none',
                            }}
                          />
                          <button
                            onClick={handleCreateBond}
                            disabled={loading}
                            style={{
                              padding: '5px 10px', borderRadius: 6,
                              backgroundColor: '#22C55E', border: 'none',
                              color: '#09090B', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {loading ? '...' : 'Bond'}
                          </button>
                        </div>
                        <p style={{ fontSize: 9, color: '#3F3F46' }}>
                          Min 0.001 ETH. Bronze: 0.01+ · Silver: 0.05+ · Gold: 0.1+ · Platinum: 0.5+
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Agent Registration */}
              <div style={{
                padding: '10px', borderRadius: 10,
                backgroundColor: status.agentRegistered ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${status.agentRegistered ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: status.agentRegistered ? '#8B5CF6' : '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Agent Identity
                  </span>
                </div>

                {status.agentRegistered ? (
                  <div>
                    <p style={{ fontSize: 12, color: '#F4F4F5', fontWeight: 500 }}>
                      {status.vnsName || getCompanionAgentName() + '.vns'}
                    </p>
                    <p style={{ fontSize: 10, color: '#71717A' }}>
                      Registered on {status.registeredChain || 'Base'}
                    </p>
                    {regExplorerUrl && (
                      <a
                        href={regExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 10, color: '#8B5CF6', marginTop: 3, textDecoration: 'none',
                        }}
                      >
                        <LinkIcon size={9} /> View on Explorer
                      </a>
                    )}
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 11, color: '#52525B', lineHeight: 1.5, marginBottom: 6 }}>
                      Register your companion on-chain with a .vns identity.
                    </p>
                    {!showRegisterSetup ? (
                      <button
                        onClick={() => setShowRegisterSetup(true)}
                        disabled={!isWalletUnlocked()}
                        style={{
                          width: '100%', padding: '6px', borderRadius: 6,
                          backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                          color: '#8B5CF6', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          opacity: isWalletUnlocked() ? 1 : 0.5,
                        }}
                      >
                        Register Agent
                      </button>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={companionNameInput}
                          onChange={(e) => setCompanionNameInput(e.target.value)}
                          placeholder="embris-companion"
                          style={{
                            width: '100%', padding: '5px 8px', borderRadius: 6,
                            backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                            color: '#F4F4F5', fontSize: 11, outline: 'none', marginBottom: 4,
                          }}
                        />
                        <button
                          onClick={handleRegister}
                          disabled={loading}
                          style={{
                            width: '100%', padding: '6px', borderRadius: 6,
                            backgroundColor: '#8B5CF6', border: 'none',
                            color: '#FFFFFF', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {loading ? 'Registering...' : 'Register on Base'}
                        </button>
                        <p style={{ fontSize: 9, color: '#3F3F46', marginTop: 3 }}>
                          3-32 chars, lowercase + hyphens. Gas paid by your wallet.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Permissions & Settings */}
              <div style={{
                padding: '10px', borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                  Permissions
                </span>

                {/* Spending Limit */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#A1A1AA' }}>Spending Limit</span>
                  <span style={{ fontSize: 11, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace" }}>
                    ${status.spendingLimitUsd.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={spendingLimitInput}
                    onChange={(e) => setSpendingLimitInput(e.target.value)}
                    placeholder="USD limit"
                    style={{
                      flex: 1, padding: '4px 6px', borderRadius: 5,
                      backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                      color: '#F4F4F5', fontSize: 10, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSetSpendingLimit}
                    style={{
                      padding: '4px 8px', borderRadius: 5,
                      backgroundColor: 'rgba(255,255,255,0.06)', border: 'none',
                      color: '#A1A1AA', fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    Set
                  </button>
                </div>

                {/* XMTP Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#A1A1AA' }}>XMTP Messaging</span>
                  <button
                    onClick={() => {
                      const next = !getXMTPPermission();
                      setXMTPPermission(next);
                      refreshStatus();
                    }}
                    style={{
                      padding: '2px 8px', borderRadius: 10,
                      backgroundColor: status.xmtpPermission ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                      border: 'none',
                      color: status.xmtpPermission ? '#22C55E' : '#52525B',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {status.xmtpPermission ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Monitoring Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#A1A1AA' }}>Portfolio Monitoring</span>
                  <button
                    onClick={() => {
                      const next = !isMonitoringEnabled();
                      setMonitoringEnabled(next);
                      refreshStatus();
                    }}
                    style={{
                      padding: '2px 8px', borderRadius: 10,
                      backgroundColor: status.monitoringEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                      border: 'none',
                      color: status.monitoringEnabled ? '#22C55E' : '#52525B',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {status.monitoringEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div style={{
                  padding: '10px', borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <BellIcon size={11} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Alerts
                    </span>
                    {unreadAlerts > 0 && (
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 8,
                        backgroundColor: 'rgba(249,115,22,0.2)', color: '#F97316', fontWeight: 700,
                      }}>
                        {unreadAlerts}
                      </span>
                    )}
                  </div>
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => { markAlertRead(alert.id); setAlerts(getCompanionAlerts()); }}
                      style={{
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        opacity: alert.read ? 0.5 : 1,
                      }}
                    >
                      <p style={{ fontSize: 11, color: '#F4F4F5', fontWeight: alert.read ? 400 : 500, marginBottom: 1 }}>
                        {alert.title}
                      </p>
                      <p style={{ fontSize: 10, color: '#52525B', lineHeight: 1.4 }}>
                        {alert.message.slice(0, 80)}{alert.message.length > 80 ? '...' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Capabilities Summary */}
              <div style={{
                padding: '8px 10px', borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.03)',
              }}>
                <span style={{ fontSize: 9, color: '#3F3F46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Capabilities
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {[
                    { label: 'Wallet', active: status.walletCreated },
                    { label: 'Bond', active: bondStatus.active },
                    { label: 'Identity', active: status.agentRegistered },
                    { label: 'XMTP', active: status.xmtpPermission },
                    { label: 'x402', active: status.spendingLimitUsd > 0 },
                    { label: 'Monitor', active: status.monitoringEnabled },
                    { label: 'Offline', active: false },
                  ].map((cap) => (
                    <span
                      key={cap.label}
                      style={{
                        fontSize: 9, padding: '2px 5px', borderRadius: 4,
                        backgroundColor: cap.active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                        color: cap.active ? '#22C55E' : '#3F3F46',
                        fontWeight: 500,
                      }}
                    >
                      {cap.label}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.03)',
        }}>
          <p style={{ fontSize: 9, color: '#27272A', lineHeight: 1.5, textAlign: 'center' }}>
            Your loyal AI companion · Vaultfire Protocol
          </p>
        </div>
      </div>
    </>
  );
}
