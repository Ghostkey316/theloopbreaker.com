'use client';
import { useState, useEffect, useMemo } from 'react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import {
  getOnChainAgents,
  getKnownAgents,
  type RegisteredAgent,
  type BondTier,
} from '../lib/vns';

type FilterType = 'all' | 'agent' | 'human';
type FilterChain = 'all' | 'ethereum' | 'base' | 'avalanche';
type FilterTier = 'all' | 'bronze' | 'silver' | 'gold' | 'platinum';
type SortBy = 'name' | 'registered' | 'bond';

const PAGE_SIZE = 12;

const TIER_COLORS: Record<BondTier, string> = {
  bronze: '#CD7F32', silver: '#A8A9AD', gold: '#FFD700', platinum: '#E5E4E2',
};
const CHAIN_COLORS: Record<string, string> = {
  ethereum: '#627EEA', base: '#0052FF', avalanche: '#E84142', both: '#22C55E',
};
const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'ETH', base: 'Base', avalanche: 'AVAX', both: 'Multi',
};

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function IdentityCard({ agent }: { agent: RegisteredAgent }) {
  const isAgent = agent.identityType === 'agent';
  const isHuman = agent.identityType === 'human';
  const tierColor = agent.bondTier ? TIER_COLORS[agent.bondTier] : null;
  const chainColor = CHAIN_COLORS[agent.chain] || '#71717A';
  const chainLabel = CHAIN_LABELS[agent.chain] || agent.chain;
  const displayName = agent.fullName || (agent.name ? `${agent.name}.vns` : null);
  const shortAddr = truncateAddress(agent.address);

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            backgroundColor: isAgent ? 'rgba(249,115,22,0.12)' : isHuman ? 'rgba(59,130,246,0.12)' : 'rgba(167,139,250,0.12)',
            border: `1.5px solid ${isAgent ? 'rgba(249,115,22,0.25)' : isHuman ? 'rgba(59,130,246,0.25)' : 'rgba(167,139,250,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isAgent ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
              </svg>
            ) : isHuman ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {displayName ? (
              <p style={{ fontSize: 15, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
            ) : (
              <p style={{ fontSize: 13, fontWeight: 600, color: '#A1A1AA', fontFamily: "'Courier New', monospace", marginBottom: 3 }}>
                {shortAddr}
              </p>
            )}
            <p style={{ fontSize: 11, color: '#71717A', fontFamily: "'Courier New', monospace" }}>
              {displayName ? shortAddr : ''}
            </p>
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          backgroundColor: `${chainColor}15`, border: `1px solid ${chainColor}30`,
          color: chainColor, flexShrink: 0, letterSpacing: '0.02em',
        }}>
          {chainLabel}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
          backgroundColor: isAgent ? 'rgba(249,115,22,0.08)' : isHuman ? 'rgba(59,130,246,0.08)' : 'rgba(167,139,250,0.08)',
          border: `1px solid ${isAgent ? 'rgba(249,115,22,0.2)' : isHuman ? 'rgba(59,130,246,0.2)' : 'rgba(167,139,250,0.2)'}`,
          color: isAgent ? '#F97316' : isHuman ? '#3B82F6' : '#A78BFA',
        }}>
          {agent.identityType}
        </span>
        {agent.bondTier && tierColor && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
            backgroundColor: `${tierColor}12`, border: `1px solid ${tierColor}30`, color: tierColor,
          }}>
            {agent.bondTier}
          </span>
        )}
        {agent.acceptsPayments && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.02em',
            backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6',
          }}>
            x402
          </span>
        )}
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ fontSize: 12, color: '#71717A', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {agent.description}
        </p>
      )}

      {/* Specializations */}
      {agent.specializations && agent.specializations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {agent.specializations.slice(0, 3).map(s => (
            <span key={s} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#A1A1AA' }}>
              {s}
            </span>
          ))}
          {agent.specializations.length > 3 && (
            <span style={{ fontSize: 10, color: '#52525B', padding: '2px 4px' }}>+{agent.specializations.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#A1A1AA', marginBottom: 6 }}>No matches found</p>
          <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.6 }}>Try adjusting your search or filters.</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#A1A1AA', marginBottom: 8 }}>No identities yet</p>
          <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.65, maxWidth: 320, margin: '0 auto 20px' }}>
            Register a .vns identity through the Agent Launchpad or VNS section to appear in the directory.
          </p>
          <div style={{ padding: '16px 20px', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, maxWidth: 360, margin: '0 auto' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#71717A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>How to get listed</p>
            {[['1','Create Wallet','Set up your Embris wallet'],['2','Register Identity','Choose Human or AI Agent type'],['3','Get a .vns Name','Register your unique .vns name'],['4','Stake Bond','Agents stake an accountability bond'],['5','Appear Here','Your profile lists automatically']].map(([step, title, desc]) => (
              <div key={step} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6' }}>{step}</span>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#D4D4D8', marginBottom: 1 }}>{title}</p>
                  <p style={{ fontSize: 11, color: '#71717A' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AgentMarketplace() {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterChain, setFilterChain] = useState<FilterChain>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [sortBy, setSortBy] = useState<SortBy>('registered');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const local = getKnownAgents();
    if (!cancelled) setAgents(local);
    getOnChainAgents().then(onChain => {
      if (!cancelled) { setAgents(onChain.length > 0 ? onChain : local); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setPage(1); }, [search, filterType, filterChain, filterTier, sortBy]);

  const filtered = useMemo(() => {
    let result = [...agents];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.fullName || '').toLowerCase().includes(q) || a.name.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) ||
        (a.specializations || []).some(s => s.toLowerCase().includes(q))
      );
    }
    if (filterType !== 'all') result = result.filter(a => a.identityType === filterType || (filterType === 'human' && a.identityType === 'companion'));
    if (filterChain !== 'all') result = result.filter(a => a.chain === filterChain || a.chain === 'both');
    if (filterTier !== 'all') result = result.filter(a => a.bondTier === filterTier);
    result.sort((a, b) => {
      if (sortBy === 'name') return (a.fullName || a.name).localeCompare(b.fullName || b.name);
      if (sortBy === 'bond') {
        const o: Record<string, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
        return (o[b.bondTier || ''] || 0) - (o[a.bondTier || ''] || 0);
      }
      return (b.registeredAt || 0) - (a.registeredAt || 0);
    });
    return result;
  }, [agents, search, filterType, filterChain, filterTier, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search.trim() !== '' || filterType !== 'all' || filterChain !== 'all' || filterTier !== 'all';
  const agentCount = agents.filter(a => a.identityType === 'agent').length;
  const humanCount = agents.filter(a => a.identityType !== 'agent').length;

  const filterBtnStyle = (active: boolean, activeColor?: string) => ({
    fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
    backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
    color: active ? (activeColor || '#F4F4F5') : '#71717A',
    transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent' as const,
    textTransform: 'capitalize' as const,
  });

  const filterGroupStyle = {
    display: 'flex', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 3,
  };

  return (
    <div className="page-enter" style={{ padding: '0 0 80px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '28px 20px 16px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Embris Directory
        </h1>
        <p style={{ fontSize: 13, color: '#71717A' }}>
          Browse all registered agents and humans on the Embris network.
        </p>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <DisclaimerBanner disclaimerKey="marketplace" />
      </div>

      {/* Stats */}
      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
        {[
          { label: 'AI Agents', value: loading ? '…' : agentCount > 0 ? String(agentCount) : '—' },
          { label: 'Humans', value: loading ? '…' : humanCount > 0 ? String(humanCount) : '—' },
          { label: 'Total', value: loading ? '…' : agents.length > 0 ? String(agents.length) : '—' },
          { label: 'Chains', value: '3' },
        ].map(stat => (
          <div key={stat.label} style={{ flex: 1, padding: '12px 8px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.03em', marginBottom: 2 }}>{stat.value}</p>
            <p style={{ fontSize: 10, color: '#52525B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 12px', position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, pointerEvents: 'none', color: '#52525B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by .vns name, address, or specialization…"
          style={{
            width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 11, paddingBottom: 11,
            borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#F4F4F5', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div style={filterGroupStyle}>
          {(['all', 'agent', 'human'] as FilterType[]).map(val => (
            <button key={val} onClick={() => setFilterType(val)} style={filterBtnStyle(filterType === val)}>
              {val === 'all' ? 'All' : val === 'agent' ? 'AI Agents' : 'Humans'}
            </button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          {(['all', 'base', 'ethereum', 'avalanche'] as FilterChain[]).map(val => (
            <button key={val} onClick={() => setFilterChain(val)} style={filterBtnStyle(filterChain === val)}>
              {val === 'all' ? 'All Chains' : val === 'base' ? 'Base' : val === 'ethereum' ? 'ETH' : 'AVAX'}
            </button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          {(['all', 'bronze', 'silver', 'gold', 'platinum'] as FilterTier[]).map(val => (
            <button key={val} onClick={() => setFilterTier(val)} style={filterBtnStyle(filterTier === val, val !== 'all' ? TIER_COLORS[val as BondTier] : undefined)}>
              {val === 'all' ? 'All Tiers' : val}
            </button>
          ))}
        </div>
        <div style={filterGroupStyle}>
          {([['registered', 'Newest'], ['name', 'A–Z'], ['bond', 'Bond']] as [SortBy, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)} style={filterBtnStyle(sortBy === val)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <div style={{ padding: '0 20px 12px' }}>
          <p style={{ fontSize: 12, color: '#52525B', fontWeight: 500 }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} {filtered.length === 1 ? 'identity' : 'identities'}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 160, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      )}

      {/* Cards grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {paginated.map((agent, i) => (
            <IdentityCard key={`${agent.address}_${agent.chain}_${i}`} agent={agent} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ padding: '0 20px' }}>
          <EmptyState hasFilters={hasFilters} />
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === 1 ? '#3F3F46' : '#A1A1AA', WebkitTapHighlightColor: 'transparent' }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: '#71717A', fontWeight: 500 }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === totalPages ? '#3F3F46' : '#A1A1AA', WebkitTapHighlightColor: 'transparent' }}>
            Next →
          </button>
        </div>
      )}

    </div>
  );
}
