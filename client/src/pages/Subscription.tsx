import { Flame, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Subscription() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <Flame className="h-10 w-10 text-orange-500 mx-auto" />
          <h1 className="text-3xl font-bold text-white">Vaultfire Plans</h1>
          <p className="text-gray-500">Everything you need, completely free.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className="rounded-2xl border-2 border-orange-500 bg-[#111] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Free</h2>
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium">Current Plan</span>
            </div>
            <p className="text-3xl font-bold text-white">$0<span className="text-sm text-gray-500 font-normal">/forever</span></p>
            <ul className="space-y-2">
              {["Ember AI Assistant (unlimited)", "Trust Verification", "Cross-Chain Bridge", "Wallet Integration", "Full Dashboard Access", "Conversation History", "Admin Panel"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300"><Check className="h-4 w-4 text-orange-500 shrink-0" />{f}</li>
              ))}
            </ul>
            <Button onClick={() => setLocation("/ember")} className="w-full bg-orange-600 hover:bg-orange-700 text-white">Start Using Ember</Button>
          </div>
          {/* Pro Plan */}
          <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-4 opacity-60">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-500" />Pro</h2>
              <span className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <p className="text-3xl font-bold text-gray-500">TBD</p>
            <ul className="space-y-2">
              {["Everything in Free", "Priority AI responses", "Advanced analytics", "Custom AI personas", "API access", "Priority support"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-500"><Check className="h-4 w-4 text-gray-600 shrink-0" />{f}</li>
              ))}
            </ul>
            <Button disabled className="w-full bg-white/5 text-gray-500 cursor-not-allowed">Coming Soon</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
