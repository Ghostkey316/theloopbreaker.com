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
  { name: 'PrivacyGuarantees', address: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55', category: 'core' },
  { name: 'MissionEnforcement', address: '0x38165D2D7a8584985CCa5640f4b32b1f3347CC83', category: 'core' },
  { name: 'AntiSurveillance', address: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C', category: 'core' },
  { name: 'ERC8004IdentityRegistry', address: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5', category: 'core' },
  { name: 'BeliefAttestationVerifier', address: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF', category: 'core' },
  { name: 'ERC8004ReputationRegistry', address: '0x544B575431ECD927bA83E85008446fA1e100204a', category: 'core' },
  { name: 'ERC8004ValidationRegistry', address: '0x501fE0f960c1e061C4d295Af241f9F1512775556', category: 'core' },
  { name: 'AIPartnershipBondsV2', address: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1', category: 'core' },
  { name: 'AIAccountabilityBondsV2', address: '0xDfc66395A4742b5168712a04942C90B99394aEEb', category: 'core' },
  { name: 'VaultfireERC8004Adapter', address: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c', category: 'core' },
  // 3 new security contracts
  { name: 'MultisigGovernance', address: '0xea0A6750642AA294658dC9f1eDf36b95D21e7B22', category: 'security' },
  { name: 'FlourishingMetricsOracle', address: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1', category: 'security' },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B', category: 'security' },
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
