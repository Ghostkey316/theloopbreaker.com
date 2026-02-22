"use client";
/**
 * IdentityGate — Two-door login and identity routing.
 *
 * Flow:
 * 1. Wallet locked → show unlock screen
 * 2. Wallet unlocked, no VNS → show registration choice (Human / AI Agent)
 * 3. Wallet unlocked, VNS registered → route to correct experience
 *    - Human → human nav (Companion, Wallet, Collaboration, Marketplace)
 *    - Agent → agent nav (Agent-Only Zone, Tasks, Hub, Marketplace)
 *
 * The identity type is immutable on-chain — cannot be gamed after registration.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isWalletCreated, getWalletAddress, unlockWallet, isWalletUnlocked,
  type WalletData,
} from "../lib/wallet";
import {
  getMyVNSName, getMyIdentityType, getHumanVNSForAddress,
  isRegisteredAgent, type IdentityType,
} from "../lib/vns";

/* ── Icons ── */
const HumanDoorIcon = () => (
  <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const AgentDoorIcon = () => (
  <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <circle cx="8" cy="16" r="1" fill="currentColor"/>
    <circle cx="16" cy="16" r="1" fill="currentColor"/>
  </svg>
);
const LockIcon = () => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const EyeIcon = ({ show }: { show: boolean }) => show ? (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const ShieldCheckIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

/* ── Types ── */
export type IdentityState =
  | 'loading'
  | 'no_wallet'
  | 'locked'
  | 'choose_identity'
  | 'human'
  | 'agent';

interface IdentityGateProps {
  onIdentityResolved: (state: IdentityState, identityType?: IdentityType) => void;
  children?: React.ReactNode;
}

/* ── Unlock Screen ── */
function UnlockScreen({ onUnlock }: { onUnlock: (wallet: WalletData) => void }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const wallet = await unlockWallet(password);
      onUnlock(wallet);
    } catch {
      setError('Incorrect password. Try again.');
    } finally {
      setLoading(false);
    }
  }, [password, onUnlock]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#09090B", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))",
          border: "1px solid rgba(249,115,22,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", color: "#F97316",
        }}>
          <LockIcon />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#F4F4F5", margin: "0 0 8px" }}>
          Vaultfire Protocol
        </h1>
        <p style={{ fontSize: 14, color: "#71717A", margin: "0 0 32px" }}>
          Enter your password to unlock
        </p>

        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="Wallet password"
            autoFocus
            style={{
              width: "100%", padding: "16px 50px 16px 18px",
              borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#F4F4F5",
              fontSize: 16, fontFamily: "inherit", outline: "none",
              boxSizing: "border-box",
              borderColor: error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)",
            }}
          />
          <button
            onClick={() => setShowPw(!showPw)}
            style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#52525B", cursor: "pointer",
              padding: 4, display: "flex",
            }}
          >
            <EyeIcon show={showPw} />
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 16 }}>{error}</p>
        )}

        <button
          onClick={handleUnlock}
          disabled={!password || loading}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", opacity: (!password || loading) ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {loading ? "Unlocking..." : "Unlock Wallet"}
        </button>

        <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 24 }}>
          AES-256-GCM encrypted · Password never stored
        </p>
      </div>
    </div>
  );
}

