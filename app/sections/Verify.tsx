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

function ExternalIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
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

  const stats = [
    { label: 'Total', value: ALL_CONTRACTS.length, color: '#A0A0A8' },
    { label: 'Verified', value: aliveCount, color: '#22C55E' },
    { label: 'Failed', value: deadCount, color: '#EF4444' },
    { label: 'Pending', value: pendingCount, color: '#F59E0B' },
  ];

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: '#FFFFFF', marginBottom: 6, letterSpacing: '-0.03em' }}>Trust Verification</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: '#A0A0A8', letterSpacing: '-0.01em' }}>Verify all 28 Vaultfire Protocol contracts are live on-chain.</p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 24,
      }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            backgroundColor: '#111114',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: isMobile ? '12px 14px' : '14px 16px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: isMobile ? 22 : 24, fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: "'SF Mono', monospace" }}>{stat.value}</p>
            <p style={{ fontSize: 10, color: '#666670', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2, fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {verifying && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#A0A0A8' }}>Verifying contracts...</span>
            <span style={{ fontSize: 12, color: '#F97316', fontWeight: 600, fontFamily: "'SF Mono', monospace" }}>{progress}%</span>
          </div>
          <div style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #F97316, #FB923C)',
              borderRadius: 4,
              width: `${progress}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: isMobile ? 10 : 10,
        marginBottom: 20,
        flexDirection: isMobile ? 'column' : 'row',
        flexWrap: 'wrap',
      }}>
        <button onClick={verifyAll} disabled={verifying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 20px',
            backgroundColor: verifying ? 'rgba(255,255,255,0.04)' : '#F97316',
            border: 'none',
            borderRadius: 8,
            color: verifying ? '#666670' : '#0A0A0C',
            fontSize: 13,
            fontWeight: 600,
            cursor: verifying ? 'default' : 'pointer',
            width: isMobile ? '100%' : 'auto',
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}>
          <ShieldCheckIcon size={14} />
          {verifying ? `Verifying... ${progress}%` : 'Verify All Contracts'}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'base', 'avalanche'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: isMobile ? '8px 12px' : '8px 14px',
                backgroundColor: filter === f ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === f ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                color: filter === f ? '#F97316' : '#A0A0A8',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                flex: isMobile ? 1 : 'none',
                transition: 'all 0.15s ease',
                letterSpacing: '-0.01em',
              }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{
          flex: 1,
          minWidth: isMobile ? 'auto' : 160,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          width: isMobile ? '100%' : 'auto',
          transition: 'border-color 0.15s ease',
        }}>
          <SearchIcon size={13} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contracts..."
            style={{
              flex: 1,
              padding: '8px 0',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 13,
              outline: 'none',
              letterSpacing: '-0.01em',
            }} />
        </div>
      </div>

      {/* Contract Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((contract) => (
          <div key={`${contract.chain}-${contract.address}`}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? 8 : 12,
              padding: isMobile ? '12px 14px' : '10px 16px',
              backgroundColor: '#111114',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              transition: 'all 0.15s ease',
            }}>
            {/* Status dot + name + chain badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: contract.loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : 'rgba(255,255,255,0.12)',
                boxShadow: contract.alive === true ? '0 0 6px rgba(34,197,94,0.3)' : contract.loading ? '0 0 6px rgba(245,158,11,0.3)' : 'none',
              }} />
              <p style={{
                fontSize: 12,
                fontWeight: 500,
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
                letterSpacing: '-0.01em',
              }}>{contract.name}</p>
              <span style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 20,
                backgroundColor: contract.chain === 'base' ? 'rgba(0,217,255,0.08)' : 'rgba(232,65,66,0.08)',
                color: contract.chain === 'base' ? '#00D9FF' : '#E84142',
                fontWeight: 500,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {contract.chain === 'base' ? 'Base' : 'Avax'}
              </span>
            </div>

            {/* Address */}
            <p style={{
              fontSize: 10,
              color: '#666670',
              fontFamily: "'SF Mono', monospace",
              paddingLeft: isMobile ? 15 : 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {isMobile
                ? `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}`
                : contract.address}
            </p>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: 6,
              flexShrink: 0,
              paddingLeft: isMobile ? 15 : 0,
            }}>
              <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#A0A0A8',
                  textDecoration: 'none',
                  padding: '4px 10px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  fontWeight: 500,
                }}>
                Explorer <ExternalIcon size={9} />
              </a>
              <span style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                fontWeight: 500,
                backgroundColor: contract.loading ? 'rgba(245,158,11,0.08)' : contract.alive === true ? 'rgba(34,197,94,0.08)' : contract.alive === false ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                color: contract.loading ? '#F59E0B' : contract.alive === true ? '#22C55E' : contract.alive === false ? '#EF4444' : '#666670',
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
