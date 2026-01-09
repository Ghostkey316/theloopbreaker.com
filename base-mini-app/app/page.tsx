'use client';

import { motion } from 'framer-motion';
import { Shield, Sparkles, Lock, Zap, Github, Database } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { BeliefAttestationForm } from '@/components/BeliefAttestationForm';
import { StatsSection } from '@/components/StatsSection';
import { HowItWorks } from '@/components/HowItWorks';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-vaultfire flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Vaultfire</h1>
                <p className="text-xs text-base-gray-400">on Base</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <ConnectButton />
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-base-blue/10 border border-base-blue/20 mb-6">
              <Sparkles className="w-4 h-4 text-base-blue" />
              <span className="text-sm text-base-blue font-medium">
                Zero-Knowledge Belief Attestation
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="gradient-text">Prove Your Beliefs</span>
              <br />
              Without Revealing Them
            </h1>

            <p className="text-xl text-base-gray-300 max-w-2xl mx-auto mb-8">
              Use RISC Zero STARKs to create zero-knowledge proofs of your beliefs,
              linked to your GitHub, NS3, or Base activity. Privacy-first, post-quantum secure.
            </p>

            {!isConnected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="btn-primary text-lg flex items-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Connect Wallet to Start
                    </button>
                  )}
                </ConnectButton.Custom>
              </motion.div>
            )}
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-3 gap-6 mb-20"
          >
            <FeatureCard
              icon={<Lock className="w-6 h-6" />}
              title="Post-Quantum Secure"
              description="RISC Zero STARK proofs resist quantum computer attacks"
              gradient="from-vaultfire-purple to-vaultfire-purple-dark"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Zero-Knowledge"
              description="Your beliefs stay private. Only the proof is public."
              gradient="from-base-blue to-base-blue-dark"
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Behavior = Belief"
              description="Link proofs to GitHub commits, NS3 logins, or Base transactions"
              gradient="from-vaultfire-green to-vaultfire-green-dark"
            />
          </motion.div>

          {/* Main Attestation Form */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <BeliefAttestationForm />
            </motion.div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* How It Works */}
      <HowItWorks />

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-vaultfire flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Vaultfire Protocol</p>
                <p className="text-sm text-base-gray-400">Built on Base</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-base-gray-400">
              <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                <Database className="w-4 h-4" />
                Docs
              </a>
              <a href="https://base.org" className="hover:text-white transition-colors">
                Base.org
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-base-gray-400">
            <p>
              Powered by RISC Zero STARKs • Security Audited (A+ Grade) • Open Source
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="card group"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-base-gray-400 text-sm">{description}</p>
    </motion.div>
  );
}
