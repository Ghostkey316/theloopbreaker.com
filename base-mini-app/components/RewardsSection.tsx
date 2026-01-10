'use client';

import { motion } from 'framer-motion';
import { Star, Gift, Crown, Sparkles, Award, Zap } from 'lucide-react';

const rewardTiers = [
  {
    tier: 'Bronze',
    score: '70-79%',
    icon: <Award className="w-8 h-8" />,
    color: 'from-orange-600 to-orange-800',
    rewards: [
      'Access to Vaultfire community',
      'Basic reputation badge',
      'Believer role in Discord',
    ],
  },
  {
    tier: 'Silver',
    score: '80-89%',
    icon: <Star className="w-8 h-8" />,
    color: 'from-gray-400 to-gray-600',
    rewards: [
      'All Bronze rewards',
      'Early access to new features',
      'Voting rights on protocol changes',
      'Silver NFT badge (soulbound)',
    ],
  },
  {
    tier: 'Gold',
    score: '90-94%',
    icon: <Gift className="w-8 h-8" />,
    color: 'from-yellow-400 to-yellow-600',
    rewards: [
      'All Silver rewards',
      'Partner project whitelist access',
      'Exclusive Base ecosystem perks',
      'Gold NFT badge + profile frame',
      'Priority support',
    ],
  },
  {
    tier: 'Diamond',
    score: '95-100%',
    icon: <Crown className="w-8 h-8" />,
    color: 'from-base-blue to-vaultfire-purple',
    popular: true,
    rewards: [
      'All Gold rewards',
      '💎 Diamond NFT badge (tradeable!)',
      'Revenue share from protocol fees',
      'Direct line to founding team',
      'Ambassador opportunities',
      'Future token airdrops (TBD)',
    ],
  },
];

export function RewardsSection() {
  return (
    <section className="py-20 px-4 border-y border-white/10 bg-gradient-to-b from-vaultfire-purple/5 via-transparent to-base-blue/5">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vaultfire-purple/10 border border-vaultfire-purple/20 mb-4">
            <Sparkles className="w-4 h-4 text-vaultfire-purple animate-pulse" />
            <span className="text-sm font-medium text-vaultfire-purple">
              Higher Score = Better Rewards
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Unlock <span className="gradient-text">Real Rewards</span>
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg">
            Your loyalty score isn't just a number - it's your key to exclusive perks,
            access, and opportunities in the Base ecosystem.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {rewardTiers.map((tier, index) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -8 }}
              className={`card relative group ${
                tier.popular
                  ? 'border-2 border-base-blue shadow-xl shadow-base-blue/20'
                  : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-base-blue to-vaultfire-purple text-xs font-bold">
                  MOST POPULAR
                </div>
              )}

              <div
                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg`}
              >
                {tier.icon}
              </div>

              <h3 className="text-2xl font-bold mb-1">{tier.tier}</h3>
              <p className="text-base-gray-400 text-sm mb-4">{tier.score} Score</p>

              <div className="space-y-2">
                {tier.rewards.map((reward, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Zap className="w-4 h-4 text-vaultfire-green shrink-0 mt-0.5" />
                    <span className="text-base-gray-300">{reward}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Perks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-vaultfire-green/20 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-6 h-6 text-vaultfire-green" />
            </div>
            <h4 className="font-semibold mb-2">Partner Perks</h4>
            <p className="text-sm text-base-gray-400">
              Access exclusive deals from Base ecosystem projects based on your score
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-base-blue/20 flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-base-blue" />
            </div>
            <h4 className="font-semibold mb-2">Reputation NFTs</h4>
            <p className="text-sm text-base-gray-400">
              Earn tradeable NFT badges that prove your credibility on-chain
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 rounded-full bg-vaultfire-purple/20 flex items-center justify-center mx-auto mb-3">
              <Crown className="w-6 h-6 text-vaultfire-purple" />
            </div>
            <h4 className="font-semibold mb-2">Future Airdrops</h4>
            <p className="text-sm text-base-gray-400">
              High scorers get priority for future token distributions and opportunities
            </p>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-lg font-semibold mb-2">
            The higher your score, the more you unlock 🚀
          </p>
          <p className="text-base-gray-400">
            Start with one attestation. Build your reputation. Unlock the rewards.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
