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

  return (
    <div style={{ padding: isMobile ? '16px 16px 32px' : 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 12 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ECEDEE', marginBottom: 4 }}>Protocol Dashboard</h1>
          <p style={{ fontSize: 13, color: '#9BA1A6' }}>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{
            padding: '10px 18px',
            backgroundColor: loading ? '#2A2A2E' : '#FF6B35',
            border: 'none',
            borderRadius: 10,
            color: loading ? '#9BA1A6' : '#0A0A0C',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            alignSelf: isMobile ? 'stretch' : 'auto',
          }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: isMobile ? 8 : 12,
        marginBottom: 24,
      }}>
        {[
          { label: 'Health Score', value: healthScore !== null ? `${healthScore}%` : '—', color: healthScore !== null ? (healthScore >= 90 ? '#22C55E' : healthScore >= 70 ? '#F59E0B' : '#EF4444') : '#9BA1A6', icon: '💚' },
          { label: 'Contracts Live', value: `${aliveCount} / ${totalChecked || ALL_CONTRACTS.length}`, color: '#22C55E', icon: '✅' },
          { label: 'Base Block', value: chainStatus.base?.blockNumber?.toLocaleString() || '—', color: '#00D9FF', icon: '⛓️' },
          { label: 'Avalanche Block', value: chainStatus.avalanche?.blockNumber?.toLocaleString() || '—', color: '#E84142', icon: '🔺' },
          { label: 'Base Latency', value: chainStatus.base?.latency ? `${chainStatus.base.latency}ms` : '—', color: '#9BA1A6', icon: '⚡' },
          { label: 'Avax Latency', value: chainStatus.avalanche?.latency ? `${chainStatus.avalanche.latency}ms` : '—', color: '#9BA1A6', icon: '⚡' },
        ].map((card) => (
          <div key={card.label} style={{
            backgroundColor: '#1A1A1E',
            border: '1px solid #2A2A2E',
            borderRadius: 12,
            padding: isMobile ? '12px 12px' : '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: isMobile ? 14 : 16 }}>{card.icon}</span>
              <p style={{ fontSize: isMobile ? 10 : 11, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</p>
            </div>
            <p style={{
              fontSize: isMobile ? 15 : 18,
              fontWeight: 700,
              color: card.color,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{loading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Contract Lists */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
      }}>
        {[
          { title: 'Base Contracts', contracts: baseContracts, chain: 'base' as const },
          { title: 'Avalanche Contracts', contracts: avaxContracts, chain: 'avalanche' as const },
        ].map(({ title, contracts, chain }) => (
          <div key={chain} style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#ECEDEE' }}>{title}</h2>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, backgroundColor: chain === 'base' ? '#00D9FF20' : '#E8414220', color: chain === 'base' ? '#00D9FF' : '#E84142' }}>
                {CHAINS[chain].chainId}
              </span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {contracts.map((contract) => (
                <div key={contract.address} style={{
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 6 : 10,
                  padding: isMobile ? '12px 14px' : '10px 16px',
                  borderBottom: '1px solid #2A2A2E',
                }}>
                  {/* Status dot + Name row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    minWidth: 0,
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : '#3A3A3E',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#ECEDEE',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>{contract.name}</p>
                    </div>
                    {/* Explorer link - always visible */}
                    <a href={`${CHAINS[chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        color: '#9BA1A6',
                        textDecoration: 'none',
                        flexShrink: 0,
                        padding: '2px 6px',
                        backgroundColor: '#2A2A2E',
                        borderRadius: 4,
                      }}>↗</a>
                  </div>
                  {/* Address row on mobile */}
                  <p style={{
                    fontSize: 10,
                    color: '#9BA1A6',
                    fontFamily: 'monospace',
                    paddingLeft: isMobile ? 18 : 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {isMobile
                      ? `${contract.address.slice(0, 10)}...${contract.address.slice(-6)}`
                      : `${contract.address.slice(0, 10)}...${contract.address.slice(-6)}`}
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
