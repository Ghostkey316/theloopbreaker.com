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
    <div className="p-8 max-w-4xl mx-auto fade-in">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🛡️🔥</div>
        <h1 className="text-4xl font-bold text-ember-text mb-3">Vaultfire Protocol</h1>
        <p className="text-lg text-ember-text-muted max-w-xl mx-auto leading-relaxed">
          Ethical AI governance on-chain. Powered by Ember AI.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ember-surface border border-ember-surface-light">
          <span className="text-sm text-ember-accent font-medium">theloopbreaker.com</span>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-semibold text-ember-text-muted uppercase tracking-widest mb-4">Core Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {coreValues.map((value, i) => (
            <div key={i} className="bg-ember-surface border border-ember-surface-light rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{['⚖️', '🔒', '🗽'][i]}</div>
              <p className="text-sm font-medium text-ember-text">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-semibold text-ember-text-muted uppercase tracking-widest mb-4">Network Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chains.map((chain) => (
            <div key={chain.name} className="bg-ember-surface border border-ember-surface-light rounded-xl p-5"
              style={{ borderLeftColor: chain.color, borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-ember-text">{chain.name}</h3>
                  <p className="text-xs text-ember-text-muted">Chain ID: {chain.chainId}</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: chain.loading ? '#F59E0B20' : chain.result?.success ? '#22C55E20' : '#EF444420',
                    color: chain.loading ? '#F59E0B' : chain.result?.success ? '#22C55E' : '#EF4444',
                  }}>
                  {chain.loading ? 'Checking...' : chain.result?.success ? 'Connected' : 'Offline'}
                </span>
              </div>
              {!chain.loading && chain.result?.success && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-ember-surface-light rounded-lg p-2">
                    <p className="text-xs text-ember-text-muted">Block</p>
                    <p className="text-sm font-mono text-ember-text">{chain.result.blockNumber?.toLocaleString()}</p>
                  </div>
                  <div className="bg-ember-surface-light rounded-lg p-2">
                    <p className="text-xs text-ember-text-muted">Latency</p>
                    <p className="text-sm font-mono text-ember-text">{chain.result.latency}ms</p>
                  </div>
                  <div className="bg-ember-surface-light rounded-lg p-2">
                    <p className="text-xs text-ember-text-muted">Contracts</p>
                    <p className="text-sm font-mono text-ember-accent">{chain.contractCount}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ember-text-muted uppercase tracking-widest mb-4">Protocol Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '🔗', label: 'Contracts', value: '28', sub: '14 per chain' },
            { icon: '⛓️', label: 'Chains', value: '2', sub: 'Base + Avalanche' },
            { icon: '🤖', label: 'Standard', value: 'ERC-8004', sub: 'AI Identity' },
            { icon: '🌉', label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain' },
          ].map((item) => (
            <div key={item.label} className="bg-ember-surface border border-ember-surface-light rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-lg font-bold text-ember-accent">{item.value}</p>
              <p className="text-xs font-medium text-ember-text">{item.label}</p>
              <p className="text-xs text-ember-text-muted">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
