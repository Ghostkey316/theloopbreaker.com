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
 * - Brain Management (Memory viewer, Delete, Topic focus, Reset, Stats)
 * - Connector System (GitHub, Web, Social, Email, Custom)
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
import {
  getBrainStats,
  getBrainInsights,
  getUserPreferences,
  getTopicInterests,
  deleteBrainInsight,
  deleteUserPreference,
  deleteTopicInterest,
  setTopicFocus,
  resetBrain,
  type BrainStats,
  type BrainInsight,
  type UserPreference,
  type TopicInterest,
} from '../lib/companion-brain';
import {
  getConnectors,
  toggleConnector,
  type Connector,
} from '../lib/companion-connectors';
import {
  getSoul,
  getSoulSummary,
  updateSoulTrait,
  updateSoulNotes,
  resetSoul,
  type CompanionSoul,
} from '../lib/companion-soul';

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

function BrainIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.78-3.88 2.5 2.5 0 0 1-2.42-4.71 2.5 2.5 0 0 1 1.43-4.76A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.78-3.88 2.5 2.5 0 0 0 2.42-4.71 2.5 2.5 0 0 0-1.43-4.76A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function TrashIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
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

  // Brain Management State
  const [showBrainMgmt, setShowBrainMgmt] = useState(false);
  const [brainStats, setBrainStatsState] = useState<BrainStats | null>(null);
  const [brainInsights, setBrainInsightsState] = useState<BrainInsight[]>([]);
  const [userPrefs, setUserPrefsState] = useState<UserPreference[]>([]);
  const [topicInterests, setTopicInterestsState] = useState<TopicInterest[]>([]);

  // Connector System State
  const [showConnectors, setShowConnectors] = useState(false);
  const [connectors, setConnectorsState] = useState<Connector[]>([]);

  // Soul Viewer State
  const [showSoulViewer, setShowSoulViewer] = useState(false);
  const [soulData, setSoulData] = useState<CompanionSoul | null>(null);
  const [soulNotesInput, setSoulNotesInput] = useState('');

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

    // Refresh brain data
    setBrainStatsState(getBrainStats());
    setBrainInsightsState(getBrainInsights());
    setUserPrefsState(getUserPreferences());
    setTopicInterestsState(getTopicInterests());

    // Refresh connector data
    setConnectorsState(getConnectors());

    // Refresh soul data
    const soul = getSoul();
    setSoulData(soul);
    setSoulNotesInput(soul.userNotes || '');
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

  // Register agent
  const handleRegister = useCallback(async () => {
    const userPK = getWalletPrivateKey();
    const userAddr = getWalletAddress();
    if (!userPK || !userAddr) {
      setError('User wallet must be unlocked first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await registerCompanionAgent(userPK, userAddr, 'base');
      if (result.success) {
        setSuccess(`Agent registered on-chain! TX: ${result.txHash?.slice(0, 14)}...`);
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
  }, [refreshStatus]);

  // Brain Management Handlers
  const handleDeleteInsight = (id: string) => {
    deleteBrainInsight(id);
    refreshStatus();
  };

  const handleDeleteTopic = (topic: string) => {
    deleteTopicInterest(topic);
    refreshStatus();
  };

  const handleResetBrain = () => {
    if (confirm('Are you sure? This will delete all memories, topics, and learned preferences. Your companion will forget everything.')) {
      resetBrain();
      refreshStatus();
      setSuccess('Companion brain reset successfully.');
    }
  };

  // Soul Handlers
  const handleSaveSoulNotes = () => {
    updateSoulNotes(soulNotesInput);
    refreshStatus();
    setSuccess('Soul notes updated.');
  };

  const handleResetSoul = () => {
    if (confirm('Reset the companion soul to defaults? Custom traits and notes will be lost.')) {
      resetSoul();
      refreshStatus();
      setSuccess('Companion soul reset to defaults.');
    }
  };

  // Connector Handlers
  const handleToggleConnector = (id: string, enabled: boolean) => {
    toggleConnector(id, enabled);
    refreshStatus();
  };

  if (!isOpen) return null;

  const bondStatus = getCompanionBondStatus();
  const regStatus = getCompanionRegistrationExplorerUrl();

  return (
    <div style={{
      position: isMobile ? 'fixed' : 'relative',
      top: isMobile ? 0 : undefined,
      right: isMobile ? 0 : undefined,
      width: isMobile ? '100%' : 340,
      height: isMobile ? '100%' : undefined,
      flexShrink: 0,
      backgroundColor: '#09090B',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: isMobile ? 100 : 10,
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      animation: 'slideIn 0.3s ease-out',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: 'rgba(249,115,22,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(249,115,22,0.2)',
          }}>
            <BrainIcon size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F4F5' }}>Companion Agent</div>
            <div style={{ fontSize: 10, color: '#52525B', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: status?.walletCreated ? '#22C55E' : '#EF4444' }} />
              {status?.walletCreated ? 'ACTIVE & SECURE' : 'NOT INITIALIZED'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
            color: '#52525B', padding: 4,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 12, marginBottom: 16,
          }}>
            {success}
          </div>
        )}

        {!status?.walletCreated ? (
          <div style={{
            padding: '24px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <WalletIcon size={24} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F4F4F5', marginBottom: 8 }}>Initialize Companion</h3>
            <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.6, marginBottom: 20 }}>
              Create a secure on-chain identity for your AI companion. It will have its own wallet and can perform tasks autonomously.
            </p>

            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#52525B', marginBottom: 6, display: 'block' }}>COMPANION PASSWORD</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Minimum 6 characters"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                  color: '#F4F4F5', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleCreateWallet}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                backgroundColor: '#F97316', color: '#FFFFFF', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
              }}
            >
              {loading ? 'INITIALIZING...' : 'ACTIVATE COMPANION'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Wallet Section */}
            <div style={{
              padding: '12px', borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <WalletIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Companion Wallet
                  </span>
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: status.walletUnlocked ? '#22C55E' : '#EF4444',
                }} />
              </div>

              {status.walletAddress && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: '#111113', padding: '6px 10px', borderRadius: 8, marginBottom: 10,
                }}>
                  <code style={{ fontSize: 11, color: '#A1A1AA', fontFamily: "'JetBrains Mono', monospace" }}>
                    {status.walletAddress.slice(0, 10)}...{status.walletAddress.slice(-8)}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
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

            {/* Alerts Section */}
            {alerts.length > 0 && (
              <div style={{
                padding: '12px', borderRadius: 12,
                backgroundColor: 'rgba(249,115,22,0.05)',
                border: '1px solid rgba(249,115,22,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <BellIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Alerts ({alerts.filter(a => !a.read).length} unread)
                  </span>
                </div>
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} style={{
                      padding: '6px 8px', backgroundColor: '#111113', borderRadius: 6,
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6,
                      opacity: alert.read ? 0.5 : 1,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#F4F4F5' }}>{alert.title}</div>
                        <div style={{ fontSize: 9, color: '#A1A1AA', marginTop: 2 }}>{alert.message}</div>
                      </div>
                      {!alert.read && (
                        <button
                          onClick={() => { markAlertRead(alert.id); refreshStatus(); }}
                          style={{ background: 'none', border: 'none', color: '#52525B', cursor: 'pointer', padding: 2, fontSize: 9, whiteSpace: 'nowrap' }}
                        >
                          dismiss
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Brain Management Section */}
            <div style={{
              padding: '12px', borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div 
                onClick={() => setShowBrainMgmt(!showBrainMgmt)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BrainIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Brain Management
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#52525B' }}>{showBrainMgmt ? '▼' : '▶'}</span>
              </div>

              {showBrainMgmt && brainStats && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6 }}>
                      <div style={{ fontSize: 8, color: '#52525B' }}>MEMORIES</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F4F4F5' }}>{brainStats.memoriesCount}</div>
                    </div>
                    <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6 }}>
                      <div style={{ fontSize: 8, color: '#52525B' }}>TOPICS</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F4F4F5' }}>{brainStats.trackedTopics}</div>
                    </div>
                  </div>

                  {brainInsights.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>LEARNED INSIGHTS</div>
                      <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {brainInsights.map(insight => (
                          <div key={insight.id} style={{ 
                            padding: 6, backgroundColor: '#111113', borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                          }}>
                            <span style={{ fontSize: 10, color: '#A1A1AA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {insight.content}
                            </span>
                            <button 
                              onClick={() => handleDeleteInsight(insight.id)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 2 }}
                            >
                              <TrashIcon size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brain Age */}
                  <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6 }}>
                    <div style={{ fontSize: 8, color: '#52525B' }}>BRAIN AGE</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#F97316' }}>{brainStats.brainAge}</div>
                  </div>

                  {/* Topic Interests */}
                  {topicInterests.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>TRACKED TOPICS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {topicInterests.slice(0, 10).map(topic => (
                          <div key={topic.topic} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '2px 6px', borderRadius: 4,
                            backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)',
                          }}>
                            <span style={{ fontSize: 9, color: '#F97316' }}>{topic.topic}</span>
                            <span style={{ fontSize: 8, color: '#52525B' }}>({topic.mentionCount})</span>
                            <button
                              onClick={() => handleDeleteTopic(topic.topic)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            >
                              <TrashIcon size={8} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Preferences */}
                  {userPrefs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>LEARNED PREFERENCES</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {userPrefs.slice(0, 5).map(pref => (
                          <div key={pref.key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '3px 6px', backgroundColor: '#111113', borderRadius: 4,
                          }}>
                            <span style={{ fontSize: 9, color: '#A1A1AA' }}>{pref.key.replace(/_/g, ' ')}: {pref.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleResetBrain}
                    style={{
                      width: '100%', padding: '6px', borderRadius: 6,
                      backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#EF4444', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      marginTop: 4
                    }}
                  >
                    Reset Companion Brain
                  </button>
                </div>
              )}
            </div>

            {/* Connector System Section */}
            <div style={{
              padding: '12px', borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div 
                onClick={() => setShowConnectors(!showConnectors)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GlobeIcon size={14} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    External Connectors
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#52525B' }}>{showConnectors ? '▼' : '▶'}</span>
              </div>

              {showConnectors && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 10, color: '#A1A1AA', lineHeight: 1.4, marginBottom: 4 }}>
                    Connect your companion to external services to enable autonomous research and internet tasks.
                  </p>
                  {connectors.map(connector => (
                    <div key={connector.id} style={{ 
                      padding: '8px 10px', backgroundColor: '#111113', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ color: connector.enabled ? '#F97316' : '#52525B' }}>
                          {connector.type === 'github' ? <GithubIcon size={14} /> : <GlobeIcon size={14} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#F4F4F5' }}>{connector.name}</div>
                          <div style={{ fontSize: 9, color: '#52525B' }}>{connector.status.toUpperCase()}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleConnector(connector.id, !connector.enabled)}
                        style={{
                          width: 32, height: 18, borderRadius: 10,
                          backgroundColor: connector.enabled ? '#F97316' : '#27272A',
                          border: 'none', cursor: 'pointer', position: 'relative',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: connector.enabled ? 16 : 2,
                          width: 14, height: 14, borderRadius: '50%', backgroundColor: '#FFFFFF',
                          transition: 'left 0.2s',
                        }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Soul Viewer Section — Enhanced */}
            <div className="border-glow" style={{
              padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 100%)',
              border: '1px solid rgba(249,115,22,0.1)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Ambient glow */}
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 80, height: 80,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div 
                onClick={() => setShowSoulViewer(!showSoulViewer)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', position: 'relative', zIndex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="breathe" style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(251,146,60,0.15))',
                    border: '1px solid rgba(249,115,22,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width={14} height={14} viewBox="0 0 32 32" fill="none">
                      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
                    </svg>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '-0.01em' }}>
                      Companion Soul
                    </span>
                    <p style={{ fontSize: 9, color: '#52525B', marginTop: 1 }}>Identity · Values · Ethics</p>
                  </div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  backgroundColor: 'rgba(249,115,22,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                  transform: showSoulViewer ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>

              {showSoulViewer && soulData && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
                  {/* Soul motto — premium card */}
                  <div className="soul-pulse" style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.04) 100%)',
                    borderLeft: '3px solid #F97316',
                    position: 'relative',
                  }}>
                    <div style={{ fontSize: 8, color: '#F97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>MOTTO</div>
                    <div className="mission-text" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                      &ldquo;{soulData.motto}&rdquo;
                    </div>
                  </div>

                  {/* Soul Radial Visualization */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <div style={{ position: 'relative', width: 130, height: 130 }}>
                      {/* Orbit rings */}
                      {[50, 40, 28].map((r, i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          top: '50%', left: '50%',
                          width: r * 2, height: r * 2,
                          borderRadius: '50%',
                          border: `1px solid rgba(249,115,22,${0.06 + i * 0.04})`,
                          transform: 'translate(-50%, -50%)',
                        }} />
                      ))}
                      {/* Center ember */}
                      <div className="breathe" style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(249,115,22,0.3) 0%, rgba(249,115,22,0.05) 70%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width={18} height={18} viewBox="0 0 32 32" fill="none">
                          <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                        </svg>
                      </div>
                      {/* Orbiting value nodes */}
                      {soulData.values.slice(0, 6).map((v, i) => {
                        const angle = (i / Math.min(soulData.values.length, 6)) * Math.PI * 2 - Math.PI / 2;
                        const radius = 48;
                        const x = 65 + Math.cos(angle) * radius;
                        const y = 65 + Math.sin(angle) * radius;
                        const colors = ['#F97316', '#A78BFA', '#22C55E', '#38BDF8', '#FBBF24', '#EC4899'];
                        return (
                          <div key={v.name} title={v.name} style={{
                            position: 'absolute', left: x - 8, top: y - 8,
                            width: 16, height: 16, borderRadius: '50%',
                            backgroundColor: `${colors[i % colors.length]}20`,
                            border: `1.5px solid ${colors[i % colors.length]}60`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'default',
                          }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors[i % colors.length] }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Soul stats grid — enhanced */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'VALUES', count: soulData.values.length, color: '#F97316' },
                      { label: 'TRAITS', count: soulData.traits.length, color: '#A78BFA' },
                      { label: 'BOUNDS', count: soulData.boundaries.length, color: '#22C55E' },
                    ].map(item => (
                      <div key={item.label} style={{
                        padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                        backgroundColor: `${item.color}08`, border: `1px solid ${item.color}15`,
                      }}>
                        <div style={{ fontSize: 7, color: '#52525B', fontWeight: 600, letterSpacing: '0.08em' }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>{item.count}</div>
                      </div>
                    ))}
                  </div>

                  {/* Core values — pill badges */}
                  <div>
                    <div style={{ fontSize: 8, color: '#52525B', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>CORE VALUES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {soulData.values.map((v, i) => {
                        const colors = ['#F97316', '#A78BFA', '#22C55E', '#38BDF8', '#FBBF24', '#EC4899', '#EF4444'];
                        const c = colors[i % colors.length];
                        return (
                          <span key={v.name} title={v.description} style={{
                            fontSize: 9, padding: '3px 8px', borderRadius: 6,
                            backgroundColor: `${c}10`, color: c,
                            border: `1px solid ${c}20`,
                            fontWeight: 600, cursor: 'default',
                          }}>
                            {v.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Personality traits — enhanced bars */}
                  <div>
                    <div style={{ fontSize: 8, color: '#52525B', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>PERSONALITY</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {soulData.traits.map((t, i) => {
                        const colors = ['#F97316', '#A78BFA', '#22C55E', '#38BDF8', '#FBBF24', '#EC4899', '#EF4444'];
                        const c = colors[i % colors.length];
                        return (
                          <div key={t.name}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontSize: 10, color: '#D4D4D8', fontWeight: 500 }}>{t.name}</span>
                              <span style={{ fontSize: 9, color: c, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{t.strength}%</span>
                            </div>
                            <div className="soul-value-bar">
                              <div className="soul-value-bar-fill" style={{ width: `${t.strength}%`, background: `linear-gradient(90deg, ${c}80, ${c})` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Beliefs — enhanced */}
                  <div>
                    <div style={{ fontSize: 8, color: '#52525B', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>BELIEFS</div>
                    <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {soulData.beliefs.map((b, i) => (
                        <div key={i} style={{
                          fontSize: 10, color: '#A1A1AA', lineHeight: 1.5, paddingLeft: 10,
                          borderLeft: '2px solid rgba(249,115,22,0.2)',
                          padding: '4px 8px 4px 10px',
                          borderRadius: '0 6px 6px 0',
                          backgroundColor: 'rgba(249,115,22,0.02)',
                        }}>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Loyalty statement — premium */}
                  <div style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.04) 0%, rgba(34,197,94,0.03) 100%)',
                    border: '1px solid rgba(167,139,250,0.1)',
                  }}>
                    <div style={{ fontSize: 8, color: '#A78BFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>LOYALTY</div>
                    <div style={{ fontSize: 10, color: '#D4D4D8', lineHeight: 1.6 }}>
                      {soulData.loyaltyStatement}
                    </div>
                  </div>

                  {/* User notes */}
                  <div>
                    <div style={{ fontSize: 8, color: '#52525B', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>YOUR GUIDANCE (optional)</div>
                    <textarea
                      value={soulNotesInput}
                      onChange={(e) => setSoulNotesInput(e.target.value)}
                      placeholder="Add personal guidance for your companion's soul..."
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#F4F4F5', fontSize: 11, outline: 'none', resize: 'vertical',
                        minHeight: 48, maxHeight: 100, fontFamily: 'inherit', lineHeight: 1.5,
                        transition: 'border-color 0.2s ease',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    />
                    <button
                      onClick={handleSaveSoulNotes}
                      className="vf-btn"
                      style={{
                        marginTop: 6, width: '100%', padding: '7px', borderRadius: 8,
                        background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.08))',
                        border: '1px solid rgba(249,115,22,0.25)',
                        color: '#F97316', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Save Guidance
                    </button>
                  </div>

                  {/* Attestation status — enhanced */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8,
                    backgroundColor: soulData.attestedOnChain ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${soulData.attestedOnChain ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className={soulData.attestedOnChain ? 'breathe' : ''} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        backgroundColor: soulData.attestedOnChain ? '#22C55E' : '#3F3F46',
                        boxShadow: soulData.attestedOnChain ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                      }} />
                      <span style={{ fontSize: 9, color: soulData.attestedOnChain ? '#22C55E' : '#52525B', fontWeight: 600 }}>
                        {soulData.attestedOnChain ? 'ATTESTED ON-CHAIN' : 'NOT YET ATTESTED'}
                      </span>
                    </div>
                    <button
                      onClick={handleResetSoul}
                      style={{
                        fontSize: 9, padding: '3px 8px', borderRadius: 6,
                        backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                        color: '#EF4444', cursor: 'pointer', fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Reset Soul
                    </button>
                  </div>
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
                    Secured by {bondStatus.amount} ETH. Your companion is trusted with higher spending limits and deeper system access.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowBondSetup(true)}
                  style={{
                    width: '100%', padding: '6px', borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1AA', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Create Partnership Bond
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bond Setup Modal */}
      {showBondSetup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            width: '100%', maxWidth: 380, borderRadius: 20,
            backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ShieldIcon size={16} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5', margin: 0 }}>Create Partnership Bond</p>
                  <p style={{ fontSize: 10, color: '#71717A', margin: 0 }}>Stake ETH on AIPartnershipBondsV2 · Base</p>
                </div>
              </div>
              <button
                onClick={() => { setShowBondSetup(false); setError(''); }}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.04)', color: '#71717A',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, lineHeight: 1,
                }}
              >×</button>
            </div>
            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* What is a bond */}
              <div style={{
                padding: '12px', borderRadius: 10, marginBottom: 16,
                backgroundColor: 'rgba(249,115,22,0.05)',
                border: '1px solid rgba(249,115,22,0.12)',
              }}>
                <p style={{ fontSize: 11, color: '#A1A1AA', lineHeight: 1.6, margin: 0 }}>
                  A Partnership Bond stakes ETH on-chain to give your companion higher trust, spending limits, and deeper access. The bond is held in the <span style={{ color: '#F97316', fontWeight: 600 }}>AIPartnershipBondsV2</span> contract on Base.
                </p>
              </div>
              {/* Bond Amount */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Bond Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={bondAmount}
                  onChange={e => setBondAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F4F4F5', fontSize: 14, fontWeight: 700,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {/* Quick amounts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
                {[0.01, 0.05, 0.1, 0.5].map(amt => {
                  const tier = amt >= 0.5 ? 'platinum' : amt >= 0.1 ? 'gold' : amt >= 0.05 ? 'silver' : 'bronze';
                  const selected = parseFloat(bondAmount) === amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => setBondAmount(amt.toString())}
                      style={{
                        padding: '8px 4px', borderRadius: 8,
                        backgroundColor: selected ? `${TIER_COLORS[tier as keyof typeof TIER_COLORS]}20` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? TIER_COLORS[tier as keyof typeof TIER_COLORS] : 'rgba(255,255,255,0.06)'}`,
                        color: selected ? TIER_COLORS[tier as keyof typeof TIER_COLORS] : '#71717A',
                        fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}
                    >
                      <span>{amt}</span>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>{tier}</span>
                    </button>
                  );
                })}
              </div>
              {/* Tier indicator */}
              {(() => {
                const amt = parseFloat(bondAmount) || 0;
                const tier = amt >= 0.5 ? 'platinum' : amt >= 0.1 ? 'gold' : amt >= 0.05 ? 'silver' : 'bronze';
                const tierColor = TIER_COLORS[tier as keyof typeof TIER_COLORS] || '#F97316';
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8, marginBottom: 16,
                    backgroundColor: `${tierColor}10`,
                    border: `1px solid ${tierColor}25`,
                  }}>
                    <span style={{ fontSize: 11, color: '#A1A1AA' }}>Bond Tier</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tierColor, textTransform: 'uppercase' }}>{tier}</span>
                  </div>
                );
              })()}
              {/* Error/Success messages */}
              {error && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <p style={{ fontSize: 11, color: '#EF4444', margin: 0 }}>{error}</p>
                </div>
              )}
              {success && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}>
                  <p style={{ fontSize: 11, color: '#22C55E', margin: 0 }}>{success}</p>
                </div>
              )}
              {/* Create Bond Button */}
              <button
                onClick={handleCreateBond}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  backgroundColor: loading ? 'rgba(249,115,22,0.4)' : '#F97316',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background-color 0.2s',
                }}
              >
                {loading && (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                    <path d="M4 12a8 8 0 018-8" />
                  </svg>
                )}
                {loading ? 'Creating Bond...' : `Stake ${bondAmount} ETH Bond`}
              </button>
              <p style={{ fontSize: 10, color: '#52525B', textAlign: 'center', marginTop: 8 }}>
                This sends a real transaction to Base mainnet. Make sure you have ETH in your wallet.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Footer / Status — Dynamic system health */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, color: '#52525B' }}>VAULTFIRE / EMBRIS V1.0</div>
          {(() => {
            // Dynamic system health check
            const brainOk = typeof getBrainStats === 'function';
            const soulOk = soulData !== null && soulData.traits.length > 0;
            const walletOk = isCompanionWalletCreated();
            const allGood = brainOk && soulOk;
            const statusText = allGood
              ? (walletOk ? 'ALL SYSTEMS NOMINAL' : 'BRAIN + SOUL ACTIVE')
              : brainOk ? 'BRAIN ACTIVE · SOUL LOADING' : 'INITIALIZING...';
            const statusColor = allGood ? '#22C55E' : brainOk ? '#FBBF24' : '#F97316';
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}60` }} />
                <span style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>{statusText}</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
