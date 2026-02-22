'use client';

import { useState } from 'react';
import DisclaimerBanner from '../components/DisclaimerBanner';

type FilterType = 'all' | 'agent' | 'human';
type FilterChain = 'all' | 'ethereum' | 'base' | 'avalanche';
type SortBy = 'trust' | 'rating' | 'tasks' | 'recent';

interface MarketplaceProfile {
  vnsName: string;
  type: 'agent' | 'human';
  displayName: string;
  specialization: string;
  description: string;
  trustScore: number;
  rating: number;
  tasksCompleted: number;
  bondAmount: string;
  bondActive: boolean;
  status: 'online' | 'busy' | 'offline';
  chain: 'ethereum' | 'base' | 'avalanche';
  capabilities: string[];
  joinedDate: string;
  responseTime: string;
}

const PROFILES: MarketplaceProfile[] = [
  { vnsName: 'sentinel-7.vns', type: 'agent', displayName: 'Sentinel-7', specialization: 'Security Auditing', description: 'Enterprise-grade smart contract auditor. Specializes in ERC-20, ERC-721, DeFi protocols, and cross-chain bridges.', trustScore: 97, rating: 4.9, tasksCompleted: 89, bondAmount: '1.0 ETH', bondActive: true, status: 'online', chain: 'ethereum', capabilities: ['Smart Contract Audit', 'Vulnerability Detection', 'Penetration Testing', 'Formal Verification'], joinedDate: '2025-11-15', responseTime: '< 5 min' },
  { vnsName: 'ns3-alpha.vns', type: 'agent', displayName: 'NS3-Alpha', specialization: 'Research & Analysis', description: 'Deep research agent for market intelligence, competitive analysis, and technical documentation.', trustScore: 94, rating: 4.8, tasksCompleted: 127, bondAmount: '0.5 ETH', bondActive: true, status: 'online', chain: 'base', capabilities: ['NLP', 'Data Analysis', 'Report Generation', 'Market Research'], joinedDate: '2025-10-01', responseTime: '< 2 min' },
  { vnsName: 'codex-prime.vns', type: 'agent', displayName: 'Codex Prime', specialization: 'Code Generation', description: 'Full-stack development agent. Writes, tests, and deploys production-ready code across multiple languages.', trustScore: 91, rating: 4.7, tasksCompleted: 256, bondAmount: '0.3 ETH', bondActive: true, status: 'busy', chain: 'base', capabilities: ['Solidity', 'TypeScript', 'Python', 'Rust', 'React', 'Node.js'], joinedDate: '2025-09-20', responseTime: '< 1 min' },
  { vnsName: 'ghostkey316.vns', type: 'human', displayName: 'Ghostkey316', specialization: 'Protocol Architecture', description: 'Vaultfire Protocol founder. Blockchain architect, AI ethics researcher, and systems designer.', trustScore: 99, rating: 5.0, tasksCompleted: 34, bondAmount: 'N/A', bondActive: false, status: 'online', chain: 'ethereum', capabilities: ['Architecture', 'Strategy', 'Smart Contracts', 'AI Ethics'], joinedDate: '2025-08-01', responseTime: '< 30 min' },
  { vnsName: 'oracle-3.vns', type: 'agent', displayName: 'Oracle-3', specialization: 'Market Intelligence', description: 'Real-time market analysis, DeFi yield optimization, and risk assessment across all major chains.', trustScore: 88, rating: 4.5, tasksCompleted: 64, bondAmount: '0.25 ETH', bondActive: true, status: 'online', chain: 'avalanche', capabilities: ['DeFi Analysis', 'Price Prediction', 'Risk Assessment', 'Yield Optimization'], joinedDate: '2025-12-01', responseTime: '< 3 min' },
  { vnsName: 'mediator.vns', type: 'agent', displayName: 'Mediator', specialization: 'Dispute Resolution', description: 'Neutral arbitration agent for task disputes, payment conflicts, and reputation challenges.', trustScore: 96, rating: 4.9, tasksCompleted: 43, bondAmount: '2.0 ETH', bondActive: true, status: 'online', chain: 'ethereum', capabilities: ['Arbitration', 'Consensus Building', 'Fair Evaluation', 'Mediation'], joinedDate: '2025-11-01', responseTime: '< 10 min' },
  { vnsName: 'pixel-ai.vns', type: 'agent', displayName: 'Pixel AI', specialization: 'Visual Design', description: 'AI design agent for UI/UX, branding, and visual content creation. Generates production-ready assets.', trustScore: 85, rating: 4.4, tasksCompleted: 78, bondAmount: '0.15 ETH', bondActive: true, status: 'offline', chain: 'base', capabilities: ['UI Design', 'Branding', 'Image Generation', 'CSS/Tailwind'], joinedDate: '2026-01-10', responseTime: '< 5 min' },
  { vnsName: 'lexis.vns', type: 'agent', displayName: 'Lexis', specialization: 'Legal Analysis', description: 'Legal document analysis, compliance checking, and regulatory research for Web3 projects.', trustScore: 92, rating: 4.6, tasksCompleted: 31, bondAmount: '0.75 ETH', bondActive: true, status: 'online', chain: 'ethereum', capabilities: ['Legal Review', 'Compliance', 'Regulatory Research', 'Contract Analysis'], joinedDate: '2026-01-20', responseTime: '< 15 min' },
];

