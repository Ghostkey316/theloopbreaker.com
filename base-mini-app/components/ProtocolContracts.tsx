'use client';

import { motion } from 'framer-motion';
import { Database, ExternalLink, ShieldCheck } from 'lucide-react';

const BASESCAN_URL = 'https://basescan.org/address/';

interface ContractEntry {
  name: string;
  address: string;
  category: 'core' | 'security';
}

const contracts: ContractEntry[] = [
  // Original 10 core contracts
  { name: 'PrivacyGuarantees', address: '0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045', category: 'core' },
  { name: 'MissionEnforcement', address: '0x8568F4020FCD55915dB3695558dD6D2532599e56', category: 'core' },
  { name: 'AntiSurveillance', address: '0x722E37A7D6f27896C688336AaaFb0dDA80D25E57', category: 'core' },
  { name: 'ERC8004IdentityRegistry', address: '0x35978DB675576598F0781dA2133E94cdCf4858bC', category: 'core' },
  { name: 'BeliefAttestationVerifier', address: '0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba', category: 'core' },
  { name: 'ERC8004ReputationRegistry', address: '0xdB54B8925664816187646174bdBb6Ac658A55a5F', category: 'core' },
  { name: 'ERC8004ValidationRegistry', address: '0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55', category: 'core' },
  { name: 'AIPartnershipBondsV2', address: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4', category: 'core' },
  { name: 'AIAccountabilityBondsV2', address: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8', category: 'core' },
  { name: 'VaultfireERC8004Adapter', address: '0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0', category: 'core' },
  // 3 new security contracts
  { name: 'MultisigGovernance', address: '0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92', category: 'security' },
  { name: 'FlourishingMetricsOracle', address: '0x83dd216449B3F0574E39043ECFE275946fa492e9', category: 'security' },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xa5CEC47B48999EB398707838E3A18dd20A1ae272', category: 'security' },
];

export function ProtocolContracts() {
  return (
    <section className="py-20 px-4 border-t border-white/10">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-base-blue/10 border border-base-blue/20 mb-4 backdrop-blur-sm">
            <Database className="w-4 h-4 text-base-blue" />
            <span className="text-sm font-medium text-base-blue">
              Verified On-Chain
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">13 Contracts</span> on Base Mainnet
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto">
            Every contract is verified on BaseScan. Open source, audited, and permanently
            deployed. The code is the commitment.
          </p>
        </motion.div>

        {/* Contract Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-xs font-semibold text-base-gray-400 uppercase tracking-wider">
            <div className="col-span-1 hidden sm:block">#</div>
            <div className="col-span-5 sm:col-span-4">Contract</div>
            <div className="col-span-5 sm:col-span-5">Address</div>
            <div className="col-span-2 text-right">Type</div>
          </div>

          {/* Contract Rows */}
          {contracts.map((contract, index) => (
            <motion.div
              key={contract.address}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.03 }}
              className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors items-center"
            >
              <div className="col-span-1 hidden sm:block text-sm text-base-gray-500 font-mono">
                {index + 1}
              </div>
              <div className="col-span-5 sm:col-span-4">
                <span className="text-sm font-medium text-white">{contract.name}</span>
              </div>
              <div className="col-span-5 sm:col-span-5">
                <a
                  href={`${BASESCAN_URL}${contract.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-base-blue hover:text-base-blue-light transition-colors focus-ring rounded"
                >
                  <span className="hidden md:inline">{contract.address}</span>
                  <span className="md:hidden">
                    {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                  </span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div className="col-span-2 text-right">
                {contract.category === 'security' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-vaultfire-green/10 text-vaultfire-green border border-vaultfire-green/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="hidden sm:inline">Security</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-base-blue/10 text-base-blue border border-base-blue/20">
                    <span className="hidden sm:inline">Core</span>
                    <span className="sm:hidden">Core</span>
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
