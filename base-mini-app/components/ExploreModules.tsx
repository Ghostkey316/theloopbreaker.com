'use client';

import { motion } from 'framer-motion';
import { Github, Coins, Shield, Clock, Code2 } from 'lucide-react';

interface ModuleStats {
  module: 'GitHub' | 'Base' | 'NS3';
  description: string;
  totalAttestations: number;
  avgScore: number;
  icon: React.ReactNode;
  gradient: string;
}

const moduleStats: ModuleStats[] = [
  {
    module: 'GitHub',
    description: 'Link beliefs to open-source contributions and commits',
    totalAttestations: 612,
    avgScore: 97,
    icon: <Github className="w-6 h-6" />,
    gradient: 'from-gray-900 to-gray-700',
  },
  {
    module: 'Base',
    description: 'Verify beliefs through on-chain transaction history',
    totalAttestations: 509,
    avgScore: 96,
    icon: <Coins className="w-6 h-6" />,
    gradient: 'from-base-blue to-base-blue-dark',
  },
  {
    module: 'NS3',
    description: 'Prove beliefs via namespace ownership and activity',
    totalAttestations: 126,
    avgScore: 95,
    icon: <Shield className="w-6 h-6" />,
    gradient: 'from-vaultfire-purple to-vaultfire-purple-dark',
  },
];

export function ExploreModules() {
  return (
    <section className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Explore Modules
          </h2>
          <p className="text-gray-400">Choose how you want to prove your beliefs - no algorithms, just freedom</p>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {moduleStats.map((module, idx) => (
            <motion.div
              key={module.module}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6 cursor-pointer group"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                {module.icon}
              </div>

              {/* Module Name */}
              <h3 className="text-xl font-bold text-white mb-2">{module.module}</h3>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                {module.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                <div>
                  <div className="text-2xl font-bold text-white">{module.totalAttestations}</div>
                  <div className="text-xs text-gray-500">Attestations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-vaultfire-green">{module.avgScore}%</div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
              </div>

              {/* CTA */}
              <button className="w-full mt-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-white transition-all">
                Explore {module.module}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Recent Activity - Chronological, No Algorithm */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-gray-400" />
            <h3 className="text-xl font-bold text-white">Recent Activity</h3>
            <span className="text-sm text-gray-500">• Chronological order, no algorithmic manipulation</span>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="space-y-3">
              {[
                { module: 'GitHub', time: '2m ago', type: 'Contribution verified' },
                { module: 'Base', time: '5m ago', type: 'Transaction linked' },
                { module: 'NS3', time: '12m ago', type: 'Namespace validated' },
                { module: 'GitHub', time: '18m ago', type: 'Commit attested' },
                { module: 'Base', time: '24m ago', type: 'On-chain proof' },
              ].map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-vaultfire-green animate-pulse" />
                    <span className="text-sm font-semibold text-white">{activity.type}</span>
                    <span className="text-xs text-gray-500">• {activity.module}</span>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
