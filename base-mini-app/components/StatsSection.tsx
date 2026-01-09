'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Shield, Users, Zap } from 'lucide-react';

export function StatsSection() {
  const stats = [
    {
      icon: <Shield className="w-6 h-6" />,
      value: '100%',
      label: 'Zero-Knowledge',
      description: 'Complete privacy protection',
      color: 'from-vaultfire-purple to-vaultfire-purple-dark',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      value: '~61k',
      label: 'Gas Cost',
      description: 'Efficient STARK verification',
      color: 'from-base-blue to-base-blue-dark',
    },
    {
      icon: <Users className="w-6 h-6" />,
      value: 'A+',
      label: 'Security Grade',
      description: 'Professional audit certified',
      color: 'from-vaultfire-green to-vaultfire-green-dark',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      value: '∞',
      label: 'Post-Quantum',
      description: 'Future-proof cryptography',
      color: 'from-vaultfire-purple-light to-base-blue',
    },
  ];

  return (
    <section className="py-20 px-4 border-y border-white/10">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Vaultfire on <span className="gradient-text">Base</span>
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto">
            Built with RISC Zero STARKs, deployed on Base for fast and affordable transactions
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="card text-center group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}
              >
                {stat.icon}
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm font-semibold mb-1">{stat.label}</div>
              <div className="text-xs text-base-gray-400">{stat.description}</div>
            </motion.div>
          ))}
        </div>

        {/* Base Network Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 card text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-base-blue flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold">Built on Base</h3>
          </div>
          <p className="text-base-gray-400 max-w-2xl mx-auto">
            Leveraging Base's low fees and fast finality for affordable zero-knowledge proof
            verification. All belief attestations are permanently recorded on-chain.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
