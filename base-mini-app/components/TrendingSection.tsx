'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Flame, Star, Crown, Award } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TrendingTopic {
  id: string;
  topic: string;
  attestations: number;
  change: number; // percentage change
}

interface TopUser {
  id: string;
  displayName: string;
  avatar: string;
  score: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
}

const mockTrendingTopics: TrendingTopic[] = [
  { id: '1', topic: 'Privacy Tech', attestations: 847, change: 23 },
  { id: '2', topic: 'Open Source', attestations: 612, change: 18 },
  { id: '3', topic: 'DeFi Innovation', attestations: 509, change: 31 },
  { id: '4', topic: 'Layer 2 Scaling', attestations: 423, change: 12 },
  { id: '5', topic: 'Web3 Gaming', attestations: 387, change: 45 },
];

const mockTopUsers: TopUser[] = [
  {
    id: '1',
    displayName: 'CryptoBuilder',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=top1',
    score: 99,
    tier: 'Diamond',
  },
  {
    id: '2',
    displayName: 'PrivacyAdvocate',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=top2',
    score: 98,
    tier: 'Diamond',
  },
  {
    id: '3',
    displayName: 'OpenSourceDev',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=top3',
    score: 97,
    tier: 'Gold',
  },
  {
    id: '4',
    displayName: 'BaseMaximalist',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=top4',
    score: 96,
    tier: 'Gold',
  },
  {
    id: '5',
    displayName: 'ZkProofMaster',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=top5',
    score: 95,
    tier: 'Gold',
  },
];

export function TrendingSection() {
  const [activeTab, setActiveTab] = useState<'topics' | 'users'>('topics');

  return (
    <section className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Trending Topics */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-vaultfire-purple/10 to-base-blue/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-vaultfire-purple/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-vaultfire-purple" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Trending Topics</h3>
                <p className="text-sm text-gray-400">What's hot right now</p>
              </div>
            </div>

            <div className="space-y-3">
              {mockTrendingTopics.map((topic, idx) => (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-vaultfire-purple/30 to-base-blue/30 text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold group-hover:text-vaultfire-purple transition-colors">
                        {topic.topic}
                      </h4>
                      <p className="text-xs text-gray-400">{topic.attestations.toLocaleString()} attestations</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold text-vaultfire-green">+{topic.change}%</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <button className="w-full mt-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-all">
              View All Topics
            </button>
          </motion.div>

          {/* Top Contributors */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-base-blue/10 to-vaultfire-green/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-vaultfire-green/20 rounded-lg">
                <Crown className="w-6 h-6 text-vaultfire-green" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Top Contributors</h3>
                <p className="text-sm text-gray-400">Highest reputation scores</p>
              </div>
            </div>

            <div className="space-y-3">
              {mockTopUsers.map((user, idx) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {idx < 3 && (
                        <div className="absolute -top-1 -right-1 z-10">
                          {idx === 0 && <Crown className="w-5 h-5 text-yellow-400 fill-current" />}
                          {idx === 1 && <Award className="w-4 h-4 text-gray-300 fill-current" />}
                          {idx === 2 && <Star className="w-4 h-4 text-amber-700 fill-current" />}
                        </div>
                      )}
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className={`w-12 h-12 rounded-full border-2 ${
                          idx === 0 ? 'border-yellow-400' : idx === 1 ? 'border-gray-300' : 'border-amber-700'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold group-hover:text-vaultfire-green transition-colors">
                        {user.displayName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.tier === 'Diamond' ? 'bg-cyan-400/20 text-cyan-300' :
                          user.tier === 'Gold' ? 'bg-yellow-500/20 text-yellow-400' :
                          user.tier === 'Silver' ? 'bg-gray-400/20 text-gray-300' :
                          'bg-amber-700/20 text-amber-600'
                        }`}>
                          {user.tier}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{user.score}</div>
                    <div className="text-xs text-gray-400">score</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button className="w-full mt-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-all">
              View Leaderboard
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
