'use client';
import { useEffect, useState } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CORE_VALUES } from '../lib/contracts';

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
    { name: 'Base', chainId: 8453, color: '#00D9FF', result: null, loading: true, contractCount: BASE_CONTRACTS.length },
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
        { name: 'Base', chainId: 8453, color: '#00D9FF', result: results.base, loading: false, contractCount: BASE_CONTRACTS.length },
        { name: 'Avalanche', chainId: 43114, color: '#E84142', result: results.avalanche, loading: false, contractCount: AVALANCHE_CONTRACTS.length },
      ]);
    });
  }, []);

  const coreValues = CORE_VALUES.split('. ').filter(Boolean);

  return (
    <div style={{
      padding: isMobile ? '16px 16px 32px' : '32px',
      maxWidth: '56rem',
      margin: '0 auto',
    }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ fontSize: isMobile ? 40 : 60, marginBottom: isMobile ? 8 : 16 }}>🛡️🔥</div>
        <h1 style={{
          fontSize: isMobile ? 26 : 36,
          fontWeight: 700,
          color: '#ECEDEE',
          marginBottom: isMobile ? 8 : 12,
          lineHeight: 1.2,
        }}>Vaultfire Protocol</h1>
        <p style={{
          fontSize: isMobile ? 14 : 18,
          color: '#9BA1A6',
          maxWidth: '36rem',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Ethical AI governance on-chain. Powered by Ember AI.
        </p>
        <div style={{
          marginTop: isMobile ? 12 : 16,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 999,
          backgroundColor: '#1A1A1E',
          border: '1px solid #2A2A2E',
        }}>
          <span style={{ fontSize: isMobile ? 13 : 14, color: '#FF6B35', fontWeight: 500 }}>theloopbreaker.com</span>
        </div>
      </div>

      {/* Core Values */}
      <div style={{ marginBottom: isMobile ? 28 : 40 }}>
        <h2 style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Core Values</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {coreValues.map((value, i) => (
            <div key={i} style={{
              backgroundColor: '#1A1A1E',
              border: '1px solid #2A2A2E',
              borderRadius: 12,
              padding: isMobile ? '14px 16px' : 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isMobile ? 20 : 24, marginBottom: 8 }}>{['⚖️', '🔒', '🗽'][i]}</div>
              <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: '#ECEDEE' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Network Status */}
      <div style={{ marginBottom: isMobile ? 28 : 40 }}>
        <h2 style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Network Status</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? 12 : 16,
        }}>
          {chains.map((chain) => (
            <div key={chain.name} style={{
              backgroundColor: '#1A1A1E',
              border: '1px solid #2A2A2E',
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              borderLeftColor: chain.color,
              borderLeftWidth: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontWeight: 600, color: '#ECEDEE', fontSize: isMobile ? 15 : 16 }}>{chain.name}</h3>
                  <p style={{ fontSize: 12, color: '#9BA1A6' }}>Chain ID: {chain.chainId}</p>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: chain.loading ? '#F59E0B20' : chain.result?.success ? '#22C55E20' : '#EF444420',
                  color: chain.loading ? '#F59E0B' : chain.result?.success ? '#22C55E' : '#EF4444',
                  flexShrink: 0,
                }}>
                  {chain.loading ? 'Checking...' : chain.result?.success ? 'Connected' : 'Offline'}
                </span>
              </div>
              {!chain.loading && chain.result?.success && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  textAlign: 'center',
                }}>
                  <div style={{ backgroundColor: '#2A2A2E', borderRadius: 8, padding: isMobile ? '8px 4px' : '8px' }}>
                    <p style={{ fontSize: 10, color: '#9BA1A6', marginBottom: 2 }}>Block</p>
                    <p style={{ fontSize: isMobile ? 11 : 13, fontFamily: 'monospace', color: '#ECEDEE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chain.result.blockNumber?.toLocaleString()}</p>
                  </div>
                  <div style={{ backgroundColor: '#2A2A2E', borderRadius: 8, padding: isMobile ? '8px 4px' : '8px' }}>
                    <p style={{ fontSize: 10, color: '#9BA1A6', marginBottom: 2 }}>Latency</p>
                    <p style={{ fontSize: isMobile ? 11 : 13, fontFamily: 'monospace', color: '#ECEDEE' }}>{chain.result.latency}ms</p>
                  </div>
                  <div style={{ backgroundColor: '#2A2A2E', borderRadius: 8, padding: isMobile ? '8px 4px' : '8px' }}>
                    <p style={{ fontSize: 10, color: '#9BA1A6', marginBottom: 2 }}>Contracts</p>
                    <p style={{ fontSize: isMobile ? 11 : 13, fontFamily: 'monospace', color: '#FF6B35' }}>{chain.contractCount}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Protocol Overview */}
      <div>
        <h2 style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Protocol Overview</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 8 : 12,
        }}>
          {[
            { icon: '🔗', label: 'Contracts', value: '28', sub: '14 per chain' },
            { icon: '⛓️', label: 'Chains', value: '2', sub: 'Base + Avalanche' },
            { icon: '🤖', label: 'Standard', value: 'ERC-8004', sub: 'AI Identity' },
            { icon: '🌉', label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain' },
          ].map((item) => (
            <div key={item.label} style={{
              backgroundColor: '#1A1A1E',
              border: '1px solid #2A2A2E',
              borderRadius: 12,
              padding: isMobile ? '14px 10px' : 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isMobile ? 20 : 24, marginBottom: 4 }}>{item.icon}</div>
              <p style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#FF6B35' }}>{item.value}</p>
              <p style={{ fontSize: isMobile ? 11 : 12, fontWeight: 500, color: '#ECEDEE' }}>{item.label}</p>
              <p style={{ fontSize: isMobile ? 10 : 11, color: '#9BA1A6' }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
