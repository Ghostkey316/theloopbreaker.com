import { Mail, ShieldX, Shield, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface EmptyInboxStateProps {
  showSpam?: boolean;
}

export function EmptyInboxState({ showSpam = false }: EmptyInboxStateProps) {
  if (showSpam) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldX size={48} className="text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No Spam Messages</h3>
        <p className="text-sm text-gray-500">
          Vaultfire is protecting your inbox from unverified senders
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-2xl mx-auto">
      {/* Main Icon */}
      <div className="relative mb-6">
        <Mail size={64} className="text-gray-600" />
        <div className="absolute -bottom-1 -right-1 bg-vaultfire-primary rounded-full p-2">
          <Shield size={24} className="text-white" />
        </div>
      </div>

      {/* Main Heading */}
      <h3 className="text-2xl font-bold text-gray-200 mb-3">
        Welcome to Verified DMs
      </h3>

      {/* Subheading */}
      <p className="text-gray-400 mb-8 max-w-md">
        Every message includes <span className="text-vaultfire-primary font-semibold">cryptographic proof</span> of sender identity and reputation. This is not just another inbox—it&apos;s trust without surveillance.
      </p>

      {/* How It Works */}
      <div className="w-full mb-8 bg-gray-800/30 rounded-lg p-6 border border-gray-700">
        <h4 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Shield className="text-vaultfire-primary" size={20} />
          How Vaultfire Verification Works
        </h4>
        <div className="space-y-4 text-left">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300 font-medium">Cryptographic Attestations</p>
              <p className="text-xs text-gray-500">Every sender has an on-chain attestation with a reputation score</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300 font-medium">Automatic Spam Filtering</p>
              <p className="text-xs text-gray-500">Messages from low-reputation senders go directly to spam</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300 font-medium">Privacy-First Design</p>
              <p className="text-xs text-gray-500">End-to-end encrypted via XMTP, verified via Vaultfire</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Levels */}
      <div className="w-full mb-8">
        <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          Verification Levels You&apos;ll See
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-xs font-semibold text-emerald-400">Highly Trusted</span>
            </div>
            <p className="text-xs text-gray-500">Score 80+</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-xs font-semibold text-blue-400">Trusted</span>
            </div>
            <p className="text-xs text-gray-500">Score 60-79</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <span className="text-xs font-semibold text-yellow-400">Verified</span>
            </div>
            <p className="text-xs text-gray-500">Score 40-59</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-400"></div>
              <span className="text-xs font-semibold text-red-400">Low Trust</span>
            </div>
            <p className="text-xs text-gray-500">Score &lt;40 → Spam</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-sm text-gray-500">
        <p>Once you start receiving messages, they&apos;ll appear here with their</p>
        <p className="mt-1">verification status, reputation score, and trust level.</p>
      </div>
    </div>
  );
}
