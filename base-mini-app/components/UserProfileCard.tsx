'use client';

import { motion } from 'framer-motion';
import { Award, Calendar, Github, Coins, Shield } from 'lucide-react';
import { VaultfireLogo } from './VaultfireLogo';

interface UserStats {
  totalAttestations: number;
  avgScore: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  joinedDate: string;
  modules: Array<'GitHub' | 'Base' | 'NS3'>;
  recentActivity: {
    date: string;
    module: string;
    score: number;
  }[];
}

const mockUserStats: UserStats = {
  totalAttestations: 47,
  avgScore: 96,
  tier: 'Gold',
  joinedDate: 'Jan 2026',
  modules: ['GitHub', 'Base', 'NS3'],
  recentActivity: [
    { date: '2h ago', module: 'GitHub', score: 98 },
    { date: '1d ago', module: 'Base', score: 97 },
    { date: '2d ago', module: 'NS3', score: 95 },
  ],
};

const ModuleIcon = ({ module }: { module: string }) => {
  switch (module) {
    case 'GitHub':
      return <Github className="w-5 h-5 text-gray-600" />;
    case 'Base':
      return <Coins className="w-5 h-5 text-base-blue" />;
    case 'NS3':
      return <Shield className="w-5 h-5 text-vaultfire-purple" />;
    default:
      return null;
  }
};

export function UserProfileCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-vaultfire-purple/10 to-base-blue/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:sticky lg:top-24"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1">Your Private Stats</h3>
        <p className="text-xs text-gray-500">Visible only to you • Wallet-first, no KYC</p>
      </div>

      {/* Wallet Identity */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-vaultfire-purple to-base-blue p-1">
            <div className="w-full h-full rounded-full bg-vaultfire-dark flex items-center justify-center">
              <VaultfireLogo className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{mockUserStats.avgScore}%</div>
          <div className="text-sm text-gray-400">Your Average Score</div>
          <div className="text-xs text-gray-600 mt-1">Private • Not ranked publicly</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white mb-1">{mockUserStats.totalAttestations}</div>
          <div className="text-xs text-gray-400">Attestations</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-vaultfire-green mb-1">{mockUserStats.modules.length}</div>
          <div className="text-xs text-gray-400">Modules</div>
        </div>
      </div>

      {/* Connected Modules */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Connected Modules</h4>
        <div className="flex gap-2">
          {mockUserStats.modules.map((module) => (
            <div
              key={module}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 rounded-lg border border-white/10"
            >
              <ModuleIcon module={module} />
              <span className="text-xs font-semibold text-gray-300">{module}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {mockUserStats.recentActivity.map((activity, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <ModuleIcon module={activity.module} />
                <div>
                  <div className="text-xs font-semibold text-white">{activity.module}</div>
                  <div className="text-xs text-gray-500">{activity.date}</div>
                </div>
              </div>
              <div className="text-sm font-bold text-vaultfire-green">{activity.score}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Joined Date */}
      <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
        <Calendar className="w-4 h-4" />
        <span>Member since {mockUserStats.joinedDate}</span>
      </div>

      {/* CTA */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full mt-6 py-3 rounded-lg bg-gradient-to-r from-vaultfire-purple to-base-blue text-white font-bold hover:shadow-lg hover:shadow-vaultfire-purple/50 transition-all"
      >
        Create New Attestation
      </motion.button>
    </motion.div>
  );
}
