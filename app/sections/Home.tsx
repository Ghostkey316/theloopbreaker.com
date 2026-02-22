'use client';
import { useEffect, useState } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from '../lib/contracts';
import { isRegistered, getRegistration, getRegisteredChains, getChainConfig, type SupportedChain } from '../lib/registration';

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
function LinkIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>);
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

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Base', chainId: 8453, result: null, loading: true },
    { name: 'Avalanche', chainId: 43114, result: null, loading: true },
  ]);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationAddress, setRegistrationAddress] = useState<string | null>(null);
  const [regChains, setRegChains] = useState<SupportedChain[]>([]);

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
  }, []);

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);

  const features = [
    {
      icon: <BrainIcon />,
      title: 'Ethical AI Companion',
      desc: 'Embris learns, remembers, and grows with you — guided by morals, not metrics.',
    },
    {
      icon: <ShieldIcon />,
      title: 'On-Chain Trust',
      desc: `${totalContracts} verified smart contracts enforce transparency and accountability.`,
    },
    {
      icon: <LinkIcon />,
      title: 'Multi-Chain',
      desc: 'Deployed on Base and Avalanche with Teleporter bridge for cross-chain communication.',
    },
    {
      icon: <WalletIcon />,
      title: 'Built-In Wallet',
      desc: 'Send, receive, and manage tokens across chains. Your keys, your crypto.',
    },
    {
      icon: <HeartIcon />,
      title: 'Privacy First',
      desc: 'Anti-surveillance contracts and cryptographic privacy guarantees protect every interaction.',
    },
    {
      icon: <GlobeIcon />,
      title: 'Open Standard',
      desc: 'Built on ERC-8004 — the standard for AI identity, reputation, and validation on-chain.',
    },
  ];

  return (
    <div className="page-enter" style={{ padding: isMobile ? '40px 20px 64px' : '64px 48px', maxWidth: 720, margin: '0 auto' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 72 : 96, textAlign: 'center' }}>
        {/* Flame */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
            border: '1px solid rgba(249,115,22,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={28} height={28} viewBox="0 0 32 32" fill="none">
              <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
              <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: isMobile ? 44 : 56,
          fontWeight: 700,
          color: '#F4F4F5',
          letterSpacing: '-0.045em',
          lineHeight: 1.0,
          marginBottom: 20,
        }}>
          Embris
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: isMobile ? 18 : 22,
          color: '#E4E4E7',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1.4,
          marginBottom: 12,
          maxWidth: 520,
          margin: '0 auto 12px',
        }}>
          Making human thriving more profitable than extraction.
        </p>

        {/* Subtitle */}
        <p style={{
          fontSize: isMobile ? 14 : 15,
          color: '#71717A',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.5,
          marginBottom: 20,
          maxWidth: 440,
          margin: '0 auto 20px',
        }}>
          Your ethical AI companion — built on Vaultfire Protocol&apos;s decentralized trust infrastructure.
        </p>

        {/* Protocol badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px',
          backgroundColor: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.12)',
          borderRadius: 20,
        }}>
          <svg width={12} height={12} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.8" />
          </svg>
          <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Powered by Vaultfire Protocol
          </span>
        </div>

        {/* Registration status */}
        {registered && registrationAddress && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 16,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              backgroundColor: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.12)',
              borderRadius: 20,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span style={{ fontSize: 11, color: '#A1A1AA', fontFamily: "'JetBrains Mono', monospace" }}>
                {registrationAddress.slice(0, 6)}...{registrationAddress.slice(-4)}
              </span>
              {regChains.map((c) => {
                const cfg = getChainConfig(c);
                return (
                  <span key={c} style={{
                    fontSize: 10, color: cfg.color,
                    backgroundColor: `${cfg.color}10`,
                    padding: '1px 5px', borderRadius: 3,
                    fontWeight: 500, letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}>{cfg.name}</span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NETWORK STATUS — Live chain connectivity
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 56 : 72 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: '#71717A',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Network Status</h2>
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
          borderRadius: 12,
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
                  boxShadow: !chain.loading && chain.result?.success ? '0 0 8px rgba(34,197,94,0.3)' : 'none',
                }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#F4F4F5' }}>{chain.name}</span>
                <span style={{ fontSize: 11, color: '#3F3F46', fontFamily: "'JetBrains Mono', monospace" }}>
                  {chain.chainId}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 28 }}>
                {!chain.loading && chain.result?.success && (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 12, color: '#F4F4F5',
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                      }}>
                        {chain.result.blockNumber?.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 9, color: '#3F3F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>block</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 12, color: '#A1A1AA',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {chain.result.latency}ms
                      </p>
                      <p style={{ fontSize: 9, color: '#3F3F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>latency</p>
                    </div>
                  </>
                )}
                {chain.loading && (
                  <span style={{ fontSize: 12, color: '#3F3F46' }}>connecting...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES — What Embris offers
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 56 : 72 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: '#71717A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 20,
        }}>Features</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {features.map((f) => (
            <div key={f.title} style={{
              padding: isMobile ? '18px 16px' : '20px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
            >
              <div style={{ color: '#71717A', marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{
                fontSize: 14, fontWeight: 600, color: '#F4F4F5',
                letterSpacing: '-0.01em', marginBottom: 6,
              }}>{f.title}</h3>
              <p style={{
                fontSize: 13, color: '#71717A', lineHeight: 1.5,
                letterSpacing: '-0.005em',
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PROTOCOL STATS — Real on-chain numbers
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 56 : 72 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: '#71717A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 20,
        }}>Protocol</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 12 : 16,
        }}>
          {[
            { label: 'Contracts', value: String(totalContracts), sub: `${BASE_CONTRACTS.length} per chain`, mono: true },
            { label: 'Chains', value: '2', sub: 'Base + Avalanche', mono: true },
            { label: 'Standard', value: 'ERC-8004', sub: 'AI Identity', mono: false },
            { label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain', mono: false },
          ].map((item) => (
            <div key={item.label} style={{
              padding: isMobile ? '16px 14px' : '18px 16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
            }}>
              <p style={{
                fontSize: 10, color: '#52525B', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8,
              }}>{item.label}</p>
              <p style={{
                fontSize: isMobile ? 20 : 24, fontWeight: 600, color: '#F4F4F5',
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
      <div style={{ marginBottom: isMobile ? 56 : 72 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: '#71717A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 20,
        }}>Core Principles</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { principle: 'Morals over metrics', desc: 'AI behavior guided by ethical principles, not engagement optimization.' },
            { principle: 'Privacy over surveillance', desc: 'Cryptographic guarantees protect every interaction from unauthorized monitoring.' },
            { principle: 'Freedom over control', desc: 'Users own their data, their keys, and their relationship with AI.' },
          ].map((item, i) => (
            <div key={item.principle} style={{
              padding: '18px 0',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <p style={{
                fontSize: 15, fontWeight: 600, color: '#F4F4F5',
                letterSpacing: '-0.01em', marginBottom: 4,
              }}>{item.principle}</p>
              <p style={{
                fontSize: 13, color: '#71717A', lineHeight: 1.5,
              }}>{item.desc}</p>
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
        <p style={{
          fontSize: 12, color: '#3F3F46', lineHeight: 1.6,
        }}>
          {totalContracts} smart contracts across Base and Avalanche.
          <br />
          All governance is on-chain and verifiable.
        </p>
        <p style={{
          fontSize: 11, color: '#27272A', marginTop: 12,
          fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Vaultfire Protocol &middot; 2025
        </p>
      </div>
    </div>
  );
}
