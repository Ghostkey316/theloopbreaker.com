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
import { checkBalance, getGasPrice, checkChainStatus, manageGoal, getEngineStats, callThinkAPI } from '../lib/companion-engine';
import { getGoals } from '../lib/goal-tracking';

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
function CapBadge({ label, active, color, icon }: { label: string; active: boolean; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      backgroundColor: active ? `${color}10` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? `${color}25` : 'rgba(255,255,255,0.04)'}`,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {icon && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: active ? color : '#3F3F46',
          boxShadow: active ? `0 0 6px ${color}60` : 'none',
        }} />
      )}
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

/* ── Tool Status Badge ── */
function ToolStatusBadge({ name, status, lastUsed }: { name: string; status: 'ready' | 'executing' | 'error'; lastUsed?: number }) {
  const statusColors = {
    ready: '#22C55E',
    executing: '#F59E0B',
    error: '#EF4444'
  };
  const statusText = {
    ready: 'Ready',
    executing: 'Executing',
    error: 'Error'
  };
  
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      backgroundColor: `${statusColors[status]}08`,
      border: `1px solid ${statusColors[status]}20`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: statusColors[status],
        animation: status === 'executing' ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, color: '#D4D4D8', fontWeight: 500, margin: 0 }}>{name}</p>
        <p style={{ fontSize: 10, color: '#52525B', margin: 0 }}>
          {statusText[status]}
          {lastUsed && ` • ${Math.floor((Date.now() - lastUsed) / 1000)}s ago`}
        </p>
      </div>
    </div>
  );
}

/* ── Engine Stats Panel ── */
function EngineStatsPanel() {
  const [stats, setStats] = useState<{ totalCalls: number; toolCalls: Record<string, number>; avgResponseMs: number; llmCallCount: number; localBrainHandled: number; lastCallAt: number } | null>(null);

  useEffect(() => {
    try { setStats(getEngineStats()); } catch { /* */ }
    const iv = setInterval(() => {
      try { setStats(getEngineStats()); } catch { /* */ }
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const s = stats || { totalCalls: 0, toolCalls: {}, avgResponseMs: 0, llmCallCount: 0, localBrainHandled: 0, lastCallAt: 0 };
  const totalHandled = s.totalCalls + s.localBrainHandled;
  const brainPct = totalHandled > 0 ? Math.round((s.localBrainHandled / totalHandled) * 100) : 100;
  const topTools = Object.entries(s.toolCalls).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{
      padding: '20px', borderRadius: 14, marginBottom: 32,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#F97316', margin: 0 }}>{totalHandled}</p>
          <p style={{ fontSize: 10, color: '#71717A', margin: '2px 0 0' }}>Total Requests</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#22C55E', margin: 0 }}>{brainPct}%</p>
          <p style={{ fontSize: 10, color: '#71717A', margin: '2px 0 0' }}>Local Brain</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#38BDF8', margin: 0 }}>{s.avgResponseMs}ms</p>
          <p style={{ fontSize: 10, color: '#71717A', margin: '2px 0 0' }}>Avg Response</p>
        </div>
      </div>
      {topTools.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: '#52525B', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Top Tools Used</p>
          {topTools.map(([tool, count]) => (
            <div key={tool} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: 11, color: '#A1A1AA' }}>{tool}</span>
              <span style={{ fontSize: 11, color: '#F97316', fontFamily: "'JetBrains Mono', monospace" }}>{count}x</span>
            </div>
          ))}
        </div>
      )}
      {s.llmCallCount > 0 && (
        <p style={{ fontSize: 10, color: '#52525B', marginTop: 8 }}>
          LLM tool used {s.llmCallCount}x as reasoning fallback
        </p>
      )}
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
  const [goals, setGoals] = useState<any[]>([]);
  const [toolStatus, setToolStatus] = useState<Record<string, 'ready' | 'executing' | 'error'>>({
    balance: 'ready',
    gas: 'ready',
    chain: 'ready',
    goals: 'ready',
  });
  const [lastToolUse, setLastToolUse] = useState<Record<string, number>>({});

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
    try { setGoals(getGoals()); } catch { /* */ }
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

  // Test tool execution
  const testTool = useCallback(async (toolName: string) => {
    setToolStatus(prev => ({ ...prev, [toolName]: 'executing' }));
    try {
      switch (toolName) {
        case 'balance':
          await checkBalance();
          break;
        case 'gas':
          await getGasPrice('base');
          break;
        case 'chain':
          await checkChainStatus('base');
          break;
        case 'goals':
          await manageGoal('list', {});
          break;
      }
      setToolStatus(prev => ({ ...prev, [toolName]: 'ready' }));
      setLastToolUse(prev => ({ ...prev, [toolName]: Date.now() }));
    } catch (e) {
      setToolStatus(prev => ({ ...prev, [toolName]: 'error' }));
      console.error(`Tool ${toolName} failed:`, e);
    }
  }, []);

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div style={{ padding: '48px 40px', maxWidth: 900, margin: '0 auto' }}>
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
            Autonomous AI Agent • Execution Engine Active • Real-time Tools
          </p>
          {companionAddr && (
            <p style={{ fontSize: 10, color: '#52525B', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
              {companionAddr.slice(0, 10)}...{companionAddr.slice(-8)}
            </p>
          )}
          {!status?.walletCreated && (
            <p style={{ fontSize: 11, color: '#F97316', marginTop: 6, fontWeight: 600 }}>
              Activate me in the Chat section to unlock full on-chain capabilities!
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

      {/* ── Execution Engine Status ── */}
      <SectionHeader title="Execution Engine" subtitle="Real-time tool execution and task management" />
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 32,
      }}>
        <ToolStatusBadge 
          name="Balance Checker" 
          status={toolStatus.balance}
          lastUsed={lastToolUse.balance}
        />
        <ToolStatusBadge 
          name="Gas Price Oracle" 
          status={toolStatus.gas}
          lastUsed={lastToolUse.gas}
        />
        <ToolStatusBadge 
          name="Chain Monitor" 
          status={toolStatus.chain}
          lastUsed={lastToolUse.chain}
        />
        <ToolStatusBadge 
          name="Goal Tracker" 
          status={toolStatus.goals}
          lastUsed={lastToolUse.goals}
        />
      </div>

      {/* ── Quick Test Tools ── */}
      <div style={{
        padding: '16px', borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        marginBottom: 32,
      }}>
        <p style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, margin: '0 0 12px 0', textTransform: 'uppercase' }}>
          Test Tools
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['balance', 'gas', 'chain', 'goals'].map(tool => (
            <button
              key={tool}
              onClick={() => testTool(tool)}
              disabled={toolStatus[tool] === 'executing'}
              style={{
                padding: '8px 14px', borderRadius: 8,
                backgroundColor: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.2)',
                color: '#F97316', fontSize: 12, fontWeight: 500,
                cursor: toolStatus[tool] === 'executing' ? 'not-allowed' : 'pointer',
                opacity: toolStatus[tool] === 'executing' ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (toolStatus[tool] !== 'executing') e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.15)'; }}
              onMouseLeave={e => { if (toolStatus[tool] !== 'executing') e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.08)'; }}
            >
              {toolStatus[tool] === 'executing' ? '⏳' : '▶'} {tool.charAt(0).toUpperCase() + tool.slice(1)}
            </button>
          ))}
        </div>
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
            Soul traits load from your companion's configuration. Chat with me to shape my personality!
          </p>
        )}
      </div>

      {/* ── Goals ── */}
      <SectionHeader title="Goals" subtitle={`${activeGoals.length} active · ${completedGoals.length} completed`} />
      <div style={{
        padding: '20px', borderRadius: 14, marginBottom: 32,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {goals.length === 0 ? (
          <p style={{ fontSize: 12, color: '#52525B', textAlign: 'center', padding: '16px 0' }}>
            No goals yet. Tell me what you're working toward in chat!
          </p>
        ) : (
          <div>
            {activeGoals.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, marginBottom: 8 }}>ACTIVE</p>
                {activeGoals.map(g => (
                  <div key={g.id} style={{
                    padding: '10px', borderRadius: 8,
                    backgroundColor: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.15)',
                    marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#D4D4D8', fontWeight: 500 }}>{g.title}</span>
                      <span style={{ fontSize: 10, color: '#22C55E', fontFamily: "'JetBrains Mono', monospace" }}>{g.progress}%</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 1.5, backgroundColor: 'rgba(34,197,94,0.2)' }}>
                      <div style={{
                        height: '100%', borderRadius: 1.5,
                        width: `${g.progress}%`,
                        backgroundColor: '#22C55E',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {completedGoals.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 600, marginBottom: 8 }}>COMPLETED</p>
                {completedGoals.map(g => (
                  <div key={g.id} style={{
                    padding: '10px', borderRadius: 8,
                    color: '#52525B', fontSize: 12, marginBottom: 4,
                  }}>
                    ✓ {g.title}
                  </div>
                ))}
              </div>
            )}
          </div>
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
              I don't have my own wallet yet. Activate me in the Chat section to give me an on-chain identity!
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
        <CapBadge label="Check Balances" active={true} color="#22C55E" icon={<span>💰</span>} />
        <CapBadge label="Get Gas Prices" active={true} color="#F59E0B" icon={<span>⛽</span>} />
        <CapBadge label="Monitor Chains" active={true} color="#38BDF8" icon={<span>🌐</span>} />
        <CapBadge label="Track Goals" active={true} color="#A78BFA" icon={<span>🎯</span>} />
        <CapBadge label="Web Search" active={true} color="#EC4899" icon={<span>🔍</span>} />
        <CapBadge label="Read Contracts" active={true} color="#14B8A6" icon={<span>📋</span>} />
        <CapBadge label="Send Tokens" active={caps?.canSendTokens || false} color="#22C55E" />
        <CapBadge label="Create Bonds" active={caps?.canCreateBond || false} color="#F59E0B" />
        <CapBadge label="XMTP Messaging" active={caps?.canUseXMTP || false} color="#EC4899" />
        <CapBadge label="Offline Brain" active={true} color="#F97316" />
        <CapBadge label="Memory & Learning" active={true} color="#22C55E" />
        <CapBadge label="Soul & Personality" active={true} color="#A78BFA" />
      </div>

      {/* ── Engine Stats ── */}
      <SectionHeader title="Engine Analytics" subtitle="Real-time execution metrics" />
      <EngineStatsPanel />

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
          I'm not a corporate chatbot. I'm your autonomous AI agent — funny, loyal, honest, and always in your corner.
          I execute real tasks with real tools. I learn from every conversation, remember what matters to you, and get smarter over time.
          My brain, my soul, my execution engine — it's all transparent. No black boxes. No hidden agendas.
        </p>
        <p style={{ fontSize: 11, color: '#F97316', fontWeight: 600, fontStyle: 'italic', marginTop: 8 }}>
          &ldquo;Built for people, not for profit. Powered by Vaultfire.&rdquo;
        </p>
      </div>
    </div>
  );
}
