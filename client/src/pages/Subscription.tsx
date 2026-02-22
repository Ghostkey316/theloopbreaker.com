import { Flame, Check, Crown, ArrowLeft, Sparkles, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Subscription() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Vaultfire</span>
          </button>
          <button onClick={() => setLocation("/")} className="text-sm text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">Pricing</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Everything is <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">free</span>
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
            Full access to the Vaultfire Protocol ecosystem. No credit card required, no hidden fees, no limits.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Plan */}
          <div className="relative rounded-2xl border-2 border-orange-500/50 bg-gradient-to-b from-[#111] to-[#0d0d0d] p-8 space-y-6 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-full blur-[60px] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <h2 className="text-xl font-bold text-white">Free</h2>
                </div>
                <span className="text-[10px] uppercase tracking-widest bg-orange-500/15 text-orange-400 px-3 py-1 rounded-full font-semibold">
                  Active
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-white">$0</span>
                <span className="text-gray-500 text-sm">/forever</span>
              </div>
              <p className="text-xs text-gray-600">No credit card required</p>
            </div>

            <div className="h-px bg-white/5" />

            <ul className="space-y-3">
              {[
                { text: "Ember AI Assistant", sub: "Unlimited messages" },
                { text: "Trust Verification", sub: "On-chain identity" },
                { text: "Cross-Chain Bridge", sub: "Ethereum, Base & Avalanche" },
                { text: "Wallet Integration", sub: "MetaMask, Coinbase, Brave" },
                { text: "Conversation History", sub: "Full persistence" },
                { text: "Dashboard Access", sub: "All features" },
                { text: "Admin Panel", sub: "Full control" },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-orange-500" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-200">{f.text}</span>
                    <span className="text-xs text-gray-600 block">{f.sub}</span>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => setLocation("/ember")}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg shadow-orange-500/15 py-5 rounded-xl gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Start Using Ember
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="relative rounded-2xl border border-white/5 bg-[#111]/50 p-8 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500/50" />
                  <h2 className="text-xl font-bold text-gray-400">Pro</h2>
                </div>
                <span className="text-[10px] uppercase tracking-widest bg-white/5 text-gray-500 px-3 py-1 rounded-full font-semibold">
                  Coming Soon
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-gray-600">TBD</span>
              </div>
              <p className="text-xs text-gray-700">Pricing announced soon</p>
            </div>

            <div className="h-px bg-white/5" />

            <ul className="space-y-3">
              {[
                { text: "Everything in Free", sub: "All current features" },
                { text: "Priority AI Responses", sub: "Faster processing" },
                { text: "Advanced Analytics", sub: "Deep protocol insights" },
                { text: "Custom AI Personas", sub: "Tailored assistants" },
                { text: "API Access", sub: "Programmatic integration" },
                { text: "Priority Support", sub: "Dedicated assistance" },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/3 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-gray-600" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">{f.text}</span>
                    <span className="text-xs text-gray-700 block">{f.sub}</span>
                  </div>
                </li>
              ))}
            </ul>

            <Button disabled className="w-full bg-white/3 text-gray-600 py-5 rounded-xl cursor-not-allowed border border-white/5">
              Coming Soon
            </Button>
          </div>
        </div>

        {/* Bottom note */}
        <div className="text-center mt-12">
          <p className="text-xs text-gray-600">
            Vaultfire Protocol is built for people, not profit. All core features are and will remain free.
          </p>
        </div>
      </div>
    </div>
  );
}
