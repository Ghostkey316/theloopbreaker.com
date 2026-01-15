'use client';

import { motion } from 'framer-motion';
import { Code2, Boxes, Puzzle, Zap, Shield, Globe } from 'lucide-react';

const integrationFeatures = [
  {
    icon: <Code2 className="w-6 h-6" />,
    title: 'Trust Any Claim',
    description: 'Verify beliefs, reputation, credentials, identity—anything that needs cryptographic proof',
  },
  {
    icon: <Boxes className="w-6 h-6" />,
    title: 'Composable Protocol',
    description: 'Stack verification modules, create custom trust flows, build your own reputation systems',
  },
  {
    icon: <Puzzle className="w-6 h-6" />,
    title: 'Extensible Modules',
    description: 'GitHub, Base, NS3 built-in. Add Twitter, LinkedIn, educational credentials—anything',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Zero-Knowledge by Default',
    description: 'Users prove claims without revealing data. Privacy is the default, not an add-on',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Post-Quantum Secure',
    description: 'RISC Zero STARKs resist quantum attacks. Your trust layer won\'t be obsolete in 2030',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Universal Trust Graph',
    description: 'Every attestation strengthens the network. Tap into cross-protocol reputation',
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
            Vaultfire is the <span className="gradient-text">Trust Layer</span> for Base
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg mb-6">
            Not just beliefs—the complete trust infrastructure for reputation, identity, credibility, and governance.
            Add cryptographic proof to ANY claim in your app. Production-ready. Post-quantum secure.
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
          <h3 className="text-2xl font-bold mb-6 text-center">What Can You Build on the Trust Layer?</h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white mb-3">🏢 DeFi & Trading</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Prove trading track record without revealing positions</li>
                <li>• Sybil-resistant airdrops based on real activity</li>
                <li>• Credit scores from on-chain behavior (privacy-preserved)</li>
                <li>• Reputation-weighted lending pools</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🏛️ Governance & DAOs</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Voting power based on proven contributions</li>
                <li>• Anonymous member verification (no doxxing)</li>
                <li>• Delegate trust scores (who actually delivers)</li>
                <li>• Reputation-gated proposals</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">💼 Professional Credentials</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Prove work experience without revealing employer</li>
                <li>• Educational credentials (ZK diplomas)</li>
                <li>• Skill verification from real projects</li>
                <li>• Anonymous professional reputation</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🤖 AI & Social</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Verify human vs bot (privacy-preserving CAPTCHA)</li>
                <li>• Train AI on verified human preferences</li>
                <li>• Reputation-based content filtering</li>
                <li>• Trust scores for AI agent interactions</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🎮 Gaming & NFTs</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Prove game achievements without showing wallet</li>
                <li>• Anti-cheat verification (ZK game state proofs)</li>
                <li>• Reputation-based matchmaking</li>
                <li>• NFT holder benefits without public disclosure</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">🌐 Identity & Access</h4>
              <ul className="space-y-2 text-sm text-base-gray-400">
                <li>• Age verification without revealing birthday</li>
                <li>• Location proofs (privacy-preserved geofencing)</li>
                <li>• Accredited investor status (ZK compliance)</li>
                <li>• Anonymous KYC for regulated apps</li>
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
