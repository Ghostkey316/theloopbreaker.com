'use client';

import { motion } from 'framer-motion';
import { Code2, Briefcase, Users, Heart, Lightbulb, Trophy } from 'lucide-react';

const useCases = [
  {
    icon: <Code2 className="w-6 h-6" />,
    title: 'Prove Open Source Contributions',
    example: '"I contribute to privacy tech because I believe in digital freedom"',
    link: 'GitHub commits',
    color: 'from-gray-900 to-gray-700',
    score: '98%',
  },
  {
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Verify Job Market Beliefs',
    example: '"Remote work is the future" - backed by your actual remote work history',
    link: 'NS3 professional activity',
    color: 'from-base-blue to-base-blue-dark',
    score: '95%',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Build Reputation Anonymously',
    example: '"Crypto will democratize finance" - proven by your on-chain activity',
    link: 'Base transactions',
    color: 'from-vaultfire-purple to-vaultfire-purple-dark',
    score: '97%',
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: 'Join Value-Aligned Communities',
    example: '"Climate action matters" - backed by sustainable living data',
    link: 'Multiple sources',
    color: 'from-vaultfire-green to-vaultfire-green-dark',
    score: '94%',
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: 'Validate Expertise Claims',
    example: '"AI should serve humanity" - proven by your ethical AI research',
    link: 'GitHub + publications',
    color: 'from-vaultfire-purple-light to-base-blue-light',
    score: '96%',
  },
  {
    icon: <Trophy className="w-6 h-6" />,
    title: 'Earn Trust-Based Rewards',
    example: 'Higher scores unlock exclusive opportunities and partnerships',
    link: 'Cross-platform proof',
    color: 'from-base-blue-light to-vaultfire-purple',
    score: '99%',
  },
];

export function UseCases() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent via-base-blue/5 to-transparent">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How People Are <span className="gradient-text">Taking Back Control</span>
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto text-lg">
            Real humans, real beliefs, real proof. No middlemen. No surveillance. Just cryptographic truth.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="card group cursor-default h-full"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
              >
                {useCase.icon}
              </div>

              <h3 className="text-lg font-semibold mb-2">{useCase.title}</h3>

              <div className="bg-black/30 rounded-lg p-3 mb-3 border border-white/10">
                <p className="text-sm italic text-base-gray-300">"{useCase.example}"</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-base-gray-400">Linked to: {useCase.link}</span>
                <span className="font-semibold text-vaultfire-green">{useCase.score}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 card text-center bg-gradient-to-br from-base-blue/10 to-vaultfire-purple/10 border-base-blue/20"
        >
          <h3 className="text-2xl font-bold mb-3">The Future Needs You</h3>
          <p className="text-base-gray-300 mb-6 max-w-2xl mx-auto">
            Every voice matters. Every belief shapes tomorrow. Stand up for what you know is right—without giving up who you are.
            <span className="text-white font-semibold"> This is how we build an AI future that serves humanity, not corporations.</span>
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="badge bg-base-blue/20 text-base-blue border border-base-blue/30">
              🔒 100% Private
            </span>
            <span className="badge bg-vaultfire-purple/20 text-vaultfire-purple border border-vaultfire-purple/30">
              🛡️ Post-Quantum Secure
            </span>
            <span className="badge bg-vaultfire-green/20 text-vaultfire-green border border-vaultfire-green/30">
              🚀 Built on Base
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
