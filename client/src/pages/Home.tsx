import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Flame, Shield, ArrowRightLeft, Users, Sparkles, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const navItems = [
    { label: "Ember AI", path: "/ember", icon: Flame },
    { label: "Subscription", path: "/subscription", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Flame className="h-6 w-6 text-orange-500" />
          <span className="font-bold text-lg">Vaultfire Protocol</span>
        </div>
        <div className="flex items-center gap-4">
          {navItems.map(item => (
            <button key={item.path} onClick={() => setLocation(item.path)} className="text-sm text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-1.5">
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
          {isAuthenticated ? (
            <span className="text-sm text-gray-500">{user?.name || "Signed in"}</span>
          ) : (
            <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }} className="bg-orange-600 hover:bg-orange-700 text-white">Sign In</Button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-orange-500/10 flex items-center justify-center mb-6">
          <Flame className="h-10 w-10 text-orange-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Vaultfire Protocol</h1>
        <p className="text-gray-500 max-w-lg mb-8">Web3 trust, identity, and AI accountability — built on Base and Avalanche. Powered by Ember AI.</p>
        <div className="flex gap-3">
          <Button onClick={() => setLocation("/ember")} className="bg-orange-600 hover:bg-orange-700 text-white gap-2"><Sparkles className="h-4 w-4" />Talk to Ember</Button>
          <Button variant="outline" onClick={() => setLocation("/subscription")} className="border-white/20 text-gray-300 hover:text-white">View Plans</Button>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto px-6 pb-24">
        {[
          { icon: Shield, title: "Trust Verification", desc: "On-chain identity verification with ERC-8004" },
          { icon: ArrowRightLeft, title: "Cross-Chain Bridge", desc: "Teleporter bridge between Base and Avalanche" },
          { icon: Users, title: "AI Partnership Bonds", desc: "Smart contracts binding AI agents to accountability" },
        ].map(f => (
          <div key={f.title} className="rounded-xl border border-white/10 bg-[#111] p-6 space-y-3">
            <f.icon className="h-8 w-8 text-orange-500" />
            <h3 className="font-semibold text-white">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
