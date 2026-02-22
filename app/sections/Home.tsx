"use client";
import { useEffect, useState, useRef } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from '../lib/contracts';
import { isRegistered, getRegistration, getRegisteredChains, getChainConfig, type SupportedChain } from '../lib/registration';
import { getAgentCount } from '../lib/contract-interaction';

interface ChainStatus {
  name: string;
  chainId: number;
  result: RPCResult | null;
  loading: boolean;
}

/* ── Inline Icons ── */
function ShieldIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
}
function BrainIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.5.5 2.8 1.3 3.8"/><path d="M14.5 2A5.5 5.5 0 0 1 20 7.5c0 1.5-.5 2.8-1.3 3.8"/><path d="M4.7 11.3A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20"/><path d="M19.3 11.3a5.5 5.5 0 0 1 .7 3.2 5.5 5.5 0 0 1-5.5 5.5"/><path d="M12 2v20"/></svg>);
}
function WalletIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>);
}
function HeartIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
}
function GlobeIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>);
}
function UsersIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
}
function FireIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" fill="none"><path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/><path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C"/><path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6"/></svg>);
}
function CheckCircleIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
}
function ExternalLinkIcon({ size = 11 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>);
}
function ZapIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);
}

/* ── Animated Counter ── */
function AnimatedCounter({ value, loading }: { value: number | null; loading: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (value === null || loading) return;
    const target = value;
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setDisplayValue(current);
      if (step >= steps) {
        setDisplayValue(target);
        if (animRef.current) clearInterval(animRef.current);
      }
    }, duration / steps);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [value, loading]);

  if (loading) {
    return <div className="skeleton" style={{ height: 36, width: 80, borderRadius: 8 }} />;
  }
  if (value === null) {
    return <span style={{ fontSize: 28, fontWeight: 800, color: '#52525B', fontFamily: "'JetBrains Mono', monospace" }}>—</span>;
  }
  return (
    <span style={{ fontSize: 28, fontWeight: 800, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.04em' }}>
      {displayValue.toLocaleString()}
    </span>
  );
}

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Base', chainId: 8453, result: null, loading: true },
    { name: 'Avalanche', chainId: 43114, result: null, loading: true },
  ]);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationAddress, setRegistrationAddress] = useState<string | null>(null);
  const [regChains, setRegChains] = useState<SupportedChain[]>([]);
  const [agentCounts, setAgentCounts] = useState<{ base: number | null; avalanche: number | null }>({ base: null, avalanche: null });
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
        { name: 'Base', chainId: 8453, result: results.base, loading: false },
        { name: 'Avalanche', chainId: 43114, result: results.avalanche, loading: false },
      ]);
    });
    // Fetch live agent counts from on-chain
    setAgentCountLoading(true);
    Promise.all([
      getAgentCount('base'),
      getAgentCount('avalanche'),
    ]).then(([baseCount, avaxCount]) => {
      setAgentCounts({ base: baseCount, avalanche: avaxCount });
      setAgentCountLoading(false);
    }).catch(() => {
      setAgentCountLoading(false);
    });
  }, []);

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);
  const totalAgents = (agentCounts.base ?? 0) + (agentCounts.avalanche ?? 0);

  const features = [
    {
      icon: <BrainIcon />,
      title: 'Ethical AI Companion',
      desc: 'Embris learns, remembers, and grows with you — guided by morals, not metrics.',
      color: '#A78BFA',
    },
    {
      icon: <ShieldIcon />,
      title: 'On-Chain Trust',
      desc: `${totalContracts} verified smart contracts enforce transparency and accountability.`,
      color: '#22C55E',
    },
    {
      icon: <WalletIcon />,
      title: 'Vaultfire Wallet',
      desc: 'Multi-chain wallet for ETH, AVAX, and ERC-20 tokens. Your keys, your crypto.',
      color: '#F97316',
    },
    {
      icon: <HeartIcon />,
      title: 'Flourishing Metrics',
      desc: 'AI success is measured by human flourishing, not engagement or profit.',
      color: '#F43F5E',
    },
    {
      icon: <GlobeIcon />,
      title: 'Cross-Chain Bridge',
      desc: 'Teleporter bridge connects Base and Avalanche for seamless asset movement.',
      color: '#38BDF8',
    },
    {
      icon: <UsersIcon />,
      title: 'VNS Identity',
      desc: 'Register a human-readable name for your wallet. You are more than an address.',
      color: '#FBBF24',
    },
  ];

  const px = isMobile ? '20px' : '32px';

  return (
    <div className="page-enter" style={{ padding: `${isMobile ? 28 : 40}px ${px} 48px` }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — Protocol intro
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 20,
          backgroundColor: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.15)',
          marginBottom: 20,
        }}>
          <FireIcon size={12} />
          <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, letterSpacing: '0.04em' }}>VAULTFIRE PROTOCOL</span>
        </div>
        <h1 style={{
          fontSize: isMobile ? 32 : 44, fontWeight: 800, color: '#F4F4F5',
          letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16,
        }}>
          Trust infrastructure<br />for the AI age
        </h1>
        <p style={{
          fontSize: isMobile ? 14 : 16, color: '#71717A', lineHeight: 1.7,
          maxWidth: 480, margin: '0 auto 24px',
        }}>
          {totalContracts} smart contracts across Base and Avalanche enforce ethical AI behavior, protect privacy, and give users real control.
        </p>

        {/* Registration status pill */}
        {registered && registrationAddress && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 20,
            backgroundColor: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.15)',
          }}>
            <div style={{ color: '#22C55E' }}><CheckCircleIcon size={14} /></div>
            <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Registered on Vaultfire</span>
            <span style={{ fontSize: 11, color: '#71717A', fontFamily: "'JetBrains Mono', monospace" }}>
              {registrationAddress.slice(0, 6)}...{registrationAddress.slice(-4)}
            </span>
            {regChains.map((c) => {
              const cfg = getChainConfig(c);
              return (
                <span key={c} style={{
                  fontSize: 10, color: cfg.color,
                  backgroundColor: `${cfg.color}10`,
                  padding: '2px 6px', borderRadius: 4,
                  fontWeight: 600, letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}>{cfg.name}</span>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE REGISTRATION COUNTER — Real on-chain data
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live Registry
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span style={{ fontSize: 11, color: '#52525B', fontWeight: 500 }}>On-chain · ERC-8004</span>
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {/* Total Agents */}
          <div style={{
            padding: isMobile ? '20px 16px' : '24px 20px',
            backgroundColor: 'rgba(249,115,22,0.04)',
            border: '1px solid rgba(249,115,22,0.12)',
            borderRadius: 16,
            gridColumn: isMobile ? '1 / -1' : 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ color: '#F97316' }}><UsersIcon size={16} /></div>
              <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Registered Agents</p>
            </div>
            <AnimatedCounter value={agentCountLoading ? null : totalAgents} loading={agentCountLoading} />
            <p style={{ fontSize: 11, color: '#52525B', marginTop: 6 }}>Across Base + Avalanche</p>
          </div>

          {/* Base count */}
          <div style={{
            padding: isMobile ? '16px 14px' : '20px 16px',
            backgroundColor: 'rgba(0,82,255,0.04)',
            border: '1px solid rgba(0,82,255,0.12)',
            borderRadius: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0052FF' }} />
              <p style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Base</p>
            </div>
            <AnimatedCounter value={agentCountLoading ? null : agentCounts.base} loading={agentCountLoading} />
            <p style={{ fontSize: 10, color: '#52525B', marginTop: 4 }}>Chain ID 8453</p>
          </div>

          {/* Avalanche count */}
          <div style={{
            padding: isMobile ? '16px 14px' : '20px 16px',
            backgroundColor: 'rgba(232,65,66,0.04)',
            border: '1px solid rgba(232,65,66,0.12)',
            borderRadius: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E84142' }} />
              <p style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avalanche</p>
            </div>
            <AnimatedCounter value={agentCountLoading ? null : agentCounts.avalanche} loading={agentCountLoading} />
            <p style={{ fontSize: 10, color: '#52525B', marginTop: 4 }}>Chain ID 43114</p>
          </div>
        </div>

        {/* ERC8004IdentityRegistry link */}
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://basescan.org/address/0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: '#52525B',
              textDecoration: 'none',
              padding: '4px 10px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 6,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
          >
            <ExternalLinkIcon size={10} /> ERC8004IdentityRegistry on Base
          </a>
          <a
            href="https://snowtrace.io/address/0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: '#52525B',
              textDecoration: 'none',
              padding: '4px 10px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 6,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
          >
            <ExternalLinkIcon size={10} /> ERC8004IdentityRegistry on Avalanche
          </a>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NETWORK STATUS — Live chain connectivity
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
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
              padding: isMobile ? '14px 16px' : '16px 20px',
              borderBottom: i < chains.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: chain.loading ? '#52525B' : chain.result?.success ? '#22C55E' : '#EF4444',
                  boxShadow: !chain.loading && chain.result?.success ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F4F4F5' }}>{chain.name}</span>
                <span style={{ fontSize: 11, color: '#3F3F46', fontFamily: "'JetBrains Mono', monospace" }}>
                  {chain.chainId}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 28 }}>
                {!chain.loading && chain.result?.success && (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 12, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                        {chain.result.blockNumber?.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 9, color: '#3F3F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>block</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 12, color: '#A1A1AA', fontFamily: "'JetBrains Mono', monospace" }}>
                        {chain.result.latency}ms
                      </p>
                      <p style={{ fontSize: 9, color: '#3F3F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>latency</p>
                    </div>
                  </>
                )}
                {chain.loading && <span style={{ fontSize: 12, color: '#3F3F46' }}>connecting...</span>}
                {!chain.loading && !chain.result?.success && <span style={{ fontSize: 12, color: '#EF4444' }}>error</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES — What Vaultfire offers
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Features</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 10,
        }}>
          {features.map((f) => (
            <div key={f.title} style={{
              padding: '18px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 14,
              transition: 'all 0.15s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: `${f.color}10`,
                  border: `1px solid ${f.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: f.color, flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.01em' }}>{f.title}</h3>
              </div>
              <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.55, letterSpacing: '-0.005em' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PROTOCOL STATS — Real on-chain numbers
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Protocol</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 12,
        }}>
          {[
            { label: 'Contracts', value: String(totalContracts), sub: `${BASE_CONTRACTS.length} per chain`, mono: true, color: '#F97316' },
            { label: 'Chains', value: '2', sub: 'Base + Avalanche', mono: true, color: '#38BDF8' },
            { label: 'Standard', value: 'ERC-8004', sub: 'AI Identity', mono: false, color: '#A78BFA' },
            { label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain', mono: false, color: '#22C55E' },
          ].map((item) => (
            <div key={item.label} style={{
              padding: isMobile ? '16px 14px' : '18px 16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
            }}>
              <p style={{ fontSize: 10, color: '#52525B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{item.label}</p>
              <p style={{
                fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#F4F4F5',
                letterSpacing: '-0.03em', lineHeight: 1.1,
                fontFamily: item.mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
              }}>{item.value}</p>
              <p style={{ fontSize: 11, color: '#3F3F46', marginTop: 4 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PRINCIPLES — Core values
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 40 : 56 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Core Principles</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { principle: 'Morals over metrics', desc: 'AI behavior guided by ethical principles, not engagement optimization.', icon: <HeartIcon size={14} />, color: '#F43F5E' },
            { principle: 'Privacy over surveillance', desc: 'Cryptographic guarantees protect every interaction from unauthorized monitoring.', icon: <ShieldIcon size={14} />, color: '#22C55E' },
            { principle: 'Freedom over control', desc: 'Users own their data, their keys, and their relationship with AI.', icon: <ZapIcon size={14} />, color: '#F97316' },
          ].map((item, i) => (
            <div key={item.principle} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '18px 0',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                backgroundColor: `${item.color}10`,
                border: `1px solid ${item.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: item.color, marginTop: 2,
              }}>
                {item.icon}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.01em', marginBottom: 4 }}>{item.principle}</p>
                <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        textAlign: 'center',
        paddingTop: 32,
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            backgroundColor: 'rgba(249,115,22,0.06)',
            border: '1px solid rgba(249,115,22,0.12)',
          }}>
            <FireIcon size={12} />
            <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, letterSpacing: '0.02em' }}>Powered by Vaultfire Protocol</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#3F3F46', lineHeight: 1.6 }}>
          {totalContracts} smart contracts across Base and Avalanche.
          <br />
          All governance is on-chain and verifiable.
        </p>
        <p style={{ fontSize: 11, color: '#27272A', marginTop: 12, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Vaultfire Protocol &middot; 2025
        </p>
      </div>
    </div>
  );
}