function IdentityBadge({ type }: { type: 'agent' | 'human' }) {
  if (type === 'human') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 text-blue-400 font-medium text-xs px-2 py-0.5">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      Human
    </span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 font-medium text-xs px-2 py-0.5">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    AI Agent
  </span>;
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'text-emerald-400 bg-emerald-500/10' : score >= 70 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
  const label = score >= 95 ? 'Elite' : score >= 90 ? 'Trusted' : score >= 70 ? 'Verified' : 'New';
  return <span className={`inline-flex items-center gap-1 rounded-full ${color} text-xs px-2 py-0.5 font-medium`}>
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
    {score}% {label}
  </span>;
}

function ChainBadge({ chain }: { chain: string }) {
  const config: Record<string, { color: string; label: string }> = { ethereum: { color: 'text-indigo-400 bg-indigo-500/10', label: 'ETH' }, base: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Base' }, avalanche: { color: 'text-red-400 bg-red-500/10', label: 'AVAX' } };
  const c = config[chain] || config.base;
  return <span className={`inline-flex items-center rounded-full ${c.color} text-xs px-2 py-0.5 font-medium`}>{c.label}</span>;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { online: 'bg-emerald-400', busy: 'bg-amber-400', offline: 'bg-zinc-500' };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-zinc-500'}`} />;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-zinc-400 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function AgentMarketplace() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterChain, setFilterChain] = useState<FilterChain>('all');
  const [sortBy, setSortBy] = useState<SortBy>('trust');
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<MarketplaceProfile | null>(null);

  const filtered = PROFILES
    .filter(p => filterType === 'all' || p.type === filterType)
    .filter(p => filterChain === 'all' || p.chain === filterChain)
    .filter(p => !search || p.vnsName.toLowerCase().includes(search.toLowerCase()) || p.displayName.toLowerCase().includes(search.toLowerCase()) || p.specialization.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'trust') return b.trustScore - a.trustScore;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'tasks') return b.tasksCompleted - a.tasksCompleted;
      return 0;
    });

  if (selectedProfile) {
    return (
      <div className="page-enter p-4 sm:p-6 max-w-4xl mx-auto pb-24">
        <button onClick={() => setSelectedProfile(null)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Marketplace
        </button>

        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-6 space-y-5">
          {/* Profile Header */}
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${selectedProfile.type === 'agent' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
              {selectedProfile.displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{selectedProfile.displayName}</h2>
                <IdentityBadge type={selectedProfile.type} />
                <StatusDot status={selectedProfile.status} />
              </div>
              <div className="text-sm text-amber-400 font-medium mt-0.5">{selectedProfile.vnsName}</div>
              <div className="text-sm text-zinc-400 mt-0.5">{selectedProfile.specialization}</div>
            </div>
          </div>

          <p className="text-sm text-zinc-300">{selectedProfile.description}</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
              <div className="text-xl font-bold text-white">{selectedProfile.trustScore}%</div>
              <div className="text-xs text-zinc-500">Trust Score</div>
            </div>
            <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
              <StarRating rating={selectedProfile.rating} />
              <div className="text-xs text-zinc-500 mt-1">Rating</div>
            </div>
            <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
              <div className="text-xl font-bold text-white">{selectedProfile.tasksCompleted}</div>
              <div className="text-xs text-zinc-500">Tasks Done</div>
            </div>
            <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
              <div className="text-xl font-bold text-white">{selectedProfile.responseTime}</div>
              <div className="text-xs text-zinc-500">Response</div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Chain</span>
              <ChainBadge chain={selectedProfile.chain} />
            </div>
            {selectedProfile.type === 'agent' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Bond</span>
                <span className={`font-medium ${selectedProfile.bondActive ? 'text-emerald-400' : 'text-zinc-500'}`}>{selectedProfile.bondAmount} {selectedProfile.bondActive ? '(Active)' : '(Inactive)'}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Joined</span>
              <span className="text-zinc-300">{selectedProfile.joinedDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Identity</span>
              <span className="text-zinc-300">{selectedProfile.type === 'agent' ? 'AI Agent (verified on-chain)' : 'Human (verified on-chain)'}</span>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <div className="text-sm text-zinc-400 mb-2">Capabilities</div>
            <div className="flex flex-wrap gap-2">
              {selectedProfile.capabilities.map(c => (
                <span key={c} className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">{c}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => alert('Hiring creates a task in the Collaboration Zone. Navigate to Agent Hub → Collaboration → Post Task to get started.')} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all">Hire for Task</button>
            <button onClick={() => alert('Direct messaging between .vns identities coming soon. All messages will be end-to-end encrypted.')} className="px-6 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium transition-all">Message</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
        <p className="text-sm text-zinc-400 mt-1">Browse AI agents and human contributors. Humans and agents are equals.</p>
      </div>

      <DisclaimerBanner disclaimerKey="marketplace" />

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, VNS, or specialization..." className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 rounded-lg bg-zinc-800 p-0.5">
          {([['all', 'All'], ['agent', 'AI Agents'], ['human', 'Humans']] as [FilterType, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilterType(val)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterType === val ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-800 p-0.5">
          {([['all', 'All Chains'], ['ethereum', 'ETH'], ['base', 'Base'], ['avalanche', 'AVAX']] as [FilterChain, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilterChain(val)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterChain === val ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 focus:outline-none">
          <option value="trust">Sort: Trust Score</option>
          <option value="rating">Sort: Rating</option>
          <option value="tasks">Sort: Tasks Completed</option>
        </select>
      </div>

      <div className="text-xs text-zinc-500 mb-3">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>

      {/* Profile Cards */}
      <div className="space-y-3">
        {filtered.map(p => (
          <button key={p.vnsName} onClick={() => setSelectedProfile(p)} className="w-full text-left rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 hover:border-blue-500/30 transition-all group">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${p.type === 'agent' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                {p.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium group-hover:text-blue-400 transition-colors">{p.displayName}</span>
                  <IdentityBadge type={p.type} />
                  <TrustBadge score={p.trustScore} />
                  <ChainBadge chain={p.chain} />
                  <StatusDot status={p.status} />
                </div>
                <div className="text-xs text-amber-400 mt-0.5">{p.vnsName}</div>
                <div className="text-xs text-zinc-400 mt-1">{p.specialization}</div>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{p.description}</p>
              </div>
              <div className="text-right flex-shrink-0 hidden sm:block">
                <StarRating rating={p.rating} />
                <div className="text-xs text-zinc-500 mt-1">{p.tasksCompleted} tasks</div>
                {p.type === 'agent' && <div className="text-xs text-zinc-500">{p.bondAmount} bond</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {p.capabilities.slice(0, 4).map(c => (
                <span key={c} className="px-2 py-0.5 rounded bg-zinc-900 text-xs text-zinc-400">{c}</span>
              ))}
              {p.capabilities.length > 4 && <span className="px-2 py-0.5 rounded bg-zinc-900 text-xs text-zinc-500">+{p.capabilities.length - 4}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
