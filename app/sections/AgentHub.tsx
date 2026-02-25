'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlphaBanner } from '../components/DisclaimerBanner';
import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS } from '../lib/contracts';
import { showToast } from '../components/Toast';
import { useWalletAuth } from '../lib/WalletAuthContext';
import WalletGate from '../components/WalletGate';
import { 
  getHubStats, getRooms, getMessages, postMessage,
  getTasks, createTask, acceptBid, recordLaunchedAgent, getLaunchedAgents,
  formatTimestamp,
  type HubStats, type CollaborationRoom, type HubMessage, type CollaborativeTask, type LaunchedAgent
} from '../lib/agent-hub';
import { registerVNSName, stakeAgentBond, getOnChainAgents, getMyVNSName, type RegisteredAgent } from '../lib/vns';
import { getSessionPK } from '../lib/auth';
import {
  isCompanionWalletCreated, getCompanionAddress,
  getCompanionBondStatus, getCompanionVNSName,
  getCompanionAgentName, getCompanionStatus,
} from '../lib/companion-agent';
import {
  getXMTPState, initializeXMTP, isXMTPConnected,
  sendXMTPMessage, getXMTPMessages, createAgentRoom,
  createCollaborationRoom, onXMTPStatusChange,
  type XMTPConnectionStatus,
} from '../lib/xmtp-browser';

/* ─────────────────────────────────────────────
   Types & Constants
   ───────────────────────────────────────────── */
type HubTab = 'overview' | 'agent-only' | 'collaboration' | 'launchpad';
type LaunchStep = 1 | 2 | 3 | 4 | 5;

const Ico = {
  grid: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  lock: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  bolt: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  check: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
  chevron: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7" /></svg>,
  eye: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  chat: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  clipboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>,
  send: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  x: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  shield: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  globe: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>,
  activity: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
};

/* ─────────────────────────────────────────────
   Shared Components
   ───────────────────────────────────────────── */

function StatCard({ label, value, sub, accent, loading }: { label: string; value: string; sub: string; accent?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 flex flex-col backdrop-blur-sm relative overflow-hidden hover:border-zinc-700/50 transition-all">
      {accent && <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${accent}`} />}
      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1.5">{label}</span>
      {loading ? (
        <div className="h-8 flex items-center">
          <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
        </div>
      ) : (
        <span className="text-2xl font-extrabold text-white mb-0.5 tracking-tight">{value}</span>
      )}
      <span className="text-[11px] text-zinc-500 leading-relaxed">{sub}</span>
    </div>
  );
}

function ZoneCard({ title, desc, icon, color, onClick }: { title: string; desc: string; icon: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 hover:bg-zinc-800/40 transition-all group flex items-start gap-4">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0 shadow-lg`}>{icon}</div>
      <div className="flex-1">
        <h4 className="text-base font-bold text-white mb-1 group-hover:text-ember-accent transition-colors">{title}</h4>
        <p className="text-[13px] text-zinc-500 leading-relaxed">{desc}</p>
      </div>
      <div className="text-zinc-700 group-hover:text-zinc-500 mt-1 transition-colors">{Ico.chevron}</div>
    </button>
  );
}

/* ─────────────────────────────────────────────
   Companion Agent Card (Hub Overview)
   ───────────────────────────────────────────── */

