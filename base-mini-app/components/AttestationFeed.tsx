'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Github, Coins, Shield, Award, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Attestation {
  id: string;
  wallet: string; // Anonymous wallet address only - no names, no tracking
  belief: string;
  module: 'GitHub' | 'Base' | 'NS3';
  score: number;
  timestamp: string;
  proofLink: string; // Always have proof - this is about verification, not vanity
}

// Mock data - in production, fetch from contract events (fully anonymous)
const generateMockAttestations = (): Attestation[] => {
  const beliefs = [
    'I believe in open-source collaboration as the future of software development',
    'Privacy is a fundamental human right that must be preserved on-chain',
    'Decentralized finance will democratize access to financial services globally',
    'Zero-knowledge proofs are essential for scalable blockchain privacy',
    'Building in public accelerates innovation and trust in crypto',
    'Layer 2 solutions are the key to mainstream blockchain adoption',
    'Community governance leads to more resilient protocols',
    'Cross-chain interoperability is critical for Web3 growth',
    'On-chain reputation will replace traditional credit scores',
    'Transparent development builds stronger crypto communities',
  ];

  const modules: Array<'GitHub' | 'Base' | 'NS3'> = ['GitHub', 'Base', 'NS3'];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `attest-${i}`,
    wallet: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`, // Anonymous wallet only
    belief: beliefs[Math.floor(Math.random() * beliefs.length)],
    module: modules[Math.floor(Math.random() * modules.length)],
    score: 90 + Math.floor(Math.random() * 10),
    timestamp: `${Math.floor(Math.random() * 60)}m ago`,
    proofLink: `https://basescan.org/tx/${Math.random().toString(16).slice(2, 66)}`, // Always have proof
  }));
};

const ModuleIcon = ({ module }: { module: string }) => {
  switch (module) {
    case 'GitHub':
      return <Github className="w-4 h-4 text-gray-600" />;
    case 'Base':
      return <Coins className="w-4 h-4 text-base-blue" />;
    case 'NS3':
      return <Shield className="w-4 h-4 text-vaultfire-purple" />;
    default:
      return null;
  }
};

export function AttestationFeed() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [filter, setFilter] = useState<'all' | 'GitHub' | 'Base' | 'NS3'>('all');

  useEffect(() => {
    setAttestations(generateMockAttestations());
  }, []);

  const filteredAttestations = filter === 'all'
    ? attestations
    : attestations.filter(a => a.module === filter);

  return (
    <section className="py-8 px-4 bg-gradient-to-b from-vaultfire-purple/5 to-transparent">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Recent Attestations
          </h2>
          <p className="text-gray-400">Anonymous beliefs, verified on-chain. No tracking, no surveillance.</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'GitHub', 'Base', 'NS3'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-vaultfire-purple text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f === 'all' ? 'All Modules' : f}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredAttestations.map((attestation, idx) => (
              <motion.div
                key={attestation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all group"
              >
                {/* Anonymous Header - Wallet First, No KYC */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-vaultfire-purple/20 to-base-blue/20 border border-white/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="font-mono">{attestation.wallet}</span>
                        <span>•</span>
                        <span>{attestation.timestamp}</span>
                      </div>
                      <div className="text-xs text-gray-500">Anonymous - Verified on-chain</div>
                    </div>
                  </div>

                  {/* Module Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <ModuleIcon module={attestation.module} />
                    <span className="text-xs font-semibold text-gray-300">{attestation.module}</span>
                  </div>
                </div>

                {/* Belief Content */}
                <p className="text-white/90 text-lg mb-4 leading-relaxed">
                  {attestation.belief}
                </p>

                {/* Score Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400 font-semibold">Credibility Score</span>
                    <span className="text-sm font-bold text-vaultfire-green">{attestation.score}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${attestation.score}%` }}
                      transition={{ delay: 0.2, duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-vaultfire-green to-emerald-400 rounded-full"
                    />
                  </div>
                </div>

                {/* Proof Verification - No Vanity Metrics */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="text-xs text-gray-500">
                    <Shield className="w-3 h-3 inline mr-1" />
                    Zero-knowledge proof • Privacy preserved
                  </div>

                  <a
                    href={attestation.proofLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-vaultfire-purple/10 hover:bg-vaultfire-purple/20 border border-vaultfire-purple/30 rounded-lg text-sm font-semibold text-vaultfire-purple transition-all"
                  >
                    <Award className="w-4 h-4" />
                    Verify Proof
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load More */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
        >
          Load More Attestations
        </motion.button>
      </div>
    </section>
  );
}
