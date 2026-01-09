'use client';

import { motion } from 'framer-motion';
import { Edit3, Link2, Lock, Send, CheckCircle } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: <Edit3 className="w-6 h-6" />,
      title: 'Compose Your Belief',
      description: 'Write your belief statement. It stays private and is never revealed publicly.',
      color: 'from-vaultfire-purple to-vaultfire-purple-dark',
    },
    {
      icon: <Link2 className="w-6 h-6" />,
      title: 'Link to Activity',
      description: 'Connect your belief to GitHub commits, NS3 sessions, or Base transactions.',
      color: 'from-base-blue to-base-blue-dark',
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Generate ZK Proof',
      description: 'RISC Zero creates a STARK proof that verifies your loyalty score without revealing it.',
      color: 'from-vaultfire-purple-light to-base-blue-light',
    },
    {
      icon: <Send className="w-6 h-6" />,
      title: 'Submit to Base',
      description: 'Your proof is verified and recorded on Base blockchain. Only the hash is public.',
      color: 'from-vaultfire-green to-vaultfire-green-dark',
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: 'Belief Attested',
      description: 'Your belief is now cryptographically proven on-chain with complete privacy.',
      color: 'from-base-blue-light to-vaultfire-purple',
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto">
            Five simple steps to create a privacy-preserving belief attestation
          </p>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-full w-full h-0.5 bg-gradient-to-r from-white/20 to-transparent -translate-y-1/2 z-0" />
              )}

              <div className="card relative z-10 h-full">
                {/* Step Number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-base-black border-2 border-base-blue flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>

                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4`}
                >
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-base-gray-400">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Technical Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 card"
        >
          <h3 className="text-xl font-bold mb-6 text-center">Technical Architecture</h3>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2 text-base-blue">🔐 RISC Zero STARKs</h4>
              <p className="text-sm text-base-gray-400">
                Zero-knowledge proofs generated using RISC Zero's zkVM. Your belief text and loyalty score
                stay private - only the proof of validity is revealed.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-vaultfire-purple">🔗 Smart Contracts</h4>
              <p className="text-sm text-base-gray-400">
                DilithiumAttestor verifies signatures and STARK proofs on-chain. BeliefAttestationVerifier
                handles the cryptographic verification (~61k gas).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-vaultfire-green">⚡ Base Network</h4>
              <p className="text-sm text-base-gray-400">
                Fast, affordable L2 transactions on Base. Your belief attestations are permanently
                recorded with low fees and instant finality.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
