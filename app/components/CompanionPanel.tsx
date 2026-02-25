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

            {/* Soul Viewer Section */}
            <div style={{
              padding: '12px', borderRadius: 12,
              backgroundColor: 'rgba(249,115,22,0.03)',
              border: '1px solid rgba(249,115,22,0.08)',
            }}>
              <div 
                onClick={() => setShowSoulViewer(!showSoulViewer)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 32 32" fill="none">
                    <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                    <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Companion Soul
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#52525B' }}>{showSoulViewer ? '▼' : '▶'}</span>
              </div>

              {showSoulViewer && soulData && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Soul motto */}
                  <div style={{ padding: 8, backgroundColor: '#111113', borderRadius: 8, borderLeft: '2px solid #F97316' }}>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 2 }}>MOTTO</div>
                    <div style={{ fontSize: 11, color: '#E4E4E7', fontStyle: 'italic', lineHeight: 1.5 }}>
                      &ldquo;{soulData.motto}&rdquo;
                    </div>
                  </div>

                  {/* Soul stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: '#52525B' }}>VALUES</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F97316' }}>{soulData.values.length}</div>
                    </div>
                    <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: '#52525B' }}>TRAITS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F97316' }}>{soulData.traits.length}</div>
                    </div>
                    <div style={{ padding: 6, backgroundColor: '#111113', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: '#52525B' }}>BOUNDS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F97316' }}>{soulData.boundaries.length}</div>
                    </div>
                  </div>

                  {/* Core values */}
                  <div>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>CORE VALUES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {soulData.values.slice(0, 5).map(v => (
                        <span key={v.name} style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 4,
                          backgroundColor: 'rgba(249,115,22,0.1)', color: '#F97316',
                          border: '1px solid rgba(249,115,22,0.15)',
                        }}>
                          {v.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Personality traits */}
                  <div>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>PERSONALITY</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {soulData.traits.slice(0, 5).map(t => (
                        <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: '#A1A1AA', minWidth: 70 }}>{t.name}</span>
                          <div style={{ flex: 1, height: 4, backgroundColor: '#1A1A1E', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${t.strength}%`, height: '100%', backgroundColor: '#F97316', borderRadius: 2, transition: 'width 0.3s ease' }} />
                          </div>
                          <span style={{ fontSize: 9, color: '#52525B', minWidth: 24, textAlign: 'right' }}>{t.strength}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Beliefs */}
                  <div>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>BELIEFS</div>
                    <div style={{ maxHeight: 80, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {soulData.beliefs.map((b, i) => (
                        <div key={i} style={{ fontSize: 10, color: '#A1A1AA', lineHeight: 1.4, paddingLeft: 8, borderLeft: '1px solid rgba(249,115,22,0.2)' }}>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Loyalty statement */}
                  <div style={{ padding: 8, backgroundColor: '#111113', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 2 }}>LOYALTY</div>
                    <div style={{ fontSize: 10, color: '#D4D4D8', lineHeight: 1.5 }}>
                      {soulData.loyaltyStatement}
                    </div>
                  </div>

                  {/* User notes */}
                  <div>
                    <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>YOUR GUIDANCE (optional)</div>
                    <textarea
                      value={soulNotesInput}
                      onChange={(e) => setSoulNotesInput(e.target.value)}
                      placeholder="Add personal guidance for your companion's soul..."
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 6,
                        backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#F4F4F5', fontSize: 11, outline: 'none', resize: 'vertical',
                        minHeight: 48, maxHeight: 100, fontFamily: 'inherit', lineHeight: 1.5,
                      }}
                    />
                    <button
                      onClick={handleSaveSoulNotes}
                      style={{
                        marginTop: 4, width: '100%', padding: '5px', borderRadius: 6,
                        backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                        color: '#F97316', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Save Guidance
                    </button>
                  </div>

                  {/* Attestation status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: soulData.attestedOnChain ? '#22C55E' : '#3F3F46' }} />
                      <span style={{ fontSize: 9, color: soulData.attestedOnChain ? '#22C55E' : '#52525B' }}>
                        {soulData.attestedOnChain ? 'ATTESTED ON-CHAIN' : 'NOT YET ATTESTED'}
                      </span>
                    </div>
                    <button
                      onClick={handleResetSoul}
                      style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 4,
                        backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                        color: '#EF4444', cursor: 'pointer',
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

      {/* Footer / Status */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, color: '#52525B' }}>VAULTFIRE / EMBRIS V1.0</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>SYSTEM NOMINAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
