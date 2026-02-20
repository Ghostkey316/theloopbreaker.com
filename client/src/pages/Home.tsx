import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Shield,
  ArrowRightLeft,
  Users,
  Sparkles,
  CreditCard,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useState } from "react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Ember AI", path: "/ember", icon: Flame },
    { label: "Plans", path: "/subscription", icon: CreditCard },
  ];

  const features = [
    {
      icon: Shield,
      title: "Trust Verification",
      desc: "On-chain identity verification powered by ERC-8004. Cryptographic proof of trust without compromising privacy.",
      tag: "Core",
    },
    {
      icon: ArrowRightLeft,
      title: "Cross-Chain Bridge",
      desc: "Teleporter bridge between Base and Avalanche with sub-minute finality and zero slippage guarantees.",
      tag: "Bridge",
    },
    {
      icon: Users,
      title: "AI Partnership Bonds",
      desc: "Smart contracts binding AI agents to accountability frameworks. Transparent, auditable, enforceable.",
      tag: "AI",
    },
    {
      icon: Lock,
      title: "Belief Attestations",
      desc: "On-chain attestations of trust and belief. Stake your reputation on what matters to you.",
      tag: "Identity",
    },
    {
      icon: Globe,
      title: "Multisig Governance",
      desc: "Decentralized protocol governance with weighted voting, time-locked proposals, and transparent execution.",
      tag: "DAO",
    },
    {
      icon: Zap,
      title: "Flourishing Oracle",
      desc: "On-chain oracle for human flourishing metrics. Data-driven impact measurement for the real world.",
      tag: "Oracle",
    },
  ];

  const stats = [
    { value: "ERC-8004", label: "Custom Standard" },
    { value: "2", label: "Chains Supported" },
    { value: "100%", label: "Free Access" },
    { value: "<1min", label: "Bridge Finality" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-shadow">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">Vaultfire</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-2" />
            {isAuthenticated ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-xs text-orange-400 font-medium">
                    {(user?.name || "U")[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-gray-300">{user?.name || "User"}</span>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl px-6 py-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { setLocation(item.path); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-all"
              >
                <item.icon className="h-4 w-4 text-orange-500" />
                {item.label}
              </button>
            ))}
            {!isAuthenticated && (
              <Button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white mt-2"
              >
                Sign In
              </Button>
            )}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
                Built on Base &amp; Avalanche
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-white">Trust Infrastructure</span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                for the Open Web
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
              Vaultfire Protocol delivers on-chain identity verification, cross-chain bridges, and AI accountability
              — so trust becomes programmable, portable, and provable.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-16">
              <Button
                onClick={() => setLocation("/ember")}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-xl shadow-orange-500/20 hover:shadow-orange-500/30 transition-all px-8 py-6 text-base gap-2 rounded-xl"
              >
                <Sparkles className="h-4 w-4" />
                Talk to Ember AI
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/subscription")}
                className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl"
              >
                View Plans — It's Free
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 w-full max-w-2xl">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Protocol Architecture</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Six interlocking modules that make trust programmable across chains.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-white/5 bg-[#111]/80 p-6 hover:border-orange-500/20 hover:bg-[#111] transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/15 transition-colors">
                    <f.icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium px-2 py-1 rounded-md bg-white/3 border border-white/5">
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-white mb-2 group-hover:text-orange-50 transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-3xl border border-white/5 bg-gradient-to-br from-[#111] to-[#0d0d0d] p-10 md:p-16 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <Flame className="h-7 w-7 text-orange-500" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Meet Ember, Your AI Guide
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed">
                Ember understands the entire Vaultfire ecosystem — trust verification, bridging, governance, and more.
                Ask anything, get clear answers.
              </p>
              <Button
                onClick={() => setLocation("/ember")}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-xl shadow-orange-500/20 px-8 py-6 text-base gap-2 rounded-xl"
              >
                <Sparkles className="h-4 w-4" />
                Start a Conversation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Flame className="h-4 w-4 text-orange-500/50" />
            <span>Vaultfire Protocol</span>
            <span className="text-gray-700">·</span>
            <span>Built for people, not profit</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <button onClick={() => setLocation("/ember")} className="hover:text-orange-400 transition-colors">
              Ember AI
            </button>
            <button onClick={() => setLocation("/subscription")} className="hover:text-orange-400 transition-colors">
              Plans
            </button>
            <a
              href="https://github.com/Ghostkey316/ghostkey-316-vaultfire-init"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors flex items-center gap-1"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
