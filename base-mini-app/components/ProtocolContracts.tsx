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
  { name: 'PrivacyGuarantees', address: '0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e', category: 'core' },
  { name: 'MissionEnforcement', address: '0x6EC0440e1601558024f285903F0F4577B109B609', category: 'core' },
  { name: 'AntiSurveillance', address: '0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac', category: 'core' },
  { name: 'ERC8004IdentityRegistry', address: '0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD', category: 'core' },
  { name: 'BeliefAttestationVerifier', address: '0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a', category: 'core' },
  { name: 'ERC8004ReputationRegistry', address: '0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C', category: 'core' },
  { name: 'ERC8004ValidationRegistry', address: '0x50E4609991691D5104016c4a2F6D2875234d4B06', category: 'core' },
  { name: 'AIPartnershipBondsV2', address: '0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855', category: 'core' },
  { name: 'AIAccountabilityBondsV2', address: '0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140', category: 'core' },
  { name: 'VaultfireERC8004Adapter', address: '0x02Cb2bFBeC479Cb1EA109E4c92744e08d5A5B361', category: 'core' },
  // 3 new security contracts
  { name: 'MultisigGovernance', address: '0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D', category: 'security' },
  { name: 'FlourishingMetricsOracle', address: '0xb751abb1158908114662b254567b8135C460932C', category: 'security' },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xBDB5d85B3a84C773113779be89A166Ed515A7fE2', category: 'security' },
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
