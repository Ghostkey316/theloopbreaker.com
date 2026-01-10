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
            Vaultfire is <span className="gradient-text">Infrastructure</span>
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg">
            Not just an app—a belief verification protocol that any company, DAO, or project can plug into.
            Add cryptographic credibility to your product in minutes.
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
