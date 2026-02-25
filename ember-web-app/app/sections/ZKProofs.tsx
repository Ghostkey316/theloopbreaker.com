'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CHAINS } from '../lib/contracts';
import DisclaimerBanner, { AlphaBanner } from '../components/DisclaimerBanner';
import { showToast } from '../components/Toast';
import {
  generateTrustLevelProof,
  generateVNSOwnershipProof,
  generateBondStatusProof,
  generateIdentityProof,
  verifyProofByHash,
  verifyProofFromJson,
  getProofHistory,
  deleteProof,
  isProofExpired,
  formatProofAge,
  formatTimeRemaining,
  getMyProofContext,
  type ZKProof,
  type ZKProofType,
  type ZKChain,
  type ZKVerifyResult,
} from '../lib/zk-proofs';
import type { BondTier } from '../lib/vns';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type ProofTab = 'overview' | 'generate' | 'verify' | 'history';

/* ─────────────────────────────────────────────
   Utility Components
   ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: ZKProof['status'] }) {
  const config: Record<ZKProof['status'], { color: string; label: string }> = {
    generating: { color: 'text-amber-400 bg-amber-500/10 border border-amber-500/20', label: 'Generating…' },
    ready:      { color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20', label: 'Ready' },
    verified:   { color: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20', label: 'Verified' },
    failed:     { color: 'text-red-400 bg-red-500/10 border border-red-500/20', label: 'Failed' },
    expired:    { color: 'text-zinc-500 bg-zinc-800 border border-zinc-700', label: 'Expired' },
  };
  const c = config[status] || config.ready;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${c.color} text-xs px-2 py-0.5 font-medium`}>
      {status === 'generating' && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
      {status === 'verified' && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      {status === 'failed' && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>}
      {c.label}
    </span>
  );
}

function ChainSelector({ value, onChange }: { value: ZKChain; onChange: (c: ZKChain) => void }) {
  return (
    <div className="flex gap-2">
      {(['base', 'avalanche', 'ethereum'] as ZKChain[]).map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${value === c ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-600'}`}
        >
          {CHAINS[c].name}
        </button>
      ))}
    </div>
  );
}

function ProofCard({ proof, onDelete, onCopy }: {
  proof: ZKProof;
  onDelete: (id: string) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const expired = isProofExpired(proof);
  const displayStatus: ZKProof['status'] = expired ? 'expired' : proof.status;

  const typeLabels: Record<ZKProofType, string> = {
    trust_level:   'Trust Level',
    vns_ownership: 'VNS Ownership',
    bond_status:   'Bond Status',
    identity:      'Identity',
  };

  const typeColors: Record<ZKProofType, string> = {
    trust_level:   'text-emerald-400',
    vns_ownership: 'text-blue-400',
    bond_status:   'text-amber-400',
    identity:      'text-purple-400',
  };

  return (
    <div className={`rounded-xl bg-zinc-800/60 border ${expired ? 'border-zinc-700/20 opacity-60' : 'border-zinc-700/40'} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-sm font-semibold ${typeColors[proof.type]}`}>{typeLabels[proof.type]}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{proof.description}</div>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {/* Proof Hash */}
      <div>
        <div className="text-xs text-zinc-500 mb-1">Proof Hash</div>
        <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-2">
          <code className="text-xs text-zinc-300 font-mono flex-1 truncate">{proof.proofHash}</code>
          <button
            onClick={() => onCopy(proof.proofHash, 'Proof hash')}
            className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
            title="Copy proof hash"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Chain</span>
          <span className="text-zinc-300">{CHAINS[proof.publicInputs.chain].name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Generated</span>
          <span className="text-zinc-300">{formatProofAge(proof)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Expires</span>
          <span className={expired ? 'text-red-400' : 'text-zinc-300'}>{formatTimeRemaining(proof)}</span>
        </div>
        {proof.onChainVerified !== undefined && (
          <div className="flex justify-between">
            <span className="text-zinc-500">On-Chain</span>
            <span className={proof.onChainVerified ? 'text-emerald-400' : 'text-zinc-500'}>
              {proof.onChainVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {proof.shareableJson && !expired && (
          <button
            onClick={() => onCopy(proof.shareableJson!, 'Proof JSON')}
            className="flex-1 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-medium transition-all border border-purple-500/20"
          >
            Copy Shareable JSON
          </button>
        )}
        <button
          onClick={() => onDelete(proof.id)}
          className="py-2 px-3 rounded-lg bg-zinc-700/30 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 text-xs font-medium transition-all border border-zinc-700/30"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Overview Tab
   ───────────────────────────────────────────── */
function ZKOverview({ ctx }: { ctx: ReturnType<typeof getMyProofContext> }) {
  const proofTypes = [
    {
      type: 'trust_level' as const,
      title: 'Trust Level Proof',
      desc: 'Prove your trust score meets a threshold (e.g. ≥ 75) without revealing your exact score or history.',
      claim: 'trust_gte_N',
      icon: <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      available: ctx.hasVNS,
      unavailableReason: 'Register a VNS identity first',
    },
    {
      type: 'vns_ownership' as const,
      title: 'VNS Ownership Proof',
      desc: 'Prove you own a .vns name without revealing which name or your wallet address.',
      claim: 'vns_owner',
      icon: <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>,
      available: ctx.hasVNS && !!ctx.address,
      unavailableReason: 'Register a VNS identity with a wallet first',
    },
    {
      type: 'bond_status' as const,
      title: 'Bond Status Proof',
      desc: 'Prove your bond meets a minimum tier (e.g. ≥ Silver) without revealing the exact amount.',
      claim: 'bond_gte_TIER',
      icon: <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
      available: ctx.hasVNS && !!ctx.bondTier,
      unavailableReason: 'Post a bond to generate bond status proofs',
    },
    {
      type: 'identity' as const,
      title: 'Identity Registration Proof',
      desc: 'Prove you are registered on ERC8004 without revealing your wallet address or identity type.',
      claim: 'erc8004_registered',
      icon: <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      available: ctx.hasVNS && !!ctx.address,
      unavailableReason: 'Connect a wallet and register a VNS identity first',
    },
  ];

  return (
    <div className="space-y-6">
      {/* What are ZK Proofs */}
      <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-5">
        <h3 className="text-lg font-semibold text-white mb-2">Zero-Knowledge Proofs on Embris</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Zero-knowledge proofs let you prove a claim is true without revealing the underlying data.
          Embris uses a RISC Zero zkVM-compatible circuit model to generate proofs for trust scores,
          VNS identity, bond status, and ERC8004 registration — all without exposing private information.
          Proofs are cryptographic commitments that can be verified on-chain through the
          BeliefAttestationVerifier contracts deployed across Ethereum, Base, and Avalanche.
        </p>
      </div>

      {/* Your Context */}
      {ctx.hasVNS ? (
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4">
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Your Proof Context</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">VNS Identity</div>
              <div className="text-sm font-medium text-blue-400">{ctx.vnsName}</div>
            </div>
            <div className="bg-zinc-900/60 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Trust Score</div>
              <div className="text-sm font-medium text-emerald-400">{ctx.trustScore ?? '—'}/100</div>
            </div>
            <div className="bg-zinc-900/60 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Bond Tier</div>
              <div className="text-sm font-medium text-amber-400 capitalize">{ctx.bondTier || 'None'}</div>
            </div>
            <div className="bg-zinc-900/60 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Identity Type</div>
              <div className="text-sm font-medium text-purple-400 capitalize">{ctx.identityType || '—'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-sm font-semibold text-amber-400">No VNS Identity Found</span>
          </div>
          <p className="text-xs text-zinc-400">Register a VNS identity in the VNS section to generate proofs. Your proof context (trust score, bond tier, identity type) is derived from your VNS profile.</p>
        </div>
      )}

      {/* Proof Types */}
      <div>
        <h3 className="text-base font-semibold text-white mb-3">Available Proof Types</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {proofTypes.map(p => (
            <div key={p.type} className={`rounded-xl bg-zinc-800/40 border ${p.available ? 'border-zinc-700/30' : 'border-zinc-700/20 opacity-70'} p-4`}>
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-zinc-700/30 flex items-center justify-center flex-shrink-0 mt-0.5">{p.icon}</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{p.title}</h4>
                  <code className="text-xs text-zinc-500 font-mono">{p.claim}</code>
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-2">{p.desc}</p>
              {!p.available && (
                <div className="text-xs text-amber-400/70 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                  {p.unavailableReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-zinc-300">How It Works</h4>
        <div className="space-y-2">
          {[
            { step: '1', label: 'Generate', desc: 'Select a proof type. Your private data (score, name, tier) is hashed with a random nonce — never exposed.' },
            { step: '2', label: 'Commit', desc: 'A cryptographic commitment is produced: SHA-256(privateInputs + publicClaim + chain + timestamp).' },
            { step: '3', label: 'Share', desc: 'Share the proof hash or JSON with anyone. They can verify the claim without learning your private data.' },
            { step: '4', label: 'Verify On-Chain', desc: 'The BeliefAttestationVerifier contract on Base, Avalanche, or Ethereum confirms the proof is valid.' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.step}</div>
              <div>
                <div className="text-xs font-semibold text-white">{s.label}</div>
                <div className="text-xs text-zinc-400">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent API Note */}
      <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4">
        <h4 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
          AI Agent API
        </h4>
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          AI agents can generate and verify proofs programmatically via the Embris SDK:
        </p>
        <pre className="text-xs text-zinc-300 font-mono bg-zinc-900/60 rounded-lg p-3 overflow-x-auto">{`// Generate a trust level proof
const result = await embris.zk.generate({
  type: 'trust_level',
  chain: 'base',
  params: { threshold: 75 }
});

// Verify a proof
const valid = await embris.zk.verify({
  proofHash: result.proofHash,
  chain: 'base'
});`}</pre>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Generate Tab
   ───────────────────────────────────────────── */
function ZKGenerate({ ctx, onProofGenerated }: {
  ctx: ReturnType<typeof getMyProofContext>;
  onProofGenerated: () => void;
}) {
  const [proofType, setProofType] = useState<ZKProofType>('trust_level');
  const [chain, setChain] = useState<ZKChain>('base');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ZKProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmitOnChain = async (proofHash: string) => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await verifyProofByHash(proofHash, chain);
      if (res.valid) {
        setSubmitResult({ success: true, message: `Proof verified on-chain via BeliefAttestationVerifier on ${CHAINS[chain].name}.` });
        showToast('Proof submitted and verified on-chain!', 'success');
      } else {
        setSubmitResult({ success: false, message: res.error || 'On-chain verification failed.' });
        showToast(res.error || 'On-chain verification failed.', 'warning');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submission failed.';
      setSubmitResult({ success: false, message: msg });
      showToast(msg, 'warning');
    }
    setSubmitting(false);
  };

  // Type-specific params
  const [trustThreshold, setTrustThreshold] = useState(50);
  const [bondMinTier, setBondMinTier] = useState<BondTier>('bronze');

  const proofTypes: { id: ZKProofType; label: string; desc: string; available: boolean; reason?: string }[] = [
    {
      id: 'trust_level',
      label: 'Trust Level',
      desc: 'Prove trust score ≥ threshold',
      available: ctx.hasVNS,
      reason: ctx.hasVNS ? undefined : 'Requires VNS identity',
    },
    {
      id: 'vns_ownership',
      label: 'VNS Ownership',
      desc: 'Prove you own a .vns name',
      available: ctx.hasVNS && !!ctx.address,
      reason: (!ctx.hasVNS || !ctx.address) ? 'Requires VNS + wallet' : undefined,
    },
    {
      id: 'bond_status',
      label: 'Bond Status',
      desc: 'Prove bond ≥ minimum tier',
      available: ctx.hasVNS && !!ctx.bondTier,
      reason: (!ctx.hasVNS || !ctx.bondTier) ? 'Requires active bond' : undefined,
    },
    {
      id: 'identity',
      label: 'Identity',
      desc: 'Prove ERC8004 registration',
      available: ctx.hasVNS && !!ctx.address,
      reason: (!ctx.hasVNS || !ctx.address) ? 'Requires VNS + wallet' : undefined,
    },
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      let res;
      switch (proofType) {
        case 'trust_level':
          res = await generateTrustLevelProof({
            threshold: trustThreshold,
            actualScore: ctx.trustScore ?? 0,
            chain,
          });
          break;
        case 'vns_ownership':
          res = await generateVNSOwnershipProof({
            vnsName: ctx.vnsName || '',
            walletAddress: ctx.address || '',
            chain,
          });
          break;
        case 'bond_status':
          res = await generateBondStatusProof({
            minimumTier: bondMinTier,
            actualTier: ctx.bondTier || 'bronze',
            actualAmountEth: parseFloat(ctx.bondAmount || '0'),
            chain,
          });
          break;
        case 'identity':
          res = await generateIdentityProof({
            walletAddress: ctx.address || '',
            identityType: (ctx.identityType as 'human' | 'agent' | 'companion') || 'human',
            chain,
          });
          break;
        default:
          res = { success: false, error: 'Unknown proof type' };
      }

      if (res.success && res.proof) {
        setResult(res.proof);
        showToast('Zero-knowledge proof generated successfully.', 'success');
        onProofGenerated();
      } else {
        setError(res.error || 'Proof generation failed.');
        showToast(res.error || 'Proof generation failed.', 'warning');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error during proof generation.';
      setError(msg);
      showToast(msg, 'warning');
    }

    setGenerating(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(`${label} copied to clipboard.`, 'success'));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Generate ZK Proof</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Select a proof type and chain. Your private data is never exposed — only a cryptographic commitment is produced.
          </p>
        </div>

        {!ctx.hasVNS && (
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3 text-xs text-amber-300">
            No VNS identity found. Register a VNS identity to unlock proof generation.
          </div>
        )}

        {/* Proof Type */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Proof Type</label>
          <div className="space-y-2">
            {proofTypes.map(pt => (
              <button
                key={pt.id}
                onClick={() => { if (pt.available) { setProofType(pt.id); setResult(null); setError(null); } }}
                disabled={!pt.available}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                  proofType === pt.id && pt.available
                    ? 'bg-purple-500/15 border border-purple-500/30'
                    : pt.available
                    ? 'bg-zinc-900 border border-zinc-700 hover:border-zinc-600'
                    : 'bg-zinc-900/40 border border-zinc-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">{pt.label}</div>
                  {!pt.available && pt.reason && (
                    <span className="text-xs text-zinc-600">{pt.reason}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{pt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Type-Specific Params */}
        {proofType === 'trust_level' && ctx.hasVNS && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Minimum Trust Threshold
              <span className="ml-2 text-zinc-500 text-xs">(your score: {ctx.trustScore ?? '?'})</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={trustThreshold}
                onChange={e => setTrustThreshold(Number(e.target.value))}
                className="flex-1 accent-purple-500"
              />
              <div className="w-12 text-center text-sm font-bold text-purple-400">{trustThreshold}</div>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Claim: <code className="text-zinc-400">trust_gte_{trustThreshold}</code>
              {ctx.trustScore !== undefined && ctx.trustScore < trustThreshold && (
                <span className="ml-2 text-red-400">⚠ Your score ({ctx.trustScore}) is below this threshold</span>
              )}
            </div>
          </div>
        )}

        {proofType === 'bond_status' && ctx.hasVNS && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Minimum Bond Tier
              <span className="ml-2 text-zinc-500 text-xs">(your tier: {ctx.bondTier || 'none'})</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['bronze', 'silver', 'gold', 'platinum'] as BondTier[]).map(tier => (
                <button
                  key={tier}
                  onClick={() => setBondMinTier(tier)}
                  className={`py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                    bondMinTier === tier
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                      : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chain */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Verification Chain</label>
          <ChainSelector value={chain} onChange={setChain} />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !ctx.hasVNS}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold transition-all text-sm"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating proof…
            </span>
          ) : 'Generate Proof'}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              <span className="text-sm font-semibold text-emerald-400">Proof Generated</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Type</span>
                <span className="text-white capitalize">{result.type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Claim</span>
                <code className="text-zinc-300 text-xs">{result.publicInputs.claim}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Chain</span>
                <span className="text-white">{CHAINS[result.publicInputs.chain].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Expires</span>
                <span className="text-white">{formatTimeRemaining(result)}</span>
              </div>
              {result.verifierContract && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Verifier</span>
                  <code className="text-zinc-300 text-xs">{result.verifierContract.slice(0, 10)}…{result.verifierContract.slice(-8)}</code>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-1">Proof Hash</div>
              <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-2">
                <code className="text-xs text-zinc-300 font-mono flex-1 break-all">{result.proofHash}</code>
                <button onClick={() => copyToClipboard(result.proofHash, 'Proof hash')} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {result.shareableJson && (
                <button
                  onClick={() => copyToClipboard(result.shareableJson!, 'Proof JSON')}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium transition-all border border-purple-500/20"
                >
                  Copy Shareable JSON
                </button>
              )}
              <button
                onClick={() => handleSubmitOnChain(result.proofHash)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium transition-all border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {submitting ? 'Submitting...' : 'Submit On-Chain'}
              </button>
            </div>
            {submitResult && (
              <div className={`mt-3 p-3 rounded-xl text-xs font-medium ${
                submitResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {submitResult.success ? '✓ ' : '✗ '}{submitResult.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Verify Tab
   ───────────────────────────────────────────── */
function ZKVerify() {
  const [mode, setMode] = useState<'hash' | 'json'>('hash');
  const [proofHash, setProofHash] = useState('');
  const [proofJson, setProofJson] = useState('');
  const [chain, setChain] = useState<ZKChain>('base');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ZKVerifyResult | null>(null);

  const handleVerify = async () => {
    if (mode === 'hash' && !proofHash) return;
    if (mode === 'json' && !proofJson) return;

    setVerifying(true);
    setResult(null);

    try {
      let res: ZKVerifyResult;
      if (mode === 'hash') {
        res = await verifyProofByHash(proofHash.trim(), chain);
      } else {
        res = await verifyProofFromJson(proofJson.trim());
      }
      setResult(res);
      if (res.valid) {
        showToast('Proof verified successfully.', 'success');
      } else {
        showToast(res.error || 'Proof verification failed.', 'warning');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected verification error.';
      setResult({ valid: false, error: msg });
    }

    setVerifying(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Verify ZK Proof</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Verify a proof by hash or by pasting the full proof JSON. Works for your own proofs and proofs shared by others.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          <button
            onClick={() => setMode('hash')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'hash' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            By Hash
          </button>
          <button
            onClick={() => setMode('json')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'json' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            By JSON
          </button>
        </div>

        {mode === 'hash' ? (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Proof Hash</label>
              <input
                type="text"
                value={proofHash}
                onChange={e => setProofHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              />
              <div className="text-xs text-zinc-600 mt-1">Must be a 0x-prefixed 32-byte hex string (66 chars)</div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Verification Chain</label>
              <ChainSelector value={chain} onChange={setChain} />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Proof JSON</label>
            <textarea
              value={proofJson}
              onChange={e => setProofJson(e.target.value)}
              placeholder={'{\n  "embrisProof": true,\n  "proofHash": "0x...",\n  ...\n}'}
              rows={8}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono resize-none"
            />
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying || (mode === 'hash' ? !proofHash : !proofJson)}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold transition-all text-sm"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Verifying…
            </span>
          ) : 'Verify Proof'}
        </button>

        {result && (
          <div className={`rounded-xl p-4 space-y-3 ${result.valid ? 'bg-emerald-500/8 border border-emerald-500/20' : 'bg-red-500/8 border border-red-500/20'}`}>
            <div className="flex items-center gap-2">
              {result.valid ? (
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              )}
              <span className={`text-sm font-semibold ${result.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.valid ? 'Proof Valid' : 'Proof Invalid'}
              </span>
            </div>

            {result.valid && (
              <div className="space-y-1.5 text-sm">
                {result.claim && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Claim</span>
                    <code className="text-zinc-300 text-xs">{result.claim}</code>
                  </div>
                )}
                {result.chain && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Chain</span>
                    <span className="text-white">{CHAINS[result.chain].name}</span>
                  </div>
                )}
                {result.onChainVerified !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">On-Chain</span>
                    <span className={result.onChainVerified ? 'text-emerald-400' : 'text-zinc-500'}>
                      {result.onChainVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                )}
                {result.verifierContract && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Verifier</span>
                    <code className="text-zinc-300 text-xs">{result.verifierContract.slice(0, 10)}…{result.verifierContract.slice(-8)}</code>
                  </div>
                )}
              </div>
            )}

            {!result.valid && result.error && (
              <p className="text-xs text-zinc-400">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   History Tab
   ───────────────────────────────────────────── */
function ZKHistory({ refreshKey }: { refreshKey: number }) {
  const [proofs, setProofs] = useState<ZKProof[]>([]);
  const [filter, setFilter] = useState<ZKProofType | 'all'>('all');

  const load = useCallback(() => {
    setProofs(getProofHistory());
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = (id: string) => {
    deleteProof(id);
    load();
    showToast('Proof deleted.', 'info');
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(`${label} copied to clipboard.`, 'success'));
  };

  const filtered = filter === 'all' ? proofs : proofs.filter(p => p.type === filter);

  const typeLabels: Record<ZKProofType | 'all', string> = {
    all: 'All',
    trust_level: 'Trust',
    vns_ownership: 'VNS',
    bond_status: 'Bond',
    identity: 'Identity',
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(['all', 'trust_level', 'vns_ownership', 'bond_status', 'identity'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {typeLabels[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-700/30 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h4 className="text-base font-semibold text-white mb-1">No Proofs Yet</h4>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            {filter === 'all'
              ? 'Generated proofs will appear here. Go to the Generate tab to create your first zero-knowledge proof.'
              : `No ${typeLabels[filter]} proofs found. Switch to All or generate a new proof.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-zinc-500">{filtered.length} proof{filtered.length !== 1 ? 's' : ''}</div>
          {filtered.map(proof => (
            <ProofCard
              key={proof.id}
              proof={proof}
              onDelete={handleDelete}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export default function ZKProofs() {
  const [tab, setTab] = useState<ProofTab>('overview');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const ctx = getMyProofContext();

  const tabs: { id: ProofTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      id: 'generate',
      label: 'Generate',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    },
    {
      id: 'verify',
      label: 'Verify',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      id: 'history',
      label: 'History',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  return (
    <div className="page-enter px-4 sm:px-6 py-4 max-w-4xl mx-auto pb-24">
      <AlphaBanner />

      {/* Header */}
      <div className="mb-5 pl-12 sm:pl-0">
        <h1 className="text-2xl font-bold text-white">ZK Proofs</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Privacy-preserving verification. Prove trust, identity, and bond status without revealing private data.
        </p>
      </div>

      <DisclaimerBanner disclaimerKey="zk_proofs" />

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-zinc-800 text-purple-400 border border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <ZKOverview ctx={ctx} />}
      {tab === 'generate' && (
        <ZKGenerate
          ctx={ctx}
          onProofGenerated={() => setHistoryRefreshKey(k => k + 1)}
        />
      )}
      {tab === 'verify' && <ZKVerify />}
      {tab === 'history' && <ZKHistory refreshKey={historyRefreshKey} />}
    </div>
  );
}
