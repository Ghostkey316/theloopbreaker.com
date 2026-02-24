'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Users, Eye, Clock, ExternalLink } from 'lucide-react';

const BASESCAN_URL = 'https://basescan.org/address/';

interface SecurityContract {
  name: string;
  address: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const securityContracts: SecurityContract[] = [
  {
    name: 'MultisigGovernance',
    address: '0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92',
    icon: <Users className="w-6 h-6" />,
    title: 'Multisig Governance',
    description:
      'No single person can make critical changes alone. Every protocol upgrade, ownership transfer, or parameter change requires approval from multiple independent signers. This eliminates single points of failure and ensures that trust is distributed, not concentrated.',
    gradient: 'from-vaultfire-purple to-vaultfire-purple-dark',
  },
  {
    name: 'FlourishingMetricsOracle',
    address: '0x83dd216449B3F0574E39043ECFE275946fa492e9',
    icon: <Eye className="w-6 h-6" />,
    title: 'Multi-Oracle Consensus',
    description:
      'AI performance data can\'t be manipulated by one bad actor. Multiple independent oracle sources must agree before any flourishing metric is accepted on-chain. Consensus-based reporting means the protocol only trusts data that has been independently verified from several directions.',
    gradient: 'from-base-blue to-base-blue-dark',
  },
  {
    name: 'ProductionBeliefAttestationVerifier',
    address: '0xa5CEC47B48999EB398707838E3A18dd20A1ae272',
    icon: <Clock className="w-6 h-6" />,
    title: '48-Hour Timelock Verification',
    description:
      'Any changes to the ZK verification system require a 48-hour waiting period before they take effect. No instant backdoors, no surprise changes. The community always has time to review, challenge, or exit before a critical update goes live.',
    gradient: 'from-vaultfire-green to-vaultfire-green-dark',
  },
];

export function SecurityLayer() {
  return (
    <section className="py-20 px-4 border-t border-white/10 bg-gradient-to-b from-transparent via-vaultfire-purple/5 to-transparent">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vaultfire-green/10 border border-vaultfire-green/20 mb-4 backdrop-blur-sm"
          >
            <ShieldCheck className="w-4 h-4 text-vaultfire-green" />
            <span className="text-sm font-medium text-vaultfire-green">
              Security Enhancements
            </span>
          </motion.div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Trust is <span className="gradient-text">Hardened</span>, Not Assumed
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg">
            Three new security contracts ensure that no single actor — human or AI — can
            compromise the protocol. Every critical action is checked, delayed, or
            requires consensus.
          </p>
        </motion.div>

        {/* Security Contract Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {securityContracts.map((contract, index) => (
            <motion.div
              key={contract.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="card group cursor-default"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${contract.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg`}
              >
                {contract.icon}
              </div>

              <h3 className="text-lg font-semibold mb-3 tracking-tight">{contract.title}</h3>
              <p className="text-sm text-base-gray-400 leading-relaxed mb-4">
                {contract.description}
              </p>

              {/* Contract Address */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-base-gray-500 mb-1">Contract Address</p>
                <a
                  href={`${BASESCAN_URL}${contract.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-base-blue hover:text-base-blue-light transition-colors focus-ring rounded-lg"
                >
                  {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="card text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vaultfire-green to-vaultfire-green-dark flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold">13 Contracts. Zero Single Points of Failure.</h3>
          </div>
          <p className="text-base-gray-400 max-w-3xl mx-auto">
            The Vaultfire protocol now operates through 13 verified smart contracts on Base mainnet.
            Every critical path is protected by multisig governance, oracle consensus, and
            timelock delays. The protocol trusts math, not individuals.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
