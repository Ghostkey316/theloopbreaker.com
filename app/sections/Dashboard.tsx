'use client';
import { useEffect, useState } from 'react';
import { ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from '../lib/contracts';
import { checkAllChains, getMultipleContractStatus, type RPCResult } from '../lib/blockchain';

interface ContractWithStatus {
  name: string;
  address: string;
  chain: 'base' | 'avalanche';
  chainId: number;
  alive: boolean | null;
}

// SVG Icons
function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ExternalIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function Dashboard() {
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});
  const [contractStatus, setContractStatus] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [chains, baseStatus, avaxStatus] = await Promise.all([
      checkAllChains(),
      getMultipleContractStatus('base', BASE_CONTRACTS.map((c) => c.address)),
      getMultipleContractStatus('avalanche', AVALANCHE_CONTRACTS.map((c) => c.address)),
    ]);
    setChainStatus(chains);
    setContractStatus({ ...baseStatus, ...avaxStatus });
    setLastUpdated(new Date());
    setLoading(false);
  };

  const contractsWithStatus: ContractWithStatus[] = ALL_CONTRACTS.map((c) => ({
    ...c,
    alive: contractStatus[c.address] ?? null,
  }));

  const baseContracts = contractsWithStatus.filter((c) => c.chain === 'base');
  const avaxContracts = contractsWithStatus.filter((c) => c.chain === 'avalanche');
  const aliveCount = Object.values(contractStatus).filter(Boolean).length;
  const totalChecked = Object.keys(contractStatus).length;
  const healthScore = totalChecked > 0 ? Math.round((aliveCount / totalChecked) * 100) : null;

  const statCards = [
    { label: 'Health Score', value: healthScore !== null ? `${healthScore}%` : '—', color: healthScore !== null ? (healthScore >= 90 ? '#22C55E' : healthScore >= 70 ? '#F59E0B' : '#EF4444') : '#666670' },
    { label: 'Contracts Live', value: `${aliveCount}/${totalChecked || ALL_CONTRACTS.length}`, color: '#22C55E' },
    { label: 'Base Block', value: chainStatus.base?.blockNumber?.toLocaleString() || '—', color: '#00D9FF' },
    { label: 'Avax Block', value: chainStatus.avalanche?.blockNumber?.toLocaleString() || '—', color: '#E84142' },
    { label: 'Base Latency', value: chainStatus.base?.latency ? `${chainStatus.base.latency}ms` : '—', color: '#A0A0A8' },
    { label: 'Avax Latency', value: chainStatus.avalanche?.latency ? `${chainStatus.avalanche.latency}ms` : '—', color: '#A0A0A8' },
  ];

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 14 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: '#FFFFFF', marginBottom: 4, letterSpacing: '-0.03em' }}>Protocol Dashboard</h1>
          <p style={{ fontSize: 13, color: '#666670' }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            backgroundColor: loading ? 'rgba(255,255,255,0.04)' : '#F97316',
            border: 'none',
            borderRadius: 8,
            color: loading ? '#666670' : '#0A0A0C',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            alignSelf: isMobile ? 'stretch' : 'auto',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}>
          <RefreshIcon size={13} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 28,
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: isMobile ? '12px 12px' : '14px 16px',
            transition: 'all 0.2s ease',
          }}>
            <p style={{ fontSize: 10, color: '#666670', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 500 }}>{card.label}</p>
            <p style={{
              fontSize: isMobile ? 16 : 20,
              fontWeight: 700,
              color: card.color,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
            }}>{loading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Contract Lists */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {[
          { title: 'Base Contracts', contracts: baseContracts, chain: 'base' as const, color: '#00D9FF' },
          { title: 'Avalanche Contracts', contracts: avaxContracts, chain: 'avalanche' as const, color: '#E84142' },
        ].map(({ title, contracts, chain, color }) => (
          <div key={chain} style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '13px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 6px ${color}40` }} />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{title}</h2>
              </div>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 20,
                backgroundColor: `${color}10`,
                color: color,
                fontWeight: 500,
                fontFamily: "'SF Mono', monospace",
              }}>
                {CHAINS[chain].chainId}
              </span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {contracts.map((contract, idx) => (
                <div key={contract.address} style={{
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 4 : 10,
                  padding: isMobile ? '10px 14px' : '9px 16px',
                  borderBottom: idx < contracts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background-color 0.15s ease',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    minWidth: 0,
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : '#3A3A3E',
                      boxShadow: contract.alive === true ? '0 0 6px rgba(34,197,94,0.3)' : 'none',
                    }} />
                    <p style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                      minWidth: 0,
                      letterSpacing: '-0.01em',
                    }}>{contract.name}</p>
                    <a href={`${CHAINS[chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: '3px 6px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        color: '#666670',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}>
                      <ExternalIcon size={10} />
                    </a>
                  </div>
                  <p style={{
                    fontSize: 10,
                    color: '#666670',
                    fontFamily: "'SF Mono', monospace",
                    paddingLeft: isMobile ? 14 : 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {`${contract.address.slice(0, 10)}...${contract.address.slice(-6)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
