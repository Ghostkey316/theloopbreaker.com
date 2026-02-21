'use client';
import { useState, useEffect } from 'react';
import { ALL_CONTRACTS, CHAINS } from '../lib/contracts';
import { checkContractAlive } from '../lib/blockchain';

interface ContractStatus {
  name: string;
  address: string;
  chain: 'base' | 'avalanche';
  chainId: number;
  alive: boolean | null;
  loading: boolean;
}

export default function Verify() {
  const [contracts, setContracts] = useState<ContractStatus[]>(
    ALL_CONTRACTS.map((c) => ({ ...c, alive: null, loading: false }))
  );
  const [filter, setFilter] = useState<'all' | 'base' | 'avalanche'>('all');
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const verifyAll = async () => {
    setVerifying(true);
    setProgress(0);
    setContracts((prev) => prev.map((c) => ({ ...c, alive: null, loading: true })));
    const total = ALL_CONTRACTS.length;
    let done = 0;
    await Promise.all(
      ALL_CONTRACTS.map(async (contract) => {
        const alive = await checkContractAlive(contract.chain, contract.address);
        done++;
        setProgress(Math.round((done / total) * 100));
        setContracts((prev) =>
          prev.map((c) =>
            c.address === contract.address && c.chain === contract.chain
              ? { ...c, alive, loading: false }
              : c
          )
        );
      })
    );
    setVerifying(false);
  };

  const filtered = contracts.filter((c) => {
    const matchChain = filter === 'all' || c.chain === filter;
    const matchSearch = searchQuery === '' || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchChain && matchSearch;
  });

  const aliveCount = contracts.filter((c) => c.alive === true).length;
  const deadCount = contracts.filter((c) => c.alive === false).length;
  const pendingCount = contracts.filter((c) => c.alive === null).length;

  return (
    <div style={{ padding: isMobile ? '16px 16px 32px' : 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ECEDEE', marginBottom: 8 }}>Trust Verification</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: '#9BA1A6' }}>Verify all 28 Vaultfire Protocol contracts are live on-chain.</p>
      </div>

      {/* Stats Grid - 2x2 on mobile, 4 cols on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 8 : 12,
        marginBottom: 24,
      }}>
        {[
          { label: 'Total', value: ALL_CONTRACTS.length, color: '#9BA1A6' },
          { label: 'Verified', value: aliveCount, color: '#22C55E' },
          { label: 'Failed', value: deadCount, color: '#EF4444' },
          { label: 'Pending', value: pendingCount, color: '#F59E0B' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            <p style={{ fontSize: isMobile ? 10 : 11, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {verifying && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#9BA1A6' }}>Verifying contracts...</span>
            <span style={{ fontSize: 12, color: '#FF6B35' }}>{progress}%</span>
          </div>
          <div style={{ height: 4, backgroundColor: '#2A2A2E', borderRadius: 2 }}>
            <div style={{ height: '100%', backgroundColor: '#FF6B35', borderRadius: 2, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Controls - stack vertically on mobile */}
      <div style={{
        display: 'flex',
        gap: isMobile ? 10 : 12,
        marginBottom: 20,
        flexDirection: isMobile ? 'column' : 'row',
        flexWrap: 'wrap',
      }}>
        <button onClick={verifyAll} disabled={verifying}
          style={{
            padding: '10px 20px',
            backgroundColor: verifying ? '#2A2A2E' : '#FF6B35',
            border: 'none',
            borderRadius: 10,
            color: verifying ? '#9BA1A6' : '#0A0A0C',
            fontSize: 14,
            fontWeight: 600,
            cursor: verifying ? 'default' : 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}>
          {verifying ? `Verifying... ${progress}%` : 'Verify All Contracts'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'base', 'avalanche'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: isMobile ? '8px 12px' : '8px 14px',
                backgroundColor: filter === f ? '#FF6B3520' : '#1A1A1E',
                border: `1px solid ${filter === f ? '#FF6B35' : '#2A2A2E'}`,
                borderRadius: 8,
                color: filter === f ? '#FF6B35' : '#9BA1A6',
                fontSize: 13,
                cursor: 'pointer',
                textTransform: 'capitalize',
                flex: isMobile ? 1 : 'none',
              }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contracts..."
          style={{
            flex: 1,
            minWidth: isMobile ? 'auto' : 160,
            padding: '8px 12px',
            backgroundColor: '#1A1A1E',
            border: '1px solid #2A2A2E',
            borderRadius: 8,
            color: '#ECEDEE',
            fontSize: 13,
            outline: 'none',
            width: isMobile ? '100%' : 'auto',
          }} />
      </div>

      {/* Contract Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((contract) => (
          <div key={`${contract.chain}-${contract.address}`}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? 10 : 12,
              padding: isMobile ? '14px 14px' : '12px 16px',
              backgroundColor: '#1A1A1E',
              border: '1px solid #2A2A2E',
              borderRadius: 10,
            }}>
            {/* Top row: status dot + name + chain badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: contract.loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : '#3A3A3E',
              }} />
              <p style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#ECEDEE',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}>{contract.name}</p>
              <span style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: contract.chain === 'base' ? '#00D9FF20' : '#E8414220',
                color: contract.chain === 'base' ? '#00D9FF' : '#E84142',
                fontWeight: 500,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {contract.chain === 'base' ? 'Base' : 'Avax'}
              </span>
            </div>

            {/* Address - truncated on mobile */}
            <p style={{
              fontSize: 11,
              color: '#9BA1A6',
              fontFamily: 'monospace',
              marginTop: isMobile ? 0 : 0,
              paddingLeft: isMobile ? 20 : 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {isMobile
                ? `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}`
                : contract.address}
            </p>

            {/* Buttons row */}
            <div style={{
              display: 'flex',
              gap: 8,
              flexShrink: 0,
              paddingLeft: isMobile ? 20 : 0,
            }}>
              <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: '#9BA1A6',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  backgroundColor: '#2A2A2E',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}>
                Explorer ↗
              </a>
              <span style={{
                fontSize: 11,
                padding: '5px 10px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                backgroundColor: contract.loading ? '#F59E0B20' : contract.alive === true ? '#22C55E20' : contract.alive === false ? '#EF444420' : '#2A2A2E',
                color: contract.loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : '#9BA1A6',
              }}>
                {contract.loading ? 'Checking...' : contract.alive === true ? 'Live' : contract.alive === false ? 'Not found' : 'Unknown'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