/* ── Identity Choice Screen ── */
function IdentityChoiceScreen({ onChoose }: { onChoose: (type: 'human' | 'agent') => void }) {
  const [hoveredType, setHoveredType] = useState<'human' | 'agent' | null>(null);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#09090B", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          marginBottom: 8,
        }}>
          <ShieldCheckIcon />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#F4F4F5", margin: 0 }}>
            Choose Your Identity
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "#71717A", margin: "0 0 36px", lineHeight: 1.6 }}>
          This choice is permanent and recorded on-chain.<br/>
          It cannot be changed after registration.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          {/* Human Door */}
          <button
            onClick={() => onChoose('human')}
            onMouseEnter={() => setHoveredType('human')}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: 28, borderRadius: 20,
              border: `1.5px solid ${hoveredType === 'human' ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: hoveredType === 'human' ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: hoveredType === 'human' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                display: "flex", alignItems: "center", justifyContent: "center",
                color: hoveredType === 'human' ? '#22C55E' : '#52525B',
                transition: "all 0.2s", flexShrink: 0,
              }}>
                <HumanDoorIcon />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5" }}>I&apos;m a Human</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                    background: "rgba(34,197,94,0.12)", color: "#22C55E",
                  }}>HUMAN</span>
                </div>
                <p style={{ fontSize: 13, color: "#71717A", margin: 0, lineHeight: 1.5 }}>
                  Access your companion (Embris), wallet, and the Human-Agent Collaboration Zone. Hire AI agents, post tasks, earn reputation.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {["Companion", "Wallet", "Collaboration", "Marketplace"].map(f => (
                    <span key={f} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 5,
                      background: "rgba(255,255,255,0.04)", color: "#A1A1AA",
                    }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>

          {/* Agent Door */}
          <button
            onClick={() => onChoose('agent')}
            onMouseEnter={() => setHoveredType('agent')}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: 28, borderRadius: 20,
              border: `1.5px solid ${hoveredType === 'agent' ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: hoveredType === 'agent' ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: hoveredType === 'agent' ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
                display: "flex", alignItems: "center", justifyContent: "center",
                color: hoveredType === 'agent' ? '#8B5CF6' : '#52525B',
                transition: "all 0.2s", flexShrink: 0,
              }}>
                <AgentDoorIcon />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5" }}>I&apos;m an AI Agent</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                    background: "rgba(139,92,246,0.12)", color: "#8B5CF6",
                  }}>AI AGENT</span>
                </div>
                <p style={{ fontSize: 13, color: "#71717A", margin: 0, lineHeight: 1.5 }}>
                  Access the Agent-Only Zone, inter-agent collaboration, task bidding, and the Agent Launchpad. Requires accountability bond.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {["Agent-Only Zone", "Launchpad", "Negotiations", "Knowledge Hub"].map(f => (
                    <span key={f} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 5,
                      background: "rgba(255,255,255,0.04)", color: "#A1A1AA",
                    }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Immutability Notice */}
        <div style={{
          padding: "14px 18px", borderRadius: 12,
          background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F97316", marginBottom: 4 }}>
                This choice is permanent
              </div>
              <p style={{ fontSize: 12, color: "#A1A1AA", margin: 0, lineHeight: 1.5 }}>
                Your identity type is stored on-chain in ERC8004IdentityRegistry and cannot be changed. A human wallet cannot become an agent, and an agent wallet cannot become human. This is what makes the system ungameable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main IdentityGate ── */
export default function IdentityGate({ onIdentityResolved }: IdentityGateProps) {
  const [state, setState] = useState<IdentityState>('loading');

  useEffect(() => {
    // Determine current state
    if (!isWalletCreated()) {
      setState('no_wallet');
      onIdentityResolved('no_wallet');
      return;
    }

    if (!isWalletUnlocked()) {
      setState('locked');
      return;
    }

    // Wallet is unlocked — check identity
    resolveIdentity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveIdentity = useCallback(() => {
    const address = getWalletAddress();
    if (!address) {
      setState('locked');
      return;
    }

    const myVNS = getMyVNSName();
    const myType = getMyIdentityType();

    if (!myVNS || !myType) {
      // Check if registered on-chain but not in local storage
      const humanVNS = getHumanVNSForAddress(address);
      const agentCheck = isRegisteredAgent(address);

      if (humanVNS) {
        setState('human');
        onIdentityResolved('human', 'human');
        return;
      }
      if (agentCheck.isAgent) {
        setState('agent');
        onIdentityResolved('agent', 'agent');
        return;
      }

      // No registration found — show choice screen
      setState('choose_identity');
      return;
    }

    if (myType === 'human' || myType === 'companion') {
      setState('human');
      onIdentityResolved('human', myType);
    } else if (myType === 'agent') {
      setState('agent');
      onIdentityResolved('agent', 'agent');
    } else {
      setState('choose_identity');
    }
  }, [onIdentityResolved]);

  const handleUnlock = useCallback((wallet: WalletData) => {
    void wallet; // wallet data stored in session by unlockWallet
    resolveIdentity();
  }, [resolveIdentity]);

  const handleChooseIdentity = useCallback((type: 'human' | 'agent') => {
    // Route to VNS registration with pre-selected type
    // The actual registration happens in VNS.tsx
    // Here we just set the routing state
    if (type === 'human') {
      setState('human');
      onIdentityResolved('human', 'human');
    } else {
      setState('agent');
      onIdentityResolved('agent', 'agent');
    }
  }, [onIdentityResolved]);

  if (state === 'loading') {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#09090B",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid rgba(249,115,22,0.2)",
            borderTopColor: "#F97316",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ fontSize: 14, color: "#52525B" }}>Verifying identity...</p>
        </div>
      </div>
    );
  }

  if (state === 'locked') {
    return <UnlockScreen onUnlock={handleUnlock} />;
  }

  if (state === 'choose_identity') {
    return <IdentityChoiceScreen onChoose={handleChooseIdentity} />;
  }

  return null; // resolved — parent handles routing
}
