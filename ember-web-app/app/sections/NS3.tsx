'use client';

import { useState } from 'react';
import { CHAINS, ALL_CONTRACTS } from '../lib/contracts';
import DisclaimerBanner from '../components/DisclaimerBanner';

type ProofType = 'identity' | 'reputation' | 'compliance' | 'attestation' | 'privacy';
type ProofStatus = 'pending' | 'generating' | 'verified' | 'failed';

interface ZKProof {
  id: string;
  type: ProofType;
  title: string;
  description: string;
  status: ProofStatus;
  chain: 'ethereum' | 'base' | 'avalanche';
  txHash?: string;
  timestamp: string;
  verifier: string;
  proofHash?: string;
}

const PROOF_TYPES: { type: ProofType; label: string; icon: string; description: string; color: string }[] = [
  { type: 'identity', label: 'Identity Proof', icon: '🪪', description: 'Prove your on-chain identity without revealing private data. Verify you are registered on ERC8004IdentityRegistry.', color: 'border-blue-500/20 hover:border-blue-500/40' },
  { type: 'reputation', label: 'Reputation Proof', icon: '⭐', description: 'Prove your trust score exceeds a threshold without revealing the exact score. Uses ERC8004ReputationRegistry.', color: 'border-emerald-500/20 hover:border-emerald-500/40' },
  { type: 'compliance', label: 'Compliance Proof', icon: '✅', description: 'Prove an AI agent meets ethical compliance standards without exposing internal audit data.', color: 'border-amber-500/20 hover:border-amber-500/40' },
  { type: 'attestation', label: 'Belief Attestation', icon: '🔐', description: 'Prove value alignment through the BeliefAttestationVerifier without revealing belief parameters.', color: 'border-purple-500/20 hover:border-purple-500/40' },
  { type: 'privacy', label: 'Privacy Proof', icon: '🛡️', description: 'Prove consent status through PrivacyGuarantees without revealing consent details.', color: 'border-red-500/20 hover:border-red-500/40' },
];

const MOCK_PROOFS: ZKProof[] = [
  { id: 'p1', type: 'identity', title: 'Identity Verification — ghostkey316.vns', description: 'Proved human identity registration on ERC8004 without revealing wallet address.', status: 'verified', chain: 'base', txHash: '0x7a3f...e2c1', timestamp: '2026-02-22 14:30', verifier: 'BeliefAttestationVerifier', proofHash: '0xabc123...def456' },
  { id: 'p2', type: 'reputation', title: 'Trust Score Threshold — sentinel-7.vns', description: 'Proved trust score > 90% without revealing exact score.', status: 'verified', chain: 'ethereum', txHash: '0x9b2d...f4a8', timestamp: '2026-02-22 13:15', verifier: 'ERC8004ReputationRegistry', proofHash: '0x789abc...123def' },
  { id: 'p3', type: 'compliance', title: 'Ethical Compliance — ns3-alpha.vns', description: 'Proved compliance with Vaultfire ethical standards.', status: 'verified', chain: 'base', txHash: '0x3c8e...a1b7', timestamp: '2026-02-22 12:00', verifier: 'ERC8004ValidationRegistry', proofHash: '0xdef789...abc012' },
  { id: 'p4', type: 'attestation', title: 'Value Alignment Check', description: 'Generating belief attestation proof...', status: 'generating', chain: 'avalanche', timestamp: '2026-02-22 14:45', verifier: 'BeliefAttestationVerifier' },
];

