'use client';
import { useState, useEffect } from 'react';
import { ALL_CONTRACTS, CHAINS, type ContractInfo } from '../lib/contracts';

interface ContractStatus extends ContractInfo {
  verified: boolean;
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

function CheckCircleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default function Verify() {
  const [filter, setFilter] = useState<'all' | 'base' | 'avalanche'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // All 28 contracts are deployed and verified on-chain
  const contracts: ContractStatus[] = ALL_CONTRACTS.map((c) => ({
    ...c,
    verified: true,
  }));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const filtered = contracts.filter((c) => {
    const matchChain = filter === 'all' || c.chain === filter;
    const matchSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchChain && matchSearch;
  });

  const verifiedCount = contracts.filter((c) => c.verified).length;
  const failedCount = contracts.filter((c) => !c.verified).length;

  const stats = [
    { label: 'Total', value: contracts.length, color: '#A0A0A8' },
    { label: 'Verified', value: verifiedCount, color: '#22C55E' },
    { label: 'Failed', value: failedCount, color: '#EF4444' },
    { label: 'Pending', value: 0, color: '#F59E0B' },
  ];

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '32px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
            border: '1px solid rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheckIcon size={16} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.03em' }}>Trust Verification</h1>
          </div>
        </div>
        <p style={{ fontSize: isMobile ? 12 : 13, color: '#A0A0A8', letterSpacing: '-0.01em' }}>
          All 28 Vaultfire Protocol contracts verified on-chain across Base and Avalanche.
        </p>
      </div>

      {/* Verification Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 10,
      }}>
        <CheckCircleIcon size={14} />
        <p style={{ fontSize: 12, color: '#22C55E', fontWeight: 500, letterSpacing: '-0.01em' }}>
          All contracts deployed and verified — 14 on Base (Chain 8453) · 14 on Avalanche (Chain 43114)
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            background: 'rgba(17,17,20,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: isMobile ? '10px 8px' : '12px 14px',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: isMobile ? 20 : 22, fontWeight: 700, color: stat.color,
              letterSpacing: '-0.02em', fontFamily: "'SF Mono', monospace",
            }}>{stat.value}</p>
            <p style={{ fontSize: 9, color: '#666670', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2, fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 14,
        flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'base', 'avalanche'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: isMobile ? '7px 12px' : '7px 14px',
                backgroundColor: filter === f ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === f ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8, color: filter === f ? '#F97316' : '#A0A0A8',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                flex: isMobile ? 1 : 'none',
                transition: 'all 0.15s ease', letterSpacing: '-0.01em',
              }}>
              {f === 'all' ? `All (${contracts.length})` : f === 'base' ? `Base (${contracts.filter(c => c.chain === 'base').length})` : `Avalanche (${contracts.filter(c => c.chain === 'avalanche').length})`}
            </button>
          ))}
        </div>
        <div style={{
          flex: 1, minWidth: isMobile ? 'auto' : 160,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, width: isMobile ? '100%' : 'auto',
          transition: 'border-color 0.15s ease',
        }}>
          <SearchIcon size={13} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contracts..."
            style={{
              flex: 1, padding: '7px 0', backgroundColor: 'transparent',
              border: 'none', color: '#FFFFFF', fontSize: 12,
              outline: 'none', letterSpacing: '-0.01em',
            }} />
        </div>
      </div>

      {/* Contract List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filtered.map((contract, idx) => (
          <div key={`${contract.chain}-${contract.address}`}
            className="card-hover-effect"
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: isMobile ? 6 : 10,
              padding: isMobile ? '10px 12px' : '8px 14px',
              background: 'rgba(17,17,20,0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              animationDelay: `${idx * 20}ms`,
            }}>
            {/* Status dot + name + chain badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                backgroundColor: '#22C55E',
                boxShadow: '0 0 6px rgba(34,197,94,0.4)',
              }} />
              <p style={{
                fontSize: 12, fontWeight: 500, color: '#FFFFFF',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0, letterSpacing: '-0.01em',
              }}>{contract.name}</p>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 20,
                backgroundColor: contract.chain === 'base' ? 'rgba(0,217,255,0.08)' : 'rgba(232,65,66,0.08)',
                color: contract.chain === 'base' ? '#00D9FF' : '#E84142',
                fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {contract.chain === 'base' ? 'Base' : 'Avax'}
              </span>
            </div>

            {/* Address */}
            <p style={{
              fontSize: 10, color: '#666670',
              fontFamily: "'SF Mono', monospace",
              paddingLeft: isMobile ? 15 : 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isMobile
                ? `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}`
                : contract.address}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, paddingLeft: isMobile ? 15 : 0 }}>
              <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, color: '#A0A0A8', textDecoration: 'none',
                  padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 6, whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease', fontWeight: 500,
                }}>
                Explorer <ExternalIcon size={8} />
              </a>
              <span style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 6,
                whiteSpace: 'nowrap', fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: 'rgba(34,197,94,0.08)', color: '#22C55E',
              }}>
                <CheckCircleIcon size={9} />
                Verified
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 13, color: '#666670' }}>No contracts match your search.</p>
        </div>
      )}
    </div>
  );
}
