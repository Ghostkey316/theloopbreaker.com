import { Shield, Sparkles, Lock, Zap, Github, Database } from 'lucide-react';
import { StatsSection } from '@/components/StatsSection';
import { HowItWorks } from '@/components/HowItWorks';
import { SecurityLayer } from '@/components/SecurityLayer';
import { ProtocolContracts } from '@/components/ProtocolContracts';

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 safe-top">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-vaultfire flex items-center justify-center shadow-lg shadow-vaultfire-purple/20">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">Vaultfire</h1>
                <p className="text-[10px] sm:text-xs text-base-gray-400">on Base</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-vaultfire-green/10 border border-vaultfire-green/20 text-xs font-medium text-vaultfire-green">
              <span className="w-2 h-2 rounded-full bg-vaultfire-green animate-pulse" />
              Simulation Mode
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-base-blue/10 border border-base-blue/20 mb-4 sm:mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-base-blue animate-pulse" />
              <span className="text-xs sm:text-sm text-base-blue font-medium">
                13 Contracts — Zero-Knowledge Belief Attestation
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight">
              <span className="gradient-text inline-block">Prove Your Beliefs</span>
              <br />
              <span className="text-balance">Without Revealing Them</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg md:text-xl text-base-gray-300 max-w-2xl mx-auto mb-6 sm:mb-8 px-4 text-balance leading-relaxed">
              Use RISC Zero STARKs to create zero-knowledge proofs of your beliefs,
              linked to your GitHub, NS3, or Base activity. Privacy-first, post-quantum secure.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-20">
            <div className="card group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-vaultfire-purple to-vaultfire-purple-dark flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 tracking-tight">Post-Quantum Secure</h3>
              <p className="text-base-gray-400 text-sm leading-relaxed">RISC Zero STARK proofs resist quantum computer attacks</p>
            </div>
            <div className="card group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-base-blue to-base-blue-dark flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 tracking-tight">Zero-Knowledge</h3>
              <p className="text-base-gray-400 text-sm leading-relaxed">Your beliefs stay private. Only the proof is public.</p>
            </div>
            <div className="card group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-vaultfire-green to-vaultfire-green-dark flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-all duration-300 shadow-lg">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 tracking-tight">Behavior = Belief</h3>
              <p className="text-base-gray-400 text-sm leading-relaxed">Link proofs to GitHub commits, NS3 logins, or Base transactions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Security Enhancements */}
      <SecurityLayer />

      {/* How It Works */}
      <HowItWorks />

      {/* Protocol Contracts */}
      <ProtocolContracts />

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 sm:py-12 px-4 sm:px-6 safe-bottom">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-vaultfire flex items-center justify-center shadow-lg shadow-vaultfire-purple/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm sm:text-base">Vaultfire Protocol</p>
                <p className="text-xs sm:text-sm text-base-gray-400">13 contracts on Base</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-base-gray-400">
              <a
                href="https://github.com/Ghostkey316/ghostkey-316-vaultfire-init"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-2 focus-ring rounded-lg p-1"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
              <a
                href="#"
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
              Alpha demo • Simulation mode — no wallet required • Open source • Audited
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