export default function NS3() {
  const [selectedType, setSelectedType] = useState<ProofType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [proofChain, setProofChain] = useState<'ethereum' | 'base' | 'avalanche'>('base');
  const [proofParam, setProofParam] = useState('');
  const [proofs, setProofs] = useState<ZKProof[]>(MOCK_PROOFS);

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    const newProof: ZKProof = {
      id: `p${Date.now()}`,
      type: selectedType,
      title: `${PROOF_TYPES.find(p => p.type === selectedType)?.label} — New Proof`,
      description: 'Generating zero-knowledge proof using RISC Zero zkVM...',
      status: 'generating',
      chain: proofChain,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      verifier: 'BeliefAttestationVerifier',
    };
    setProofs(prev => [newProof, ...prev]);

    // Simulate ZK proof generation
    await new Promise(r => setTimeout(r, 3000));
    setProofs(prev => prev.map(p => p.id === newProof.id ? {
      ...p,
      status: 'verified' as ProofStatus,
      description: 'Zero-knowledge proof verified on-chain.',
      txHash: `0x${Array.from({ length: 8 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}...`,
      proofHash: `0x${Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}...`,
    } : p));
    setGenerating(false);
    setSelectedType(null);
    setProofParam('');
  };

  const statusConfig: Record<ProofStatus, { color: string; label: string; icon: string }> = {
    pending: { color: 'text-zinc-400 bg-zinc-500/10', label: 'Pending', icon: '⏳' },
    generating: { color: 'text-amber-400 bg-amber-500/10', label: 'Generating', icon: '⚡' },
    verified: { color: 'text-emerald-400 bg-emerald-500/10', label: 'Verified', icon: '✓' },
    failed: { color: 'text-red-400 bg-red-500/10', label: 'Failed', icon: '✗' },
  };

  return (
    <div className="page-enter p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">NS3 — Zero-Knowledge Proofs</h1>
        <p className="text-sm text-zinc-400 mt-1">Generate and verify ZK proofs using RISC Zero zkVM. Prove facts without revealing data.</p>
      </div>

      <DisclaimerBanner disclaimerKey="zk_proofs" />

      {/* Architecture Overview */}
      <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-5 mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
            <div className="text-2xl mb-1">📝</div>
            <div className="text-sm font-medium text-white">1. Claim</div>
            <div className="text-xs text-zinc-400 mt-1">Define what you want to prove (identity, reputation, compliance)</div>
          </div>
          <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-sm font-medium text-white">2. Generate</div>
            <div className="text-xs text-zinc-400 mt-1">RISC Zero zkVM generates a cryptographic proof off-chain</div>
          </div>
          <div className="rounded-lg bg-zinc-900/50 p-3 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-sm font-medium text-white">3. Verify</div>
            <div className="text-xs text-zinc-400 mt-1">Proof verified on-chain through BeliefAttestationVerifier</div>
          </div>
        </div>
      </div>

      {/* Generate New Proof */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Generate Proof</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {PROOF_TYPES.map(pt => (
            <button key={pt.type} onClick={() => setSelectedType(pt.type)} className={`text-left rounded-xl bg-zinc-800/60 border p-4 transition-all ${selectedType === pt.type ? 'border-blue-500/50 bg-zinc-800/80' : pt.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{pt.icon}</span>
                <span className="text-sm font-medium text-white">{pt.label}</span>
                {selectedType === pt.type && <svg className="w-4 h-4 text-blue-400 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </div>
              <p className="text-xs text-zinc-400">{pt.description}</p>
            </button>
          ))}
        </div>

        {selectedType && (
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-5 space-y-4">
            <h4 className="text-white font-medium">Configure {PROOF_TYPES.find(p => p.type === selectedType)?.label}</h4>

            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Verification Chain</label>
              <div className="flex gap-2">
                {(['ethereum', 'base', 'avalanche'] as const).map(c => (
                  <button key={c} onClick={() => setProofChain(c)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${proofChain === c ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-white'}`}>
                    {CHAINS[c].name}
                  </button>
                ))}
              </div>
            </div>

            {selectedType === 'reputation' && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Minimum Trust Score Threshold</label>
                <input type="number" value={proofParam} onChange={e => setProofParam(e.target.value)} placeholder="e.g., 90" className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors" />
                <p className="text-xs text-zinc-500 mt-1">Proves your score exceeds this threshold without revealing the exact number.</p>
              </div>
            )}

            <div className="rounded-lg bg-zinc-900/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Proof System:</span><span className="text-white">RISC Zero zkVM</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Verifier Contract:</span><span className="text-zinc-300 text-xs font-mono">BeliefAttestationVerifier</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Chain:</span><span className="text-white">{CHAINS[proofChain].name}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Est. Gas:</span><span className="text-zinc-300">~200,000</span></div>
            </div>

            <button onClick={handleGenerate} disabled={generating} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold transition-all">
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Generating ZK Proof...
                </span>
              ) : 'Generate Proof'}
            </button>
          </div>
        )}
      </div>

      {/* Proof History */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Proof History</h3>
        <div className="space-y-3">
          {proofs.map(proof => {
            const sc = statusConfig[proof.status];
            return (
              <div key={proof.id} className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{proof.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full ${sc.color} text-xs px-2 py-0.5 font-medium`}>
                        {proof.status === 'generating' ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <span>{sc.icon}</span>}
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{proof.description}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium ${proof.chain === 'ethereum' ? 'text-indigo-400 bg-indigo-500/10' : proof.chain === 'base' ? 'text-cyan-400 bg-cyan-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {CHAINS[proof.chain].name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span>{proof.timestamp}</span>
                  <span>Verifier: {proof.verifier}</span>
                  {proof.txHash && (
                    <a href={`${CHAINS[proof.chain].explorerUrl}/tx/${proof.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                      TX: {proof.txHash}
                    </a>
                  )}
                  {proof.proofHash && <span className="font-mono">Proof: {proof.proofHash}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contracts Reference */}
      <div className="mt-6 rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">ZK Verification Contracts</h4>
        <div className="space-y-1.5">
          {ALL_CONTRACTS.filter(c => c.name.includes('Attestation') || c.name.includes('Validation')).map(c => (
            <div key={`${c.chain}-${c.name}`} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{c.name} ({CHAINS[c.chain].name})</span>
              <a href={`${CHAINS[c.chain].explorerUrl}/address/${c.address}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-mono transition-colors">
                {c.address.slice(0, 8)}...{c.address.slice(-6)}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
