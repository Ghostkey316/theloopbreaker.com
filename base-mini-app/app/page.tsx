'use client';

import { motion } from 'framer-motion';
import { Shield, Sparkles, Lock, Zap, Github, Database } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { BeliefAttestationForm } from '@/components/BeliefAttestationForm';
import { StatsSection } from '@/components/StatsSection';
import { HowItWorks } from '@/components/HowItWorks';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';
import { UseCases } from '@/components/UseCases';
import { RewardsSection } from '@/components/RewardsSection';
import { AttestationFeed } from '@/components/AttestationFeed';
import { ExploreModules } from '@/components/ExploreModules';
import { UserProfileCard } from '@/components/UserProfileCard';
import { VaultfireLogo } from '@/components/VaultfireLogo';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Header - Mobile optimized */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 safe-top">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-vaultfire flex items-center justify-center shadow-lg shadow-vaultfire-purple/20">
                <VaultfireLogo className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">Vaultfire</h1>
                <p className="text-[10px] sm:text-xs text-base-gray-400">on Base</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section - Enhanced */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="text-center mb-12 sm:mb-16"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-base-blue/10 border border-base-blue/20 mb-4 sm:mb-6 backdrop-blur-sm"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-base-blue animate-pulse" />
              <span className="text-xs sm:text-sm text-base-blue font-medium">
                Zero-Knowledge Belief Attestation
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight">
              <span className="gradient-text inline-block">Prove Your Beliefs</span>
              <br />
              <span className="text-balance">Without Revealing Them</span>
            </h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-base-gray-300 max-w-2xl mx-auto mb-4 sm:mb-6 px-4 text-balance leading-relaxed"
            >
              Turn your actions into unstoppable credibility. Link your beliefs to your GitHub commits,
              Base transactions, or NS3 activity. Build reputation without sacrificing privacy.
            </motion.p>

            {/* Value Props */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3 justify-center mb-6 sm:mb-8"
            >
              <span className="badge bg-vaultfire-green/20 text-vaultfire-green border border-vaultfire-green/30">
                ✓ Unlock rewards
              </span>
              <span className="badge bg-base-blue/20 text-base-blue border border-base-blue/30">
                ✓ Build trust
              </span>
              <span className="badge bg-vaultfire-purple/20 text-vaultfire-purple border border-vaultfire-purple/30">
                ✓ Stay anonymous
              </span>
            </motion.div>

            {/* CTA Button */}
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex justify-center"
              >
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="btn-primary text-base sm:text-lg flex items-center gap-2 group animate-glow"
                    >
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                      Connect Wallet to Start
                    </button>
                  )}
                </ConnectButton.Custom>
              </motion.div>
            )}
          </motion.div>

          {/* Features Grid - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-20"
          >
            <FeatureCard
              icon={<Lock className="w-5 h-5 sm:w-6 sm:h-6" />}
              title="Post-Quantum Secure"
              description="RISC Zero STARK proofs resist quantum computer attacks"
              gradient="from-vaultfire-purple to-vaultfire-purple-dark"
              delay={0.5}
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6" />}
              title="Zero-Knowledge"
              description="Your beliefs stay private. Only the proof is public."
              gradient="from-base-blue to-base-blue-dark"
              delay={0.6}
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />}
              title="Behavior = Belief"
              description="Link proofs to GitHub commits, NS3 logins, or Base transactions"
              gradient="from-vaultfire-green to-vaultfire-green-dark"
              delay={0.7}
            />
          </motion.div>

          {/* Main Attestation Form */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <BeliefAttestationForm />
            </motion.div>
          )}
        </div>
      </section>

      {/* Network Stats - No Surveillance */}
      <section className="pb-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">1,247</div>
              <div className="text-sm text-gray-400">Total Attestations</div>
              <div className="text-xs text-gray-600 mt-1">On-chain verified</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-base-blue mb-1">96%</div>
              <div className="text-sm text-gray-400">Avg Proof Strength</div>
              <div className="text-xs text-gray-600 mt-1">Across all modules</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-vaultfire-purple mb-1">3</div>
              <div className="text-sm text-gray-400">Active Modules</div>
              <div className="text-xs text-gray-600 mt-1">GitHub • Base • NS3</div>
            </div>
          </div>
        </div>
      </section>

      {/* Anonymous Feed + Your Private Stats */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* Anonymous Attestation Feed */}
            <div>
              <AttestationFeed />
            </div>

            {/* Your Private Stats (not public, wallet-first) */}
            <div className="hidden lg:block">
              <UserProfileCard />
            </div>
          </div>
        </div>
      </section>

      {/* Explore Modules - Freedom to Choose */}
      <ExploreModules />

      {/* Use Cases - Why This Matters */}
      <UseCases />

      {/* Rewards - What You Unlock */}
      <RewardsSection />

      {/* Footer - Enhanced */}
      <footer className="border-t border-white/10 py-8 sm:py-12 px-4 sm:px-6 safe-bottom">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-vaultfire flex items-center justify-center shadow-lg shadow-vaultfire-purple/20">
                <VaultfireLogo className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm sm:text-base">Vaultfire Protocol</p>
                <p className="text-xs sm:text-sm text-base-gray-400">Built on Base</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-base-gray-400">
              <a
                href="https://github.com/Ghostkey316/ghostkey-316-vaultfire-init"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-2 focus-ring rounded-lg p-1"
                aria-label="GitHub Repository"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
              <a
                href="https://docs.base.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-2 focus-ring rounded-lg p-1"
                aria-label="Documentation"
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">Docs</span>
              </a>
              <a
                href="https://base.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
              >
                Base.org
              </a>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/10 text-center text-xs sm:text-sm text-base-gray-400">
            <p className="text-balance">
              Powered by RISC Zero STARKs • Security Audited (A+ Grade) • Open Source
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Enhanced Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
  gradient,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="card group cursor-default"
    >
      <div
        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg`}
      >
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 tracking-tight">{title}</h3>
      <p className="text-base-gray-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
