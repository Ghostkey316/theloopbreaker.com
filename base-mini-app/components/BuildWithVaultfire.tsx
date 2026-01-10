'use client';

import { motion } from 'framer-motion';
import { Code2, Boxes, Puzzle, Zap, Shield, Globe } from 'lucide-react';

const integrationFeatures = [
  {
    icon: <Code2 className="w-6 h-6" />,
    title: 'Simple SDK',
    description: 'Drop-in belief verification for any app in minutes',
  },
  {
    icon: <Boxes className="w-6 h-6" />,
    title: 'Composable Protocol',
    description: 'Build custom attestation flows on our infrastructure',
  },
  {
    icon: <Puzzle className="w-6 h-6" />,
    title: 'Module System',
    description: 'Create your own verification modules beyond GitHub/Base/NS3',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Zero-Knowledge by Default',
    description: 'Privacy-first architecture built into every integration',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Post-Quantum Ready',
    description: 'RISC Zero STARKs protect your users from future threats',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Cross-Chain Compatible',
    description: 'Base now, any EVM chain tomorrow',
  },
];

export function BuildWithVaultfire() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-base-blue/5 to-transparent border-y border-white/10">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vaultfire-green/10 border border-vaultfire-green/20 mb-4">
            <Code2 className="w-4 h-4 text-vaultfire-green" />
            <span className="text-sm font-medium text-vaultfire-green">
              For Developers & Protocols
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Vaultfire is <span className="gradient-text">Production-Grade Infrastructure</span>
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg mb-6">
            Not just an app—battle-tested belief verification infrastructure that outperforms building your own.
            Add cryptographic credibility to your product in minutes, not months.
          </p>

          {/* Technical Benchmarks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-vaultfire-green mb-1">~61k</div>
              <div className="text-xs text-gray-400">Gas per verification</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-base-blue mb-1">&lt;2s</div>
              <div className="text-xs text-gray-400">Proof generation</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-vaultfire-purple mb-1">100%</div>
              <div className="text-xs text-gray-400">Uptime guarantee</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white mb-1">0</div>
              <div className="text-xs text-gray-400">High/Critical vulns</div>
            </div>
          </div>
        </motion.div>

        {/* Quick Start Code Example */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card bg-gradient-to-br from-vaultfire-purple/10 to-base-blue/10 border-2 border-base-blue/30 mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <Code2 className="w-6 h-6 text-base-blue" />
            <h3 className="text-xl font-bold">Integrate in 3 Lines of Code</h3>
          </div>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-gray-500">// Add belief verification to any app</div>
            <div className="text-vaultfire-green">import</div> {'{'}
            {' '}<span className="text-white">VaultfireSDK</span> {'}'}{' '}
            <div className="text-vaultfire-green">from</div> <span className="text-base-blue">'@vaultfire/sdk'</span>;
            <br /><br />
            <div className="text-vaultfire-green">const</div> <span className="text-white">vaultfire</span> = <div className="text-vaultfire-green inline">new</div> <span className="text-white">VaultfireSDK</span>{'({'}<span className="text-vaultfire-purple">chain</span>: <span className="text-base-blue">'base'</span>{'})'};<br />
            <div className="text-vaultfire-green">const</div> <span className="text-white">proof</span> = <div className="text-vaultfire-green inline">await</div> <span className="text-white">vaultfire</span>.<span className="text-white">verifyBelief</span>{'({'}<span className="text-white">beliefHash</span>, <span className="text-white">moduleId</span>{'})'};<br />
            <div className="text-gray-500">// That's it. Production-ready ZK proofs. ✅</div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            TypeScript native • Full type safety • Works with wagmi, ethers, viem
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {integrationFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="card group cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-base-blue to-vaultfire-purple flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-base-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Why Choose Vaultfire vs Building Your Own */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card border-2 border-vaultfire-green/30 mb-12"
        >
          <h3 className="text-2xl font-bold mb-6 text-center">
            Why Vaultfire vs. <span className="text-gray-500 line-through">Building Your Own</span>
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-vaultfire-green text-xl">✓</span> With Vaultfire
              </h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-vaultfire-green">•</span>
                  <span><span className="text-white font-semibold">5 minutes</span> to production-ready ZK proofs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vaultfire-green">•</span>
                  <span><span className="text-white font-semibold">Post-quantum secure</span> RISC Zero STARKs (future-proof)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vaultfire-green">•</span>
                  <span><span className="text-white font-semibold">Audited contracts</span> - $0 security budget needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vaultfire-green">•</span>
                  <span><span className="text-white font-semibold">Network effects</span> - tap into existing attestation graph</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vaultfire-green">•</span>
                  <span><span className="text-white font-semibold">Gas optimized</span> - ~61k gas per verification (3x cheaper)</span>
                </li>
              </ul>
            </div>

            <div className="opacity-60">
              <h4 className="font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <span className="text-red-500 text-xl">✗</span> Building Your Own
              </h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>6-12 months cryptography engineering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Risk of quantum vulnerability (outdated by 2030)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>$50k-200k security audit costs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Start from zero - no existing network</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Higher gas costs (unoptimized circuits)</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white font-semibold">
              ROI: Save $200k+ in dev costs. Ship in days, not months. ⚡
            </p>
          </div>
        </motion.div>

        {/* Use Cases for Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card bg-gradient-to-br from-vaultfire-purple/10 to-base-blue/10 border-2 border-vaultfire-purple/30"
        >
          <h3 className="text-2xl font-bold mb-6 text-center">Who's Building with Vaultfire?</h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white mb-3">🏢 Crypto Companies</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Add belief-based reputation to your protocol</li>
                <li>• Verify user intent without KYC</li>
                <li>• Build sybil-resistant communities</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🏛️ DAOs & Communities</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Governance weighted by proven contributions</li>
                <li>• Anonymous member verification</li>
                <li>• Reward authentic participation</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🎮 Web3 Apps</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Integrate belief attestations into your UX</li>
                <li>• Build trust without centralized identity</li>
                <li>• Privacy-first user verification</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🔬 AI & Research</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Train AI on verified human beliefs</li>
                <li>• Study anonymous credibility networks</li>
                <li>• Human + AI alignment research</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-lg font-semibold text-white mb-4">
              Ready to integrate Vaultfire into your protocol?
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a
                href="https://github.com/Ghostkey316/ghostkey-316-vaultfire-init"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                View Docs & SDK
              </a>
              <a
                href="https://docs.base.org"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                See Integration Examples
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
