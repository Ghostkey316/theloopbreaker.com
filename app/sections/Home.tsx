'use client';
import { useEffect, useState } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from '../lib/contracts';

interface ChainStatus {
  name: string;
  chainId: number;
  color: string;
  result: RPCResult | null;
  loading: boolean;
  contractCount: number;
}

/* ── SVG Icons ── */
function ScaleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M5 7l7-4 7 4" /><path d="M2 14l3-7 3 7" /><path d="M16 14l3-7 3 7" /><path d="M2 14h6" /><path d="M16 14h6" />
    </svg>
  );
}

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><circle cx="12" cy="15" r="0.5" fill="#F97316" />
    </svg>
  );
}

function FreedomIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><line x1="12" y1="2" x2="12" y2="4" />
    </svg>
  );
}

function ContractIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ChainIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CpuIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function BridgeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /><line x1="7" y1="12" x2="17" y2="12" /><polyline points="14 9 17 12 14 15" />
    </svg>
  );
}

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Base', chainId: 8453, color: '#0EA5E9', result: null, loading: true, contractCount: BASE_CONTRACTS.length },
    { name: 'Avalanche', chainId: 43114, color: '#E84142', result: null, loading: true, contractCount: AVALANCHE_CONTRACTS.length },
  ]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    checkAllChains().then((results) => {
      setChains([
        { name: 'Base', chainId: 8453, color: '#0EA5E9', result: results.base, loading: false, contractCount: BASE_CONTRACTS.length },
        { name: 'Avalanche', chainId: 43114, color: '#E84142', result: results.avalanche, loading: false, contractCount: AVALANCHE_CONTRACTS.length },
      ]);
    });
  }, []);

  const coreValueIcons = [ScaleIcon, ShieldIcon, FreedomIcon];
  const coreValueTitles = ['Morals', 'Privacy', 'Freedom'];
  const coreValueDescriptions = ['Morals over metrics', 'Privacy over surveillance', 'Freedom over control'];

  return (
    <div style={{ padding: isMobile ? '24px 20px 48px' : '48px 40px', maxWidth: '54rem', margin: '0 auto' }}>
      {/* ── Hero Section ── */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 56, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? 200 : 300, height: isMobile ? 200 : 300,
          background: 'radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: isMobile ? 56 : 64, height: isMobile ? 56 : 64,
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
          border: '1px solid rgba(249,115,22,0.15)',
          marginBottom: isMobile ? 16 : 20, position: 'relative',
          boxShadow: '0 8px 32px rgba(249,115,22,0.06)',
        }}>
          <svg width={isMobile ? 26 : 30} height={isMobile ? 26 : 30} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="#F97316" strokeWidth="1.2" />
            <path d="M12 5c-2 2.5-4 5.5-4 8 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.5-2-5.5-4-8z" fill="#F97316" opacity="0.7" />
            <path d="M12 8c-1 1.5-2 3.2-2 4.5 0 1.1.9 2 2 2s2-.9 2-2c0-1.3-1-3-2-4.5z" fill="#FB923C" />
          </svg>
        </div>

        <h1 style={{
          fontSize: isMobile ? 30 : 40, fontWeight: 700, color: '#FAFAFA',
          marginBottom: isMobile ? 8 : 12, lineHeight: 1.1, letterSpacing: '-0.035em',
        }}>Vaultfire Protocol</h1>

        <p style={{
          fontSize: isMobile ? 15 : 17, color: '#A1A1AA',
          maxWidth: '28rem', margin: '0 auto', lineHeight: 1.6,
          fontWeight: 400, letterSpacing: '-0.01em',
        }}>
          Ethical AI governance on-chain.{' '}
          <span style={{ color: '#F97316', fontWeight: 500 }}>Powered by Ember AI.</span>
        </p>

        <a href="https://theloopbreaker.com" target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: isMobile ? 16 : 20, padding: '8px 16px',
            borderRadius: 8, backgroundColor: 'transparent',
            border: '1px solid rgba(249,115,22,0.15)',
            color: '#F97316', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.2s ease', letterSpacing: '-0.01em',
          }}>
          <span>theloopbreaker.com</span>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* ── Core Values ── */}
      <div style={{ marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Core Values</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {coreValueDescriptions.map((desc, i) => {
            const IconComp = coreValueIcons[i];
            return (
              <div key={i} className="card-hover-effect" style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 16,
                background: '#0F0F12',
                border: '1px solid rgba(255,255,255,0.04)',
                borderLeft: '3px solid #F97316',
                borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(249,115,22,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <IconComp size={18} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#FAFAFA', marginBottom: 2, letterSpacing: '-0.01em' }}>{coreValueTitles[i]}</p>
                  <p style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 400, lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Network Status ── */}
      <div style={{ marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Network Status</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
          {chains.map((chain) => (
            <div key={chain.name} className="card-hover-effect" style={{
              background: '#0F0F12',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 12, padding: isMobile ? '16px' : '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: chain.color, boxShadow: `0 0 8px ${chain.color}40`,
                  }} />
                  <div>
                    <h3 style={{ fontWeight: 600, color: '#FAFAFA', fontSize: 15, letterSpacing: '-0.015em' }}>{chain.name}</h3>
                    <p style={{ fontSize: 11, color: '#52525B', fontWeight: 400 }}>Chain {chain.chainId}</p>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100,
                  backgroundColor: chain.loading ? 'rgba(234,179,8,0.08)' : chain.result?.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  color: chain.loading ? '#EAB308' : chain.result?.success ? '#22C55E' : '#EF4444',
                  flexShrink: 0,
                }}>
                  {chain.loading ? 'Checking' : chain.result?.success ? 'Connected' : 'Offline'}
                </span>
              </div>
              {!chain.loading && chain.result?.success && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Block', value: chain.result.blockNumber?.toLocaleString(), color: '#FAFAFA' },
                    { label: 'Latency', value: `${chain.result.latency}ms`, color: '#FAFAFA' },
                    { label: 'Contracts', value: String(chain.contractCount), color: '#F97316' },
                  ].map((stat) => (
                    <div key={stat.label} style={{
                      backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8,
                      padding: isMobile ? '8px 6px' : '10px 12px', textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 10, color: '#52525B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{stat.label}</p>
                      <p style={{
                        fontSize: isMobile ? 12 : 13, fontFamily: "'JetBrains Mono', monospace",
                        color: stat.color, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Overview ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Protocol Overview</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12 }}>
          {[
            { Icon: ContractIcon, label: 'Contracts', value: '28', sub: '14 per chain', color: '#F97316' },
            { Icon: ChainIcon, label: 'Chains', value: '2', sub: 'Base + Avalanche', color: '#F97316' },
            { Icon: CpuIcon, label: 'Standard', value: 'ERC-8004', sub: 'AI Identity', color: '#F97316' },
            { Icon: BridgeIcon, label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain', color: '#F97316' },
          ].map((item) => (
            <div key={item.label} className="card-hover-effect" style={{
              background: '#0F0F12',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 12, padding: isMobile ? '16px 12px' : '20px 16px',
              textAlign: 'center',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(249,115,22,0.06)', marginBottom: 8, color: '#F97316',
              }}>
                <item.Icon size={16} />
              </div>
              <p style={{
                fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#F97316',
                letterSpacing: '-0.025em', marginBottom: 2, lineHeight: 1.2,
              }}>{item.value}</p>
              <p style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: '#FAFAFA', letterSpacing: '-0.01em' }}>{item.label}</p>
              <p style={{ fontSize: isMobile ? 11 : 12, color: '#52525B', marginTop: 2, fontWeight: 400 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
