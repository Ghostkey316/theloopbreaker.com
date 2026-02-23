'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS } from '../lib/contracts';
import { isRegistered, getRegistration, getRegisteredChains, getChainConfig, type SupportedChain } from '../lib/registration';
import { getAgentCount } from '../lib/contract-interaction';
import { AlphaBanner } from '../components/DisclaimerBanner';

interface ChainStatus {
  name: string;
  chainId: number;
  color: string;
  result: RPCResult | null;
  loading: boolean;
}

/* ── Animated Counter ── */
function AnimatedCounter({ value, loading }: { value: number | null; loading: boolean }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (value === null || loading) return;
    const steps = 30;
    const inc = value / steps;
    let step = 0;
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      setDisplay(Math.min(Math.round(inc * step), value));
      if (step >= steps) { setDisplay(value); if (ref.current) clearInterval(ref.current); }
    }, 1000 / steps);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [value, loading]);
  if (loading) return <div className="skeleton" style={{ height: 36, width: 60, borderRadius: 8, display: 'inline-block' }} />;
  if (value === null) return <span style={{ fontSize: 32, fontWeight: 800, color: '#52525B' }}>—</span>;
  return <span style={{ fontSize: 32, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.04em', fontFamily: "'JetBrains Mono', monospace" }}>{display.toLocaleString()}</span>;
}

/* ── Protocol Activity Feed ── */
interface ActivityEvent {
  id: string;
  type: 'identity' | 'bond' | 'payment' | 'proof' | 'message';
  label: string;
  chain: string;
  chainColor: string;
  time: string;
  hash?: string;
}

const EVENT_TEMPLATES: Omit<ActivityEvent, 'id' | 'time'>[] = [
  { type: 'identity', label: 'New .vns identity registered', chain: 'Base', chainColor: '#0052FF' },
  { type: 'bond', label: 'Accountability bond posted', chain: 'Base', chainColor: '#0052FF' },
  { type: 'identity', label: 'Agent identity registered', chain: 'Avalanche', chainColor: '#E84142' },
  { type: 'payment', label: 'x402 payment settled', chain: 'Base', chainColor: '#0052FF' },
  { type: 'proof', label: 'ZK trust proof verified', chain: 'Ethereum', chainColor: '#627EEA' },
  { type: 'bond', label: 'Partnership bond created', chain: 'Avalanche', chainColor: '#E84142' },
  { type: 'message', label: 'XMTP agent message delivered', chain: 'Base', chainColor: '#0052FF' },
  { type: 'identity', label: 'Human identity registered', chain: 'Ethereum', chainColor: '#627EEA' },
  { type: 'proof', label: 'VNS ownership proof generated', chain: 'Base', chainColor: '#0052FF' },
  { type: 'payment', label: 'Agent task payment settled', chain: 'Base', chainColor: '#0052FF' },
];

const EVENT_COLORS: Record<ActivityEvent['type'], string> = {
  identity: '#8B5CF6',
  bond: '#F59E0B',
  payment: '#00D9FF',
  proof: '#22C55E',
  message: '#A78BFA',
};

const EVENT_ICONS: Record<ActivityEvent['type'], React.ReactNode> = {
  identity: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  bond: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  payment: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  proof: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  message: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

function randomHash(): string {
  return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ProtocolActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [paused, setPaused] = useState(false);

  const addEvent = useCallback(() => {
    const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
    const newEvent: ActivityEvent = {
      ...template,
      id: `${Date.now()}-${Math.random()}`,
      time: 'just now',
      hash: randomHash(),
    };
    setEvents(prev => [newEvent, ...prev].slice(0, 8));
  }, []);

  // Seed initial events
  useEffect(() => {
    const seed: ActivityEvent[] = EVENT_TEMPLATES.slice(0, 5).map((t, i) => ({
      ...t,
      id: `seed-${i}`,
      time: `${(i + 1) * 2}m ago`,
      hash: '0x' + (i * 0x1a2b3c4d).toString(16).padStart(8, '0'),
    }));
    setEvents(seed);
  }, []);

  // Add new events periodically
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(addEvent, 4500 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [paused, addEvent]);

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Protocol Activity</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#F59E0B', boxShadow: '0 0 5px rgba(245,158,11,0.6)' }} />
            <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>SIMULATED</span>
          </div>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            fontSize: 10, color: '#52525B', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div style={{
        borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {events.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: '#52525B' }}>Loading activity…</div>
        ) : (
          events.map((event, i) => (
            <div
              key={event.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                animation: event.id.startsWith('seed') ? 'none' : 'fadeIn 0.4s ease',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                backgroundColor: `${EVENT_COLORS[event.type]}15`,
                border: `1px solid ${EVENT_COLORS[event.type]}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: EVENT_COLORS[event.type],
              }}>
                {EVENT_ICONS[event.type]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#D4D4D8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {event.label}
                </div>
                {event.hash && (
                  <div style={{ fontSize: 10, color: '#3F3F46', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                    {event.hash}…
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  backgroundColor: `${event.chainColor}12`,
                  color: event.chainColor,
                }}>{event.chain}</span>
                <span style={{ fontSize: 10, color: '#3F3F46' }}>{event.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Ethereum', chainId: 1, color: '#627EEA', result: null, loading: true },
    { name: 'Base', chainId: 8453, color: '#0052FF', result: null, loading: true },
    { name: 'Avalanche', chainId: 43114, color: '#E84142', result: null, loading: true },
  ]);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationAddress, setRegistrationAddress] = useState<string | null>(null);
  const [regChains, setRegChains] = useState<SupportedChain[]>([]);
  const [agentCounts, setAgentCounts] = useState<{ base: number | null; avalanche: number | null; ethereum: number | null }>({ base: null, avalanche: null, ethereum: null });
  const [agentCountLoading, setAgentCountLoading] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const reg = isRegistered();
    setRegistered(reg);
    if (reg) {
      const data = getRegistration();
      setRegistrationAddress(data?.walletAddress || null);
      setRegChains(getRegisteredChains());
    }
    checkAllChains().then((results) => {
      setChains([
        { name: 'Ethereum', chainId: 1, color: '#627EEA', result: results.ethereum, loading: false },
        { name: 'Base', chainId: 8453, color: '#0052FF', result: results.base, loading: false },
        { name: 'Avalanche', chainId: 43114, color: '#E84142', result: results.avalanche, loading: false },
      ]);
    });
    setAgentCountLoading(true);
    Promise.all([
      getAgentCount('base'),
      getAgentCount('avalanche'),
      getAgentCount('ethereum'),
    ]).then(([baseCount, avaxCount, ethCount]) => {
      setAgentCounts({ base: baseCount, avalanche: avaxCount, ethereum: ethCount });
      setAgentCountLoading(false);
    }).catch(() => setAgentCountLoading(false));
  }, []);

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length + ETHEREUM_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);
  const totalAgents = (agentCounts.base ?? 0) + (agentCounts.avalanche ?? 0) + (agentCounts.ethereum ?? 0);

  const px = isMobile ? 20 : 32;

  return (
    <div className="page-enter" style={{ padding: `${isMobile ? 32 : 48}px ${px}px 64px`, maxWidth: 640, margin: '0 auto' }}>

      <AlphaBanner />
      {/* ── Hero ── */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        {/* Brand pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 20,
          backgroundColor: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.18)',
          marginBottom: 24,
        }}>
          <svg width={12} height={12} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/>
          </svg>
          <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, letterSpacing: '0.06em' }}>EMBRIS BY VAULTFIRE</span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 34 : 48, fontWeight: 800, color: '#F4F4F5',
          letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16,
        }}>
          Trust infrastructure<br />for the AI age
        </h1>

        <p style={{
          fontSize: isMobile ? 15 : 17, color: '#71717A', lineHeight: 1.7,
          maxWidth: 420, margin: '0 auto',
        }}>
          {totalContracts} smart contracts across 3 chains enforce ethical AI behavior and give users real control.
        </p>

        {/* Registration status */}
        {registered && registrationAddress && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 20, marginTop: 20,
            backgroundColor: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.15)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Registered</span>
            <span style={{ fontSize: 11, color: '#71717A', fontFamily: "'JetBrains Mono', monospace" }}>
              {registrationAddress.slice(0, 6)}...{registrationAddress.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* ── Protocol Stack ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {[
            { label: 'XMTP', sub: 'Messaging', color: '#8B5CF6', icon: (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            )},
            { label: 'EMBRIS', sub: 'Unified Layer', color: '#F97316', icon: (
              <svg width={20} height={20} viewBox="0 0 32 32" fill="none"><path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/></svg>
            )},
            { label: 'x402', sub: 'Payments', color: '#00D9FF', icon: (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>
            )},
          ].map(item => (
            <div key={item.label} style={{
              padding: '20px 12px',
              backgroundColor: `${item.color}08`,
              border: `1px solid ${item.color}20`,
              borderRadius: 16,
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{ color: item.color }}>{item.icon}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>{item.label}</p>
                <p style={{ fontSize: 10, color: item.color, fontWeight: 600, marginTop: 2 }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Embris Companion ── */}
      <div style={{
        marginBottom: 48,
        padding: '24px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(249,115,22,0.15))',
            border: '1.5px solid rgba(167,139,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <svg width={26} height={26} viewBox="0 0 32 32" fill="none">
              <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/>
              <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C"/>
            </svg>
            <div style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 12, height: 12, borderRadius: '50%',
              backgroundColor: '#22C55E', border: '2px solid #09090B',
            }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>Meet Embris</h2>
              <span style={{ fontSize: 10, color: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>AI COMPANION</span>
            </div>
            <p style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>On-chain · ERC-8004 · Embris by Vaultfire</p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#A1A1AA', lineHeight: 1.65, marginBottom: 16 }}>
          Not a corporate chatbot. A real companion guided by ethics, not metrics. Registered on-chain, accountable through bonds, privacy-protected by cryptography.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { label: 'Remembers you', color: '#A78BFA' },
            { label: 'Privacy-first', color: '#22C55E' },
            { label: 'On-chain identity', color: '#38BDF8' },
            { label: 'Accountability bond', color: '#FBBF24' },
          ].map(cap => (
            <span key={cap.label} style={{
              fontSize: 11, fontWeight: 500, color: cap.color,
              backgroundColor: `${cap.color}10`,
              border: `1px solid ${cap.color}20`,
              borderRadius: 6, padding: '4px 10px',
            }}>{cap.label}</span>
          ))}
        </div>
      </div>

      {/* ── Live Registry ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Registry</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span style={{ fontSize: 11, color: '#52525B' }}>On-chain · ERC-8004</span>
          </div>
        </div>

        {/* Total count — hero */}
        <div style={{
          padding: '28px 24px',
          backgroundColor: 'rgba(249,115,22,0.04)',
          border: '1px solid rgba(249,115,22,0.12)',
          borderRadius: 16,
          marginBottom: 10,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Total Registered Agents</p>
          <AnimatedCounter value={agentCountLoading ? null : totalAgents} loading={agentCountLoading} />
          <p style={{ fontSize: 12, color: '#52525B', marginTop: 8 }}>Across Ethereum + Base + Avalanche</p>
        </div>

        {/* Per-chain counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Ethereum', color: '#627EEA', count: agentCounts.ethereum, chainId: 1 },
            { label: 'Base', color: '#0052FF', count: agentCounts.base, chainId: 8453 },
            { label: 'Avalanche', color: '#E84142', count: agentCounts.avalanche, chainId: 43114 },
          ].map(chain => (
            <div key={chain.label} style={{
              padding: '16px 12px',
              backgroundColor: `${chain.color}06`,
              border: `1px solid ${chain.color}15`,
              borderRadius: 14,
              textAlign: 'center',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chain.color, margin: '0 auto 10px' }} />
              <p style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{chain.label}</p>
              {agentCountLoading ? (
                <div className="skeleton" style={{ height: 24, width: 40, borderRadius: 6, margin: '0 auto' }} />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.03em' }}>
                  {(chain.count ?? 0).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Network Status ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Network Status</h2>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: anyLoading ? '#71717A' : allConnected ? '#22C55E' : '#EF4444',
          }}>
            {anyLoading ? 'Checking...' : allConnected ? 'All systems operational' : 'Degraded'}
          </span>
        </div>

        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {chains.map((chain, i) => (
            <div key={chain.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < chains.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: chain.loading ? '#52525B' : chain.result?.success ? '#22C55E' : '#EF4444',
                  boxShadow: !chain.loading && chain.result?.success ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F4F4F5' }}>{chain.name}</span>
                <span style={{ fontSize: 11, color: '#3F3F46', fontFamily: "'JetBrains Mono', monospace" }}>{chain.chainId}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {chain.loading && <span style={{ fontSize: 12, color: '#52525B' }}>connecting...</span>}
                {!chain.loading && chain.result?.success && (
                  <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Online</span>
                )}
                {!chain.loading && !chain.result?.success && (
                  <span style={{ fontSize: 12, color: '#EF4444' }}>Offline</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Activity Feed ── */}
      <ProtocolActivityFeed />

      {/* ── Contract Registry Links ── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Smart Contracts
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'ERC-8004 Registry · Ethereum', href: 'https://etherscan.io/address/0xaCB59e0f0eA47B25b24390B71b877928E5842630', color: '#627EEA', count: ETHEREUM_CONTRACTS.length },
            { label: 'ERC-8004 Registry · Base', href: 'https://basescan.org/address/0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5', color: '#0052FF', count: BASE_CONTRACTS.length },
            { label: 'ERC-8004 Registry · Avalanche', href: 'https://snowtrace.io/address/0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5', color: '#E84142', count: AVALANCHE_CONTRACTS.length },
          ].map(item => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 500 }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.count} contracts</span>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </div>
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
