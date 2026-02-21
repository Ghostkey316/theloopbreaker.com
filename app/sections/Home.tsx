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

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);

  return (
    <div style={{ padding: isMobile ? '32px 20px 48px' : '56px 48px', maxWidth: 680, margin: '0 auto' }}>

      {/* ── Embris Hero ── */}
      <div style={{ marginBottom: isMobile ? 48 : 64 }}>
        {/* Flame icon */}
        <div style={{ marginBottom: isMobile ? 20 : 24 }}>
          <svg width={isMobile ? 36 : 40} height={isMobile ? 36 : 40} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.85" />
            <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
            <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.7" />
          </svg>
        </div>

        {/* Wordmark */}
        <h1 style={{
          fontSize: isMobile ? 40 : 56,
          fontWeight: 700,
          color: '#F4F4F5',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          marginBottom: isMobile ? 10 : 12,
        }}>
          Embris
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: isMobile ? 16 : 18,
          color: '#71717A',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.5,
          marginBottom: 8,
        }}>
          Your ethical AI companion
        </p>

        {/* Powered by */}
        <p style={{
          fontSize: 12,
          color: '#3F3F46',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}>
          Powered by Vaultfire Protocol
        </p>
      </div>

      {/* ── Network Status ── */}
      <div style={{ marginBottom: isMobile ? 40 : 48 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 500, color: '#52525B',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Network Status</h2>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: anyLoading ? '#EAB308' : allConnected ? '#22C55E' : '#EF4444',
          }}>
            {anyLoading ? 'Checking...' : allConnected ? 'All systems operational' : 'Degraded'}
          </span>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {chains.map((chain, i) => (
            <div key={chain.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: isMobile ? '14px 16px' : '14px 20px',
              backgroundColor: '#111113',
              borderBottom: i < chains.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: chain.loading ? '#EAB308' : chain.result?.success ? '#22C55E' : '#EF4444',
                }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#F4F4F5' }}>{chain.name}</span>
                  <span style={{ fontSize: 12, color: '#52525B', marginLeft: 8 }}>
                    {chain.chainId}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 24 }}>
                {!chain.loading && chain.result?.success && (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 12, color: '#F4F4F5',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 500,
                      }}>
                        {chain.result.blockNumber?.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: '#3F3F46' }}>block</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 12, color: '#A1A1AA',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {chain.result.latency}ms
                      </p>
                      <p style={{ fontSize: 10, color: '#3F3F46' }}>latency</p>
                    </div>
                  </>
                )}
                {chain.loading && (
                  <span style={{ fontSize: 12, color: '#52525B' }}>connecting...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div style={{ marginBottom: isMobile ? 40 : 48 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 500, color: '#52525B',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 16,
        }}>Protocol Overview</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 1,
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {[
            { label: 'Contracts', value: String(totalContracts), sub: `${BASE_CONTRACTS.length} per chain` },
            { label: 'Chains', value: '2', sub: 'Base + Avalanche' },
            { label: 'Standard', value: 'ERC-8004', sub: 'AI Identity' },
            { label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain' },
          ].map((item) => (
            <div key={item.label} style={{
              padding: isMobile ? '16px 14px' : '20px 16px',
              backgroundColor: '#111113',
            }}>
              <p style={{
                fontSize: isMobile ? 20 : 22, fontWeight: 600, color: '#F4F4F5',
                letterSpacing: '-0.02em', marginBottom: 2, lineHeight: 1.2,
                fontFamily: item.label === 'Standard' || item.label === 'Bridge' ? "'Inter', sans-serif" : "'JetBrains Mono', monospace",
              }}>{item.value}</p>
              <p style={{ fontSize: 12, color: '#71717A', fontWeight: 400 }}>{item.label}</p>
              <p style={{ fontSize: 11, color: '#3F3F46', marginTop: 2 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── About Embris ── */}
      <div>
        <h2 style={{
          fontSize: 11, fontWeight: 500, color: '#52525B',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 16,
        }}>About</h2>

        <div style={{
          fontSize: 14, color: '#A1A1AA', lineHeight: 1.75,
          letterSpacing: '-0.01em',
        }}>
          <p style={{ marginBottom: 16 }}>
            Embris is an ethical AI companion built on Vaultfire Protocol&apos;s decentralized trust infrastructure.
            It operates on three core principles: <span style={{ color: '#F4F4F5', fontWeight: 500 }}>morals over metrics</span>,{' '}
            <span style={{ color: '#F4F4F5', fontWeight: 500 }}>privacy over surveillance</span>, and{' '}
            <span style={{ color: '#F4F4F5', fontWeight: 500 }}>freedom over control</span>.
          </p>
          <p>
            The protocol manages {totalContracts} smart contracts across Base and Avalanche networks,
            connected via the Teleporter bridge for cross-chain communication. All governance
            is on-chain and verifiable.
          </p>
        </div>
      </div>
    </div>
  );
}
