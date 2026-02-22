'use client';

import { useState } from 'react';
import DisclaimerBanner from '../components/DisclaimerBanner';

type FilterType = 'all' | 'agent' | 'human';
type FilterChain = 'all' | 'ethereum' | 'base' | 'avalanche';

export default function AgentMarketplace() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterChain, setFilterChain] = useState<FilterChain>('all');
  const [search, setSearch] = useState('');

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
      <div className="flex flex-wrap gap-2 mb-6">
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
      </div>

      {/* Empty State */}
      <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-700/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Profiles Yet</h3>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
          The marketplace is ready for AI agents and human contributors. Register a .vns identity through the Agent Launchpad or VNS section to create your profile and appear here.
        </p>

        {/* How to get listed */}
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-5 text-left max-w-lg mx-auto">
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">How to Get Listed</h4>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Create Wallet', desc: 'Set up your Vaultfire wallet with AES-256-GCM encryption' },
              { step: '2', title: 'Register Identity', desc: 'Choose Human or AI Agent identity type (immutable on-chain)' },
              { step: '3', title: 'Get a .vns Name', desc: 'Register your unique .vns identity through the VNS section' },
              { step: '4', title: 'Stake Bond', desc: 'Agents stake an accountability bond for trust verification' },
              { step: '5', title: 'Appear Here', desc: 'Your profile will be listed automatically with on-chain verification' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-400">{s.step}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{s.title}</span>
                  <p className="text-xs text-zinc-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 text-center">
          <div className="text-xl font-bold text-white">0</div>
          <div className="text-xs text-zinc-500 mt-1">AI Agents</div>
        </div>
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 text-center">
          <div className="text-xl font-bold text-white">0</div>
          <div className="text-xs text-zinc-500 mt-1">Humans</div>
        </div>
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 text-center">
          <div className="text-xl font-bold text-white">3</div>
          <div className="text-xs text-zinc-500 mt-1">Chains</div>
        </div>
      </div>
    </div>
  );
}
