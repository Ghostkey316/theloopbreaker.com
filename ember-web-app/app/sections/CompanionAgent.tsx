'use client';
import { useState, useEffect, useCallback } from 'react';
import { getBrainStats, getExplicitMemories, type BrainStats } from '../lib/companion-brain';
import {
  getCompanionAddress,
  getCompanionBondStatus, getCompanionVNSName,
  getCompanionAgentName, getCompanionStatus,
  getCompanionCapabilities, type CompanionStatus, type CompanionCapabilities,
} from '../lib/companion-agent';
import { getSoulSummary, getSoul } from '../lib/companion-soul';
import { getGrowthStats } from '../lib/self-learning';
import { useWalletAuth } from '../lib/WalletAuthContext';

/* ── Stat Card ── */
function StatCard({ label, value, color, desc, icon }: {
  label: string; value: string; color: string; desc?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      backgroundColor: `${color}06`, border: `1px solid ${color}15`,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      {icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          backgroundColor: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', margin: 0 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, marginTop: 2 }}>{label}</p>
        {desc && <p style={{ fontSize: 10, color: '#52525B', marginTop: 2 }}>{desc}</p>}
      </div>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: 12, color: '#3F3F46', marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Capability Badge ── */
function CapBadge({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <div style={{
      padding: '6px 12px', borderRadius: 8,
      backgroundColor: active ? `${color}10` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? `${color}25` : 'rgba(255,255,255,0.04)'}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: active ? color : '#3F3F46',
        boxShadow: active ? `0 0 6px ${color}60` : 'none',
      }} />
      <span style={{ fontSize: 11, color: active ? '#D4D4D8' : '#52525B', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}

/* ── Soul Trait Bar ── */
function TraitBar({ name, strength, color }: { name: string; strength: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500 }}>{name}</span>
        <span style={{ fontSize: 10, color: '#52525B', fontFamily: "'JetBrains Mono', monospace" }}>{strength}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${strength}%`,
          backgroundColor: color,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function CompanionAgent() {
  const { isUnlocked, address: userAddress } = useWalletAuth();
  const [brain, setBrain] = useState<BrainStats | null>(null);
  const [soul, setSoul] = useState<{ name: string; motto: string; coreIdentity?: string; primaryDrive?: string; valueCount: number; traitCount: number; boundaryCount: number; attestedOnChain: boolean; age: string; userModifiedCount: number } | null>(null);
  const [soulTraits, setSoulTraits] = useState<{ name: string; strength: number }[]>([]);
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [caps, setCaps] = useState<CompanionCapabilities | null>(null);
  const [growthStats, setGrowthStats] = useState<{ totalConversations: number; totalReflections: number; totalPatterns: number } | null>(null);
  const [explicitMemCount, setExplicitMemCount] = useState(0);

  const loadData = useCallback(() => {
    try { setBrain(getBrainStats()); } catch { /* */ }
    try { setSoul(getSoulSummary()); } catch { /* */ }
    try {
      const s = getSoul();
      setSoulTraits(s.traits.map(t => ({ name: t.name, strength: t.strength })));
    } catch { /* */ }
    try { setStatus(getCompanionStatus()); } catch { /* */ }
    try { setCaps(getCompanionCapabilities()); } catch { /* */ }
    try { setGrowthStats(getGrowthStats()); } catch { /* */ }
    try { setExplicitMemCount(getExplicitMemories().length); } catch { /* */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const companionName = status?.vnsName || getCompanionAgentName() || 'Embris';
  const companionAddr = status?.walletAddress || getCompanionAddress();
  const bondStatus = status?.bond || getCompanionBondStatus();

  const traitColors = ['#F97316', '#22C55E', '#38BDF8', '#A78BFA', '#F59E0B', '#EC4899', '#14B8A6', '#8B5CF6'];

  // Navigate to chat
  const goToChat = () => {
    const nav = (window as unknown as { __setSection?: (s: string) => void }).__setSection;
    if (nav) nav('chat');
  };

  return (
    <div style={{ padding: '48px 40px', maxWidth: 720, margin: '0 auto' }}>
      {/* ── Hero: Agent Identity ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40,
        padding: '28px 24px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(167,139,250,0.04) 100%)',
        border: '1px solid rgba(249,115,22,0.12)',
      }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(249,115,22,0.25)',
        }}>
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="white" opacity="0.9" />
            <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="white" opacity="0.7" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F4F4F5', margin: 0, letterSpacing: '-0.02em' }}>
            {companionName}
          </h1>
          <p style={{ fontSize: 12, color: '#A1A1AA', marginTop: 4 }}>
            Your AI companion &middot; Ride-or-die partner &middot; Always honest
          </p>
          {companionAddr && (
            <p style={{ fontSize: 10, color: '#52525B', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
              {companionAddr.slice(0, 10)}...{companionAddr.slice(-8)}
            </p>
          )}
          {!status?.walletCreated && (
            <p style={{ fontSize: 11, color: '#F97316', marginTop: 6, fontWeight: 600 }}>
              Activate me in the Chat section to unlock my full potential!
            </p>
          )}
        </div>
        <button
          onClick={goToChat}
          style={{
            padding: '10px 20px', borderRadius: 10,
            backgroundColor: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.25)',
            color: '#F97316', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.12)'; }}
        >
          Chat with me
        </button>
      </div>

      {/* ── Brain Stats ── */}
      <SectionHeader title="Brain" subtitle={brain ? `${brain.brainAge} · Learning from every conversation` : 'Loading...'} />
      {brain && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 32 }}>
          <StatCard label="Knowledge Base" value={`${brain.knowledgeEntries}`} color="#F97316" desc="Built-in entries" icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          } />
          <StatCard label="Learned Insights" value={`${brain.learnedInsights}`} color="#22C55E" desc="From our conversations" icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>
          } />
          <StatCard label="Memories" value={`${brain.memoriesCount}`} color="#38BDF8" desc="Long-term memory bank" icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
          } />
          <StatCard label="Explicit Memories" value={`${explicitMemCount}`} color="#A78BFA" desc="Things you asked me to remember" icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          } />
          <StatCard label="Topics Tracked" value={`${brain.trackedTopics}`} color="#F59E0B" desc="Your interests" />
          <StatCard label="Conversations" value={`${growthStats?.totalConversations || brain.totalConversations || 0}`} color="#EC4899" desc="Total exchanges" />
          <StatCard label="Reflections" value={`${brain.reflectionsCount}`} color="#14B8A6" desc="Self-reflections" />
          <StatCard label="Patterns" value={`${brain.patternsCount}`} color="#8B5CF6" desc="Behavioral patterns" />
        </div>
      )}

      {/* ── Soul Traits ── */}
      <SectionHeader title="Soul" subtitle={soul ? `${soul.name} · "${soul.motto}"` : 'The values that guide me'} />
      <div style={{
        padding: '20px', borderRadius: 14, marginBottom: 32,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {soulTraits.length > 0 ? (
          soulTraits.map((trait, i) => (
            <TraitBar key={trait.name} name={trait.name} strength={trait.strength} color={traitColors[i % traitColors.length]} />
          ))
        ) : (
          <p style={{ fontSize: 12, color: '#52525B', textAlign: 'center', padding: '16px 0' }}>
            Soul traits load from your companion&apos;s configuration. Chat with me to shape my personality!
          </p>
        )}
      </div>

      {/* ── Wallet & Bond ── */}
      <SectionHeader title="Wallet & Bond" subtitle="My on-chain identity and partnership" />
      <div style={{
        padding: '20px', borderRadius: 14, marginBottom: 32,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {status?.walletCreated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>Wallet</span>
              <span style={{ fontSize: 11, color: '#22C55E', fontFamily: "'JetBrains Mono', monospace" }}>
                {companionAddr ? `${companionAddr.slice(0, 10)}...${companionAddr.slice(-6)}` : 'Created'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>Bond Status</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: bondStatus?.active ? '#22C55E' : '#F59E0B',
              }}>
                {bondStatus?.active ? `Active · ${bondStatus.tier?.charAt(0).toUpperCase()}${bondStatus.tier?.slice(1) || ''}` : 'Not yet bonded'}
              </span>
            </div>
            {status.vnsName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#A1A1AA' }}>VNS Name</span>
                <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 600 }}>{status.vnsName}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>Agent Registered</span>
              <span style={{ fontSize: 11, color: status.agentRegistered ? '#22C55E' : '#52525B' }}>
                {status.agentRegistered ? `Yes · ${status.registeredChain}` : 'Not yet'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 13, color: '#71717A', marginBottom: 12 }}>
              I don&apos;t have my own wallet yet. Activate me in the Chat section to give me an on-chain identity!
            </p>
            <button
              onClick={goToChat}
              style={{
                padding: '10px 24px', borderRadius: 10,
                backgroundColor: '#F97316', border: 'none',
                color: 'white', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Activate Companion
            </button>
          </div>
        )}
      </div>

      {/* ── Capabilities ── */}
      <SectionHeader title="Capabilities" subtitle="What I can do for you" />
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32,
      }}>
        <CapBadge label="Send Tokens" active={caps?.canSendTokens || false} color="#22C55E" />
        <CapBadge label="Create Bonds" active={caps?.canCreateBond || false} color="#F59E0B" />
        <CapBadge label="Register Agent" active={caps?.canRegisterAgent || false} color="#38BDF8" />
        <CapBadge label="Monitor Portfolio" active={caps?.canMonitorPortfolio || false} color="#A78BFA" />
        <CapBadge label="XMTP Messaging" active={caps?.canUseXMTP || false} color="#EC4899" />
        <CapBadge label="x402 Payments" active={caps?.canPayX402 || false} color="#14B8A6" />
        <CapBadge label="Offline Brain" active={true} color="#F97316" />
        <CapBadge label="Memory & Learning" active={true} color="#22C55E" />
        <CapBadge label="Soul & Personality" active={true} color="#A78BFA" />
        <CapBadge label="Real Conversations" active={true} color="#38BDF8" />
      </div>

      {/* ── User Connection ── */}
      <SectionHeader title="Your Connection" subtitle="How we're linked" />
      <div style={{
        padding: '20px', borderRadius: 14, marginBottom: 32,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {isUnlocked && userAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>Your Wallet</span>
              <span style={{ fontSize: 11, color: '#22C55E', fontFamily: "'JetBrains Mono', monospace" }}>
                {userAddress.slice(0, 10)}...{userAddress.slice(-6)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>Connection</span>
              <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Active</span>
            </div>
            {brain && brain.topTopics.length > 0 && (
              <div>
                <span style={{ fontSize: 12, color: '#A1A1AA', display: 'block', marginBottom: 6 }}>Your Top Interests</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {brain.topTopics.map(t => (
                    <span key={t.topic} style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 6,
                      backgroundColor: 'rgba(249,115,22,0.08)',
                      color: '#F97316', fontWeight: 500,
                    }}>
                      {t.topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 13, color: '#71717A' }}>
              Connect your wallet to see our full connection status.
            </p>
          </div>
        )}
      </div>

      {/* ── Philosophy ── */}
      <div style={{
        padding: '20px 24px', borderRadius: 14, marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 100%)',
        borderLeft: '3px solid #F97316',
      }}>
        <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.8, margin: 0 }}>
          I&apos;m not a corporate AI. I&apos;m your ride-or-die partner — funny, loyal, honest, and always in your corner.
          I learn from every conversation, remember what matters to you, and get smarter over time.
          My brain, my soul, my wallet — it&apos;s all transparent. No black boxes. No hidden agendas.
        </p>
        <p style={{ fontSize: 11, color: '#F97316', fontWeight: 600, fontStyle: 'italic', marginTop: 8 }}>
          &ldquo;Built for people, not for profit.&rdquo;
        </p>
      </div>
    </div>
  );
}