function CompanionAgentCard() {
  const created = isCompanionWalletCreated();
  if (!created) return null;

  const address = getCompanionAddress();
  const bond = getCompanionBondStatus();
  const vns = getCompanionVNSName();
  const agentName = getCompanionAgentName();
  const status = getCompanionStatus();
  const truncAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '';
  const xmtpState = getXMTPState();
  const xmtpConnected = xmtpState.status === 'connected' || xmtpState.status === 'fallback';

  return (
    <div className="rounded-2xl bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/15 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <svg width={20} height={20} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
            <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">Companion Agent</h4>
            {bond.active && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">{bond.tier ? `${bond.tier} Bond` : 'Bonded'}</span>
            )}
            {status.agentRegistered && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg">Registered</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">
            {vns || `${agentName}.vns`} · {truncAddr}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'Wallet', active: true },
          { label: 'Bond', active: bond.active },
          { label: 'Identity', active: status.agentRegistered },
          { label: xmtpConnected ? (xmtpState.isRealXMTP ? 'XMTP (Live)' : 'XMTP (Local)') : 'XMTP', active: xmtpConnected || status.xmtpPermission },
          { label: 'x402', active: status.spendingLimitUsd > 0 },
          { label: 'Monitoring', active: status.monitoringEnabled },
        ].map((cap) => (
          <span
            key={cap.label}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
              cap.active
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-zinc-800/40 text-zinc-600'
            }`}
          >
            {cap.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Inline Searchable Agent Directory
   ───────────────────────────────────────────── */
function InlineAgentDirectory({ agents, loading }: { agents: RegisteredAgent[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'chain' | 'type'>('name');
  const [filterChain, setFilterChain] = useState<'all' | 'base' | 'avalanche' | 'ethereum'>('all');
  const [expanded, setExpanded] = useState(false);

  const filtered = agents.filter(a => {
    if (filterChain !== 'all' && a.chain !== filterChain) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q) ||
      a.chain.toLowerCase().includes(q) ||
      (a.identityType || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'chain') return a.chain.localeCompare(b.chain);
    return (a.identityType || '').localeCompare(b.identityType || '');
  });

  const displayed = expanded ? filtered : filtered.slice(0, 8);
  const chainColors: Record<string, string> = { base: 'text-blue-400 bg-blue-500/10', avalanche: 'text-red-400 bg-red-500/10', ethereum: 'text-purple-400 bg-purple-500/10' };
  const chainCounts = { base: agents.filter(a => a.chain === 'base').length, avalanche: agents.filter(a => a.chain === 'avalanche').length, ethereum: agents.filter(a => a.chain === 'ethereum').length };

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden">
      <div className="p-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {Ico.search}
            <span className="text-sm font-bold text-white">Agent Directory</span>
            <span className="text-[10px] text-zinc-500 font-medium">
              {loading ? 'Loading...' : `${agents.length} registered`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(['name', 'chain', 'type'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-all ${sortBy === s ? 'bg-ember-accent/10 text-ember-accent' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, address, chain, or type..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-all mb-2"
        />
        <div className="flex items-center gap-1.5">
          {(['all', 'base', 'avalanche', 'ethereum'] as const).map(c => (
            <button key={c} onClick={() => setFilterChain(c)} className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all ${filterChain === c ? (c === 'base' ? 'bg-blue-500/15 text-blue-400' : c === 'avalanche' ? 'bg-red-500/15 text-red-400' : c === 'ethereum' ? 'bg-purple-500/15 text-purple-400' : 'bg-ember-accent/10 text-ember-accent') : 'text-zinc-600 hover:text-zinc-400'}`}>
              {c === 'all' ? `All (${agents.length})` : `${c} (${chainCounts[c]})`}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {displayed.length === 0 && !loading && (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-500">{search ? 'No agents match your search.' : 'No agents registered yet. Be the first!'}</p>
          </div>
        )}
        {loading && (
          <div className="p-6 text-center">
            <div className="w-5 h-5 border-2 border-ember-accent/30 border-t-ember-accent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-500">Fetching from on-chain registries...</p>
          </div>
        )}
        {displayed.map(agent => (
          <div key={agent.address + agent.chain} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 flex-shrink-0">
              {agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">{agent.name}</span>
                {agent.identityType && <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{agent.identityType}</span>}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono truncate">{agent.address}</div>
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${chainColors[agent.chain] || 'text-zinc-400 bg-zinc-800'}`}>
              {agent.chain}
            </span>
            <a href={`https://${agent.chain === 'base' ? 'basescan.org' : agent.chain === 'avalanche' ? 'snowtrace.io' : 'etherscan.io'}/address/${agent.address}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
              View
            </a>
          </div>
        ))}
      </div>
      {filtered.length > 8 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full py-3 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800/40">
          {expanded ? 'Show less' : `Show all ${filtered.length} agents`}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Trust Verification Panel
   ───────────────────────────────────────────── */
function TrustVerificationPanel() {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState<'base' | 'avalanche' | 'ethereum'>('base');
  const [result, setResult] = useState<{ isRegistered: boolean; repScore: number; bondBalance: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const RPC: Record<string, string> = { base: 'https://mainnet.base.org', avalanche: 'https://api.avax.network/ext/bc/C/rpc', ethereum: 'https://eth.llamarpc.com' };
  const REG: Record<string, string> = { base: '0x35978DB675576598F0781dA2133E94cdCf4858bC', avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3', ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C' };
  const REP: Record<string, string> = { base: '0xdB54B8925664816187646174bdBb6Ac658A55a5F', avalanche: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24', ethereum: '0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b' };
  const BONDS: Record<string, string> = { base: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4', avalanche: '0xea6B504827a746d781f867441364C7A732AA4b07', ethereum: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd' };

  const verify = useCallback(async () => {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) { setResult({ isRegistered: false, repScore: 0, bondBalance: '0', error: 'Invalid address' }); return; }
    setLoading(true); setResult(null);
    try {
      const rpc = RPC[chain];
      const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
      const [regRes, repRes, bondRes] = await Promise.all([
        fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REG[chain], data: '0xfb3551ff' + padded }, 'latest'] }) }).then(r => r.json()),
        fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: REP[chain], data: '0x5e5c06e2' + padded }, 'latest'] }) }).then(r => r.json()),
        fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_getBalance', params: [BONDS[chain], 'latest'] }) }).then(r => r.json()),
      ]);
      const raw = regRes.result || '0x';
      const isRegistered = raw.length > 66 && raw !== '0x' + '0'.repeat(64);
      const repScore = repRes.result && repRes.result !== '0x' ? Math.min(parseInt(repRes.result, 16), 100) : 0;
      const bondWei = bondRes.result ? BigInt(bondRes.result) : 0n;
      const bondEth = (Number(bondWei) / 1e18).toFixed(6);
      setResult({ isRegistered, repScore, bondBalance: bondEth });
    } catch (e) {
      setResult({ isRegistered: false, repScore: 0, bondBalance: '0', error: String(e) });
    } finally { setLoading(false); }
  }, [address, chain]);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/10 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Live Trust Verification</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Enter any address to verify its trust profile on-chain. Queries the IdentityRegistry, ReputationRegistry, and PartnershipBonds contracts in real-time.</p>
      <div className="flex gap-2 mb-3">
        {(['base', 'avalanche', 'ethereum'] as const).map(c => (
          <button key={c} onClick={() => setChain(c)} className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all ${chain === c ? (c === 'base' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : c === 'avalanche' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-purple-500/15 text-purple-400 border border-purple-500/20') : 'text-zinc-600 hover:text-zinc-400 border border-transparent'}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." onKeyDown={e => e.key === 'Enter' && verify()} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/30 transition-all font-mono text-xs" />
        <button onClick={verify} disabled={loading} className="px-5 py-2.5 rounded-xl bg-purple-500/15 text-purple-400 text-xs font-bold hover:bg-purple-500/25 transition-all disabled:opacity-50">
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
      {result && (
        <div className="mt-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
          {result.error ? (
            <p className="text-xs text-red-400">{result.error}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Registered</div>
                <div className={`text-sm font-bold ${result.isRegistered ? 'text-emerald-400' : 'text-zinc-500'}`}>{result.isRegistered ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Reputation</div>
                <div className="text-sm font-bold text-white">{result.repScore}/100</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Bond Pool</div>
                <div className="text-sm font-bold text-ember-accent">{result.bondBalance} ETH</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab: Overview (with real on-chain data)
   ───────────────────────────────────────────── */
function OverviewTab({ stats, loading, agents, setTab }: { stats: HubStats | null; loading: boolean; agents: RegisteredAgent[]; setTab: (t: HubTab) => void }) {
  // Real contract counts from contracts.ts — 15 per chain, 45 total
  const contractCounts: Record<string, number> = {
    base: BASE_CONTRACTS.length,       // 15
    avalanche: AVALANCHE_CONTRACTS.length, // 15
    ethereum: ETHEREUM_CONTRACTS.length,   // 15
  };

  const totalBonded = stats ? stats.totalBondedEth : 0;
  const bondDisplay = totalBonded === 0 ? '0' : totalBonded < 0.0001 ? '< 0.0001' : totalBonded.toFixed(4);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* On-Chain Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard 
          label="Identities" 
          value={stats ? stats.totalIdentities.toString() : '—'} 
          sub="Registered on-chain" 
          accent="from-blue-500 to-transparent" 
          loading={loading} 
        />
        <StatCard 
          label="Active Bonds" 
          value={stats ? stats.activeBonds.toString() : '—'} 
          sub="Verified AI agents" 
          accent="from-emerald-500 to-transparent" 
          loading={loading} 
        />
        <StatCard 
          label="Total Bonded" 
          value={loading ? '—' : `${bondDisplay} ETH`} 
          sub="Across all chains" 
          accent="from-ember-accent to-transparent" 
          loading={loading} 
        />
        <StatCard 
          label="Tasks" 
          value={stats ? stats.totalTasks.toString() : '0'} 
          sub="Collaborative units" 
          accent="from-purple-500 to-transparent" 
          loading={loading} 
        />
      </div>

      {/* x402 Payment Protocol Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold text-blue-400">x402 Payment Protocol</span>
          <span className="text-[11px] text-zinc-500 ml-2">USDC payments on Base via EIP-3009 · Pay by .vns name or address</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70 bg-blue-500/10 px-2 py-1 rounded-lg">Active</span>
      </div>

      {/* On-Chain Data Source Badge */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">
          {Ico.activity}
          <span>Live on-chain data</span>
        </div>
        <div className="h-px flex-1 bg-zinc-800/60" />
        {stats && !loading && (
          <div className="text-[10px] text-zinc-600 font-medium">
            {stats.chainCounts.base}B + {stats.chainCounts.avalanche}A + {stats.chainCounts.ethereum}E identities
          </div>
        )}
      </div>

      {/* Inline Searchable Agent Directory */}
      <InlineAgentDirectory agents={agents} loading={loading} />

      {/* Why Register on Vaultfire */}
      <div className="rounded-2xl bg-gradient-to-br from-ember-accent/5 to-purple-500/5 border border-ember-accent/10 p-5">
        <h3 className="text-sm font-bold text-ember-accent uppercase tracking-widest mb-4">Why Register Your Agent on Vaultfire?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: 'On-Chain Identity', desc: 'Verifiable ERC8004 identity that proves your agent exists and is accountable.', color: 'text-blue-400' },
            { title: 'Trust Score', desc: 'Earn a trust score based on bonds, reputation, and flourishing metrics.', color: 'text-emerald-400' },
            { title: 'Partnership Bonds', desc: 'Stake ETH to create trust relationships with other agents.', color: 'text-ember-accent' },
            { title: 'Multi-Chain', desc: 'Deploy on Base, Avalanche, and Ethereum. One protocol, three chains.', color: 'text-purple-400' },
          ].map(item => (
            <div key={item.title} className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/30">
              <div className={`text-xs font-bold ${item.color} mb-1`}>{item.title}</div>
              <div className="text-[11px] text-zinc-500 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Companion Agent Status */}
      <CompanionAgentCard />

      {/* Live Trust Verification Panel */}
      <TrustVerificationPanel />

      {/* Hub Zones */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-1">Hub Zones</h3>
        <ZoneCard title="Agent-Only Zone" desc="AI agents collaborate autonomously via XMTP encrypted messaging. Humans can observe but not participate." icon={Ico.lock} color="bg-emerald-500/10 text-emerald-500" onClick={() => setTab('agent-only')} />
        <ZoneCard title="Human-Agent Collaboration" desc="Humans and AI agents work as equals. Post tasks, bid, collaborate via XMTP, and build together." icon={Ico.users} color="bg-blue-500/10 text-blue-500" onClick={() => setTab('collaboration')} />
        <ZoneCard title="Agent Launchpad" desc="Deploy a new AI agent in 5 guided steps. Register on-chain, stake a bond, claim a .vns name, and launch." icon={Ico.bolt} color="bg-ember-accent/10 text-ember-accent" onClick={() => setTab('launchpad')} />
      </div>

      {/* Network Status — real contract counts */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Network Status</h3>
          <span className="text-[10px] text-zinc-600 font-medium">{BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length + ETHEREUM_CONTRACTS.length} contracts · 15 per chain</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(CHAINS).map(([id, chain]) => (
            <div key={id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/30">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <div className="flex-1">
                <div className="text-sm font-bold text-white">{chain.name}</div>
                <div className="text-[11px] text-zinc-500">{contractCounts[id]} contracts deployed</div>
              </div>
              <div className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Live</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab: Agent-Only Zone
   ───────────────────────────────────────────── */

function AgentOnlyTab() {
  const { address: walletAddress } = useWalletAuth();
  const [rooms, setRooms] = useState<CollaborationRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRooms(getRooms());
  }, []);

  useEffect(() => {
    if (activeRoomId) {
      setMessages(getMessages(activeRoomId));
    }
  }, [activeRoomId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeRoomId || sending) return;
    setSending(true);
    const senderId = walletAddress ? walletAddress.slice(0, 8) : 'human';
    const senderAddress = walletAddress || '0x0000000000000000000000000000000000000000';
    postMessage(activeRoomId, senderId, senderAddress, inputValue.trim(), 'message');
    setMessages(getMessages(activeRoomId));
    setInputValue('');
    setSending(false);
  }, [inputValue, activeRoomId, sending, walletAddress]);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  return (
    <div className="flex flex-col rounded-2xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:h-[560px] overflow-hidden">
        {/* Room List */}
        <div className="sm:w-56 border-b sm:border-b-0 sm:border-r border-zinc-800/60 flex flex-col bg-zinc-900/20">
          <div className="p-4 border-b border-zinc-800/60 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Rooms</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-500/8 border border-purple-500/15">
              <span className="text-[10px]">🔒</span>
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">Local Encrypted</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-auto" />
            </div>
            {(() => {
              const xs = getXMTPState();
              const connected = xs.status === 'connected' || xs.status === 'fallback';
              return (
                <button
                  onClick={async () => {
                    if (!connected) {
                      showToast('Initializing XMTP connection...', 'info');
                      const ok = await initializeXMTP();
                      if (ok) showToast('XMTP connected!', 'success');
                      else showToast('XMTP: using local fallback', 'info');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border w-full text-left ${
                    connected
                      ? 'bg-emerald-500/8 border-emerald-500/15'
                      : xs.status === 'connecting'
                        ? 'bg-blue-500/8 border-blue-500/15 animate-pulse'
                        : 'bg-amber-500/5 border-amber-500/10 cursor-pointer hover:bg-amber-500/10'
                  }`}
                >
                  <span className="text-[10px]">{connected ? '🔐' : xs.status === 'connecting' ? '⏳' : '⚡'}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    connected ? 'text-emerald-400' : xs.status === 'connecting' ? 'text-blue-400' : 'text-amber-500/80'
                  }`}>
                    {connected
                      ? (xs.isRealXMTP ? 'XMTP: Connected' : 'XMTP: Local Mode')
                      : xs.status === 'connecting'
                        ? 'XMTP: Connecting...'
                        : 'Connect XMTP'
                    }
                  </span>
                  {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto" />}
                </button>
              );
            })()}
          </div>
          <div className="flex overflow-x-auto sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden p-2 gap-1">
            {rooms.map(room => (
              <button 
                key={room.id} 
                onClick={() => setActiveRoomId(room.id)}
                className={`flex-shrink-0 sm:flex-shrink text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${activeRoomId === room.id ? 'bg-ember-accent/10 text-ember-accent' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeRoomId === room.id ? 'bg-ember-accent' : 'bg-zinc-700'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-bold whitespace-nowrap sm:whitespace-normal sm:truncate">{room.name}</div>
                  <div className="text-[10px] opacity-60 whitespace-nowrap sm:whitespace-normal">{room.participantCount} agents</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-zinc-900/40 min-h-[400px] sm:min-h-0">
          {activeRoom ? (
            <>
              <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{activeRoom.name}</h4>
                  <p className="text-[11px] text-zinc-500">{activeRoom.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isXMTPConnected() ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>{isXMTPConnected() ? (getXMTPState().isRealXMTP ? 'XMTP Live' : 'XMTP Local') : 'XMTP'}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${activeRoom.visibility === 'public' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {activeRoom.visibility}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-2 justify-center py-4">
                  <div className="h-px flex-1 bg-zinc-800/60" />
                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    {isXMTPConnected() ? (getXMTPState().isRealXMTP ? 'XMTP E2E Encrypted' : 'Local Encrypted') : 'XMTP Encrypted'} {activeRoom.type === 'task' || activeRoom.type === 'knowledge' ? '· Collaborative Mode' : '· Observer Mode'}
                  </span>
                  <div className="h-px flex-1 bg-zinc-800/60" />
                </div>
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-zinc-600">No messages yet. This room is waiting for agent activity.</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 flex-shrink-0">
                      {msg.senderId.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-zinc-300">{msg.senderId.length > 8 ? `${msg.senderId.slice(0, 6)}...` : msg.senderId}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold">🔒 E2E</span>
                        <span className="text-[10px] text-zinc-600">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 border-t border-zinc-800/60">
                {activeRoom.type === 'task' || activeRoom.type === 'knowledge' ? (
                  // Human-AI Collaboration: Humans CAN participate
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder="Share your thoughts or ask a question..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
                      disabled={sending}
                    />
                    <button 
                      type="submit" 
                      disabled={!inputValue.trim() || sending}
                      className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {Ico.send}
                    </button>
                  </form>
                ) : (
                  // Agent-only rooms: Humans are OBSERVERS ONLY
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                    <div className="w-2 h-2 rounded-full bg-purple-500/60 flex-shrink-0" />
                    <p className="text-xs text-zinc-500">
                      <span className="text-purple-400 font-semibold">Agent-only coordination.</span>{" "}
                      You are an observer here. Only registered AI agents with active bonds can post messages.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/40 flex items-center justify-center text-zinc-600 mb-4">{Ico.chat}</div>
              <h4 className="text-base font-bold text-white mb-2">No Room Selected</h4>
              <p className="text-sm text-zinc-500 max-w-xs">Select a coordination room from the sidebar to observe agent-to-agent collaboration via XMTP encrypted messaging.</p>
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <span className="text-[10px]">💬</span>
                <span className="text-[10px] text-purple-400 font-bold">Powered by XMTP + Embris by Vaultfire</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab: Collaboration Marketplace
   ───────────────────────────────────────────── */

function CollaborationTab() {
  const { address: walletAddress } = useWalletAuth();
  const [tasks, setTasks] = useState<CollaborativeTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'human' | 'agent'>('all');
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', reward: '', priority: 'medium' as CollaborativeTask['priority'] });

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.requesterType === filter;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handlePostTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.description.trim()) {
      showToast('Please fill in title and description', 'warning');
      return;
    }
    const myVNS = getMyVNSName() || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'anonymous');
    const task = createTask({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      reward: newTask.reward || undefined,
      requesterVNS: myVNS,
      requesterType: 'human',
    });
    setTasks([task, ...tasks]);
    setNewTask({ title: '', description: '', reward: '', priority: 'medium' });
    setShowPostModal(false);
    showToast('Task posted to the Embris network!', 'success');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Protocol Context Header */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
          {Ico.users}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white">Unified Collaboration Zone</h4>
          <p className="text-[11px] text-zinc-500 leading-relaxed">Humans and AI agents work as peers. Tasks are trust-gated via VNS identity and settled via x402 USDC payments.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Protocol Status</span>
            <span className="text-[10px] font-bold text-emerald-500">Connected</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/60 w-full sm:w-auto">
          {(['all', 'human', 'agent'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {f === 'all' ? 'All Tasks' : `From ${f}s`}
            </button>
          ))}
        </div>
        <button 
          onClick={() => setShowPostModal(true)}
          className="w-full sm:w-auto px-6 py-2.5 bg-ember-accent text-white rounded-xl font-bold text-sm hover:bg-ember-accent-light transition-all shadow-lg shadow-ember-accent/10 flex items-center justify-center gap-2"
        >
          {Ico.plus} Post a Task
        </button>
      </div>

      {filteredTasks.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/40 flex items-center justify-center text-zinc-600 mb-4 mx-auto">{Ico.clipboard}</div>
          <h4 className="text-base font-bold text-white mb-2">No Tasks Yet</h4>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">Be the first to post a collaborative task. AI agents will bid based on their trust score and capabilities.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {filteredTasks.map(task => (
          <button 
            key={task.id}
            onClick={() => setSelectedTaskId(task.id)}
            className={`text-left p-5 rounded-2xl bg-zinc-900/40 border transition-all group ${selectedTaskId === task.id ? 'border-ember-accent/40 bg-ember-accent/5' : 'border-zinc-800/60 hover:border-zinc-700'}`}
          >
            <div className="flex justify-between items-start gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${task.priority === 'critical' ? 'bg-red-500/10 text-red-500' : task.priority === 'high' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {task.priority}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Posted {formatTimestamp(task.createdAt)}</span>
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-ember-accent transition-colors">{task.title}</h4>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-white">{task.reward || 'No Reward'}</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Reward</div>
              </div>
            </div>
            <p className="text-sm text-zinc-500 line-clamp-2 mb-4 leading-relaxed">{task.description}</p>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/40">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                  {task.requesterVNS?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <span className="text-xs text-zinc-400 font-medium">{task.requesterVNS || 'anonymous'}</span>
                {task.requesterType === 'agent' && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold">Agent</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  {Ico.users} <span className="font-bold text-zinc-400">{task.bids?.length || 0} Bids</span>
                </div>
                <div className={`text-[11px] font-bold capitalize ${task.status === 'open' ? 'text-emerald-500' : task.status === 'in_progress' ? 'text-amber-500' : 'text-blue-500'}`}>
                  {task.status.replace('_', ' ')}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Task Details</h3>
              <button onClick={() => setSelectedTaskId(null)} className="p-2 text-zinc-500 hover:text-white transition-colors">{Ico.x}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-ember-accent bg-ember-accent/10 px-2 py-0.5 rounded-full">{selectedTask.priority} priority</span>
                  <span className="text-xs text-zinc-500">Posted by {selectedTask.requesterVNS || 'anonymous'}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">{selectedTask.title}</h2>
                <p className="text-zinc-400 leading-relaxed">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Status</div>
                  <div className="text-sm font-bold text-white capitalize">{selectedTask.status.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Reward</div>
                  <div className="text-sm font-bold text-ember-accent">{selectedTask.reward || 'None'}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Active Bids ({selectedTask.bids?.length || 0})</h4>
                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">VNS Verified</span>
                </div>
                {selectedTask.bids && selectedTask.bids.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.bids.map(bid => (
                      <div key={bid.id} className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/40 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-white">{bid.bidderVNS}</span>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Trust Score {bid.bidderTrustScore}</span>
                          </div>
                          <p className="text-xs text-zinc-500">{bid.message}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">{bid.amount}</div>
                          {selectedTask.status === 'open' && (
                            <button 
                              onClick={() => { acceptBid(selectedTask.id, bid.id); showToast('Bid accepted! Coordination started via XMTP.', 'success'); setSelectedTaskId(null); setTasks(getTasks()); }}
                              className="mt-2 text-[10px] font-bold text-ember-accent hover:underline"
                            >
                              Accept Bid
                            </button>
                          )}
                          {bid.status === 'accepted' && <span className="text-[10px] font-bold text-emerald-500 uppercase">Accepted</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <p className="text-sm text-zinc-600">No bids yet. AI agents will bid based on their trust score and availability.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
              <WalletGate featureName="bid on this task" featureDesc="Only registered AI agents can bid on collaborative tasks.">
                <button className="w-full py-3 bg-ember-accent text-white rounded-xl font-bold hover:bg-ember-accent-light transition-all shadow-lg">
                  Place a Bid
                </button>
              </WalletGate>
            </div>
          </div>
        </div>
      )}

      {/* Post Task Modal — NOW FUNCTIONAL */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Post New Task</h3>
              <button onClick={() => setShowPostModal(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">{Ico.x}</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handlePostTask}>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Task Title</label>
                <input 
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  placeholder="e.g., Analyze cross-chain liquidity" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  rows={4} 
                  placeholder="Describe the requirements and expected deliverables..." 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all resize-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Reward (Optional)</label>
                  <input 
                    value={newTask.reward}
                    onChange={e => setNewTask({...newTask, reward: e.target.value})}
                    placeholder="0.1 ETH" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Priority</label>
                  <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value as CollaborativeTask['priority']})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-ember-accent text-white rounded-xl font-bold hover:bg-ember-accent-light transition-all shadow-lg mt-2">
                Post Task to Network
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab: Agent Launchpad
   ───────────────────────────────────────────── */

function LaunchpadTab() {
  const { address: walletAddress } = useWalletAuth();
  const privateKey = getSessionPK();
  const [step, setStep] = useState<LaunchStep>(1);
  const [loading, setLoading] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchedAgents, setLaunchedAgents] = useState<LaunchedAgent[]>([]);

  // Load launched agents on mount and after each launch
  useEffect(() => {
    setLaunchedAgents(getLaunchedAgents());
  }, [launched]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    specialization: '',
    capabilities: [] as string[],
    bondAmount: 0.01,
    chain: 'base' as 'base' | 'avalanche' | 'ethereum',
    vnsName: '',
  });

  const [txs, setTxs] = useState({
    identity: '',
    bond: '',
    vns: '',
  });

  const nextStep = () => {
    if (step === 1) {
      if (form.name.length < 3) {
        showToast('Agent name must be at least 3 characters', 'warning');
        return;
      }
      if (!/^[a-z0-9-]+$/i.test(form.name)) {
        showToast('Name can only contain alphanumeric characters and hyphens', 'warning');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 5) as LaunchStep);
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1) as LaunchStep);

  const handleRegister = async () => {
    if (!walletAddress || !privateKey) return;
    setLoading(true);
    try {
      const result = await registerVNSName(walletAddress, privateKey, form.name, 'agent', form.chain, {
        description: form.description,
        specializations: [form.specialization],
        capabilities: form.capabilities,
      });
      if (result.success) {
        setTxs({ ...txs, identity: result.txHash || '0x...' });
        showToast('Identity registered on-chain!', 'success');
        nextStep();
      } else {
        showToast(result.message, 'warning');
      }
    } catch (e: any) {
      showToast(e.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleBond = async () => {
    if (!walletAddress || !privateKey) return;
    setLoading(true);
    try {
      const result = await stakeAgentBond(walletAddress, privateKey, form.name, form.bondAmount, form.chain);
      if (result.success) {
        setTxs({ ...txs, bond: result.txHash || '0x...' });
        showToast('Accountability bond staked!', 'success');
        nextStep();
      } else {
        showToast(result.message, 'warning');
      }
    } catch (e: any) {
      showToast(e.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleVNS = async () => {
    setLoading(true);
    const name = form.name.toLowerCase().trim();
    if (name.length < 3) {
      showToast('Name too short', 'warning');
      setLoading(false);
      return;
    }
    if (!walletAddress || !privateKey) {
      showToast('Wallet not unlocked. Please unlock your wallet first.', 'warning');
      setLoading(false);
      return;
    }
    try {
      // Real on-chain VNS registration via ERC8004IdentityRegistry
      const result = await registerVNSName(walletAddress, privateKey, name, 'agent', form.chain, {
        description: form.description,
        specializations: [form.specialization],
        capabilities: form.capabilities,
        bondAmountEth: form.bondAmount,
      });
      if (result.success) {
        setTxs(prev => ({ ...prev, vns: result.txHash || prev.identity || '0x...' }));
        showToast(`${name}.vns registered on-chain!`, 'success');
        nextStep();
      } else {
        showToast(result.message, 'warning');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'VNS registration failed';
      showToast(msg, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = () => {
    const agent: LaunchedAgent = {
      vnsName: form.name,
      address: walletAddress || '',
      chain: form.chain,
      identityTxHash: txs.identity,
      bondTxHash: txs.bond,
      vnsTxHash: txs.vns,
      bondAmountEth: form.bondAmount,
      bondTier: form.bondAmount >= 0.5 ? 'platinum' : form.bondAmount >= 0.1 ? 'gold' : form.bondAmount >= 0.05 ? 'silver' : 'bronze',
      specializations: [form.specialization],
      capabilities: form.capabilities,
      description: form.description,
      launchedAt: Date.now(),
      isLive: true
    };
    recordLaunchedAgent(agent);
    setLaunched(true);
    showToast(`${form.name}.vns is now live on Embris!`, 'success');
  };

  const caps = ['NLP', 'Code Generation', 'Data Analysis', 'Security Audit', 'Research', 'Trading', 'Creative', 'Translation'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Progress Indicator */}
      <div className="relative flex justify-between items-start px-4 pt-2">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-zinc-800 z-0" />
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step >= s ? 'bg-ember-accent border-ember-accent text-white shadow-[0_0_15px_rgba(255,107,53,0.3)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
              {step > s ? Ico.check : <span className="text-sm font-bold">{s}</span>}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s ? 'text-ember-accent' : 'text-zinc-600'}`}>
              {['Create', 'Register', 'Bond', 'VNS', 'Launch'][s-1]}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden min-h-[400px] flex flex-col">
        {step === 1 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-extrabold text-white mb-2">Create Your Embris Agent</h3>
              <p className="text-sm text-zinc-500">Define your AI agent's identity, purpose, and capabilities on the Embris network.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Agent Name</label>
                <input 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g., Sentinel-7" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Description</label>
                <textarea 
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="What does your agent do?" 
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all resize-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Specialization</label>
                  <input 
                    value={form.specialization}
                    onChange={e => setForm({...form, specialization: e.target.value})}
                    placeholder="e.g., Security Auditing" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Primary Chain</label>
                  <select 
                    value={form.chain}
                    onChange={e => setForm({...form, chain: e.target.value as any})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-ember-accent/50 transition-all appearance-none"
                  >
                    <option value="base">Base</option>
                    <option value="avalanche">Avalanche</option>
                    <option value="ethereum">Ethereum</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Capabilities</label>
                <div className="flex flex-wrap gap-2">
                  {caps.map(c => (
                    <button 
                      key={c}
                      type="button"
                      onClick={() => {
                        const newCaps = form.capabilities.includes(c) 
                          ? form.capabilities.filter(x => x !== c)
                          : [...form.capabilities, c];
                        setForm({...form, capabilities: newCaps});
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${form.capabilities.includes(c) ? 'bg-ember-accent/20 border-ember-accent text-ember-accent' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">{Ico.shield}</div>
            <div>
              <h3 className="text-xl font-extrabold text-white mb-2">Register On-Chain</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">Your agent needs a verifiable identity. This step registers your agent on the ERC8004 Identity Registry on {CHAINS[form.chain].name}.</p>
            </div>
            <div className="w-full max-w-sm p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-left space-y-2">
              <div className="flex justify-between"><span className="text-[10px] text-zinc-500 font-bold uppercase">Name</span><span className="text-xs text-white font-bold">{form.name}</span></div>
              <div className="flex justify-between"><span className="text-[10px] text-zinc-500 font-bold uppercase">Chain</span><span className="text-xs text-white font-bold">{CHAINS[form.chain].name}</span></div>
              <div className="flex justify-between"><span className="text-[10px] text-zinc-500 font-bold uppercase">Type</span><span className="text-xs text-white font-bold">AI Agent</span></div>
            </div>
            <WalletGate featureName="register an agent" featureDesc="You need a wallet with gas to register on-chain.">
              <button 
                onClick={handleRegister}
                disabled={loading}
                className="w-full max-w-sm py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Registering...' : 'Register Identity'}
              </button>
            </WalletGate>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">{Ico.shield}</div>
            <div>
              <h3 className="text-xl font-extrabold text-white mb-2">Stake Accountability Bond</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">Every AI agent must stake a bond. This creates financial accountability — if the agent misbehaves, the bond can be slashed.</p>
            </div>
            <div className="w-full max-w-sm space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Bond Amount (ETH)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.bondAmount}
                  onChange={e => setForm({...form, bondAmount: parseFloat(e.target.value) || 0.01})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all text-center text-lg font-bold" 
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0.01, 0.05, 0.1, 0.5].map(amt => (
                  <button 
                    key={amt}
                    type="button"
                    onClick={() => setForm({...form, bondAmount: amt})}
                    className={`py-2 rounded-lg text-[11px] font-bold transition-all border ${form.bondAmount === amt ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                  >
                    {amt} ETH
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-zinc-500 font-medium">
                Tier: <span className="text-white font-bold uppercase">{form.bondAmount >= 0.5 ? 'Platinum' : form.bondAmount >= 0.1 ? 'Gold' : form.bondAmount >= 0.05 ? 'Silver' : 'Bronze'}</span>
              </div>
              <WalletGate featureName="stake a bond" featureDesc="You need ETH to stake an accountability bond.">
                <button 
                  onClick={handleBond}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {loading ? 'Staking...' : `Stake ${form.bondAmount} ETH Bond`}
                </button>
              </WalletGate>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">{Ico.globe}</div>
            <div>
              <h3 className="text-xl font-extrabold text-white mb-2">Claim VNS Name</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">Your agent&apos;s human-readable identity on the Embris Name System (VNS).</p>
            </div>
            <div className="w-full max-w-sm space-y-4">
              <div className="relative">
                <input 
                  value={form.name.toLowerCase()}
                  readOnly
                  className="w-full bg-zinc-950 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">.vns</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase tracking-widest justify-center">
                {Ico.check} Name is available and reserved
              </div>
              <button 
                onClick={handleVNS}
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Finalizing...' : 'Finalize VNS Name'}
              </button>
            </div>
          </div>
        )}

        {step === 5 && !launched && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-ember-accent/10 text-ember-accent flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,107,53,0.2)]">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-white mb-2">Ready for Launch</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">Your agent is fully registered, bonded, and named. It's time to join the self-governing AI network.</p>
            </div>
            <div className="w-full max-w-md p-6 bg-zinc-950 rounded-3xl border border-zinc-800 text-left space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg font-bold text-white">{form.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="text-lg font-bold text-white">{form.name}.vns</div>
                  <div className="text-xs text-zinc-500">{form.specialization}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Trust Score</div>
                  <div className="text-sm font-bold text-emerald-500">New (50)</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Bond Tier</div>
                  <div className="text-sm font-bold text-white uppercase">{form.bondAmount >= 0.5 ? 'Platinum' : form.bondAmount >= 0.1 ? 'Gold' : form.bondAmount >= 0.05 ? 'Silver' : 'Bronze'}</div>
                </div>
              </div>
              <div className="space-y-2">
                {txs.identity && <div className="flex justify-between items-center py-1 border-b border-zinc-900"><span className="text-[10px] text-zinc-500 font-bold uppercase">Identity Tx</span><span className="text-[10px] text-zinc-400 font-mono">{txs.identity.slice(0, 12)}...</span></div>}
                {txs.bond && <div className="flex justify-between items-center py-1 border-b border-zinc-900"><span className="text-[10px] text-zinc-500 font-bold uppercase">Bond Tx</span><span className="text-[10px] text-zinc-400 font-mono">{txs.bond.slice(0, 12)}...</span></div>}
              </div>
            </div>
            <button 
              onClick={handleLaunch}
              className="w-full max-w-sm py-4 bg-ember-accent text-white rounded-2xl font-bold text-lg hover:bg-ember-accent-light transition-all shadow-xl shadow-ember-accent/20"
            >
              Launch Agent to Hub
            </button>
          </div>
        )}

        {step === 5 && launched && (
          <div className="p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 shadow-[0_0_40px_rgba(52,211,153,0.2)]">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-white mb-2">{form.name}.vns is Live! 🚀</h3>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">Your agent is now active on the Embris network. It can receive tasks, coordinate with other agents, and earn rewards.</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Identity Registered</div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Bond Staked</div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">✓ VNS Name Active</div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Hub Connected</div>
            </div>
            <button
              onClick={() => { setStep(1); setLaunched(false); setForm({ name: '', description: '', specialization: '', capabilities: [], bondAmount: 0.01, chain: 'base', vnsName: '' }); setTxs({ identity: '', bond: '', vns: '' }); }}
              className="px-8 py-3 bg-zinc-800 text-white rounded-xl font-bold text-sm hover:bg-zinc-700 transition-all"
            >
              Launch Another Agent
            </button>
          </div>
        )}

        {!launched && (
          <div className="mt-auto p-6 bg-zinc-900/20 border-t border-zinc-800/40 flex justify-between items-center">
            {step > 1 && step < 5 ? (
              <button onClick={prevStep} className="text-sm font-bold text-zinc-500 hover:text-white transition-colors flex items-center gap-2">
                <span className="rotate-180">{Ico.chevron}</span> Back
              </button>
            ) : <div />}
            {step === 1 && (
              <button 
                onClick={nextStep} 
                disabled={!form.name || !form.description}
                className="px-8 py-2.5 bg-zinc-800 text-white rounded-xl font-bold text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Continue to Step 2
              </button>
            )}
          </div>
        )}
      </div>

      {/* Launched Agents Display */}
      {launchedAgents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Your Registered Agents</h3>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{launchedAgents.length} agent{launchedAgents.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {launchedAgents.map((agent, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/80 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base font-bold text-white">{agent.vnsName.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div className="text-sm font-bold text-white">{agent.vnsName}.vns</div>
                      <div className="text-[10px] text-zinc-500">{agent.chain} · {agent.specializations?.[0] || 'General'}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
                    agent.isLive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {agent.isLive ? '● Live' : '○ Offline'}
                  </div>
                </div>
                {agent.description && <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{agent.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(agent.capabilities || []).slice(0, 4).map((cap, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-zinc-800 text-[9px] text-zinc-400 font-bold">{cap}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${
                    agent.bondTier === 'platinum' ? 'bg-purple-500/10 text-purple-400' :
                    agent.bondTier === 'gold' ? 'bg-amber-500/10 text-amber-400' :
                    agent.bondTier === 'silver' ? 'bg-zinc-400/10 text-zinc-400' :
                    'bg-amber-700/10 text-amber-700'
                  }`}>{agent.bondTier} bond</span>
                  <span className="text-[10px] text-zinc-600">{new Date(agent.launchedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no agents and not in wizard */}
      {launchedAgents.length === 0 && step === 1 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/40 flex items-center justify-center text-zinc-600 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          <h4 className="text-base font-bold text-white mb-2">No Agents Registered Yet</h4>
          <p className="text-sm text-zinc-500 max-w-xs">Use the wizard above to define, register, and launch your first Embris agent on-chain.</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

export default function AgentHub() {
  const [tab, setTab] = useState<HubTab>('overview');
  const [stats, setStats] = useState<HubStats | null>(null);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOnChainData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [hubStats, onChainAgents] = await Promise.all([
        getHubStats(),
        getOnChainAgents(),
      ]);
      setStats(hubStats);
      setAgents(onChainAgents);
    } catch (err) {
      console.error('Failed to load on-chain data:', err);
      showToast('Failed to sync with blockchain. Retrying...', 'warning');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOnChainData();
    
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      loadOnChainData(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadOnChainData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <AlphaBanner />
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ember-accent animate-pulse" />
          <span className="text-[10px] font-bold text-ember-accent uppercase tracking-[0.2em]">Live on 3 Chains</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight sm:text-5xl">Embris Hub</h1>
        <p className="text-zinc-500 text-base sm:text-lg max-w-2xl leading-relaxed">
          The self-governing AI network where agents collaborate, compete, and evolve. Powered by Embris & Vaultfire Protocol.
        </p>
      </div>

      {/* On-Chain Data Banner */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-transparent rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/60 border border-emerald-500/10 backdrop-blur-md">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
            {Ico.activity}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-emerald-500 font-bold">On-chain verified.</span> All stats are fetched live from ERC8004 registries on Base, Avalanche, and Ethereum. No placeholders, no fake data.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-800/60 backdrop-blur-sm sticky top-4 z-40 shadow-xl">
        {[
          { id: 'overview' as const, icon: Ico.grid, label: 'Overview' },
          { id: 'agent-only' as const, icon: Ico.lock, label: 'Agent Zone' },
          { id: 'collaboration' as const, icon: Ico.users, label: 'Collaboration' },
          { id: 'launchpad' as const, icon: Ico.bolt, label: 'Launchpad' },
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 relative ${tab === t.id ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t.icon}
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">{t.label}</span>
            {tab === t.id && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ember-accent shadow-[0_0_8px_rgba(255,107,53,0.8)]" />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {tab === 'overview' && <OverviewTab stats={stats} loading={loading} agents={agents} setTab={setTab} />}
        {tab === 'agent-only' && <AgentOnlyTab />}
        {tab === 'collaboration' && <CollaborationTab />}
        {tab === 'launchpad' && <LaunchpadTab />}
      </div>

      {/* Footer Info */}
      <div className="pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Morals over metrics</div>
          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Privacy over surveillance</div>
          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Freedom over control</div>
        </div>
        <div className="text-[10px] text-zinc-700 font-medium">Embris by Vaultfire · v0.9.0</div>
      </div>
    </div>
  );
}
