import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Shield, CheckCircle, ShieldCheck, Lock, Zap } from 'lucide-react';

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push('/inbox');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo/Icon */}
          <div className="mb-8 flex justify-center">
            <div className="verified-badge p-6 rounded-full">
              <Shield size={64} className="text-white" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-balance">
            Verified DMs
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-vaultfire-primary to-vaultfire-accent">
              Powered by Vaultfire + XMTP
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-gray-300 mb-12 text-balance">
            Experience the future of messaging with built-in identity verification and anti-spam protection.
            Vaultfire's proof/policy layer makes XMTP messages trustworthy.
          </p>

          {/* CTA */}
          <div className="flex justify-center gap-4">
            <ConnectButton />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <div className="glass-effect p-8 rounded-2xl">
            <div className="mb-4 inline-block p-3 bg-emerald-500/20 rounded-full">
              <ShieldCheck className="text-emerald-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Verified Senders</h3>
            <p className="text-gray-400">
              Every message includes cryptographic proof of sender identity and reputation.
              Know who you're talking to.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-effect p-8 rounded-2xl">
            <div className="mb-4 inline-block p-3 bg-blue-500/20 rounded-full">
              <Lock className="text-blue-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Anti-Spam Inbox</h3>
            <p className="text-gray-400">
              Automatic filtering based on Vaultfire attestations. Only verified senders reach your inbox.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-effect p-8 rounded-2xl">
            <div className="mb-4 inline-block p-3 bg-purple-500/20 rounded-full">
              <Zap className="text-purple-400" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-3">Gated Access</h3>
            <p className="text-gray-400">
              Set custom verification policies. Require minimum reputation scores or specific attestations.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-vaultfire-primary rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">XMTP Messaging</h3>
                <p className="text-gray-400">
                  XMTP provides the decentralized messaging protocol. Messages are encrypted end-to-end
                  and stored on a distributed network.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-vaultfire-secondary rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Vaultfire Verification</h3>
                <p className="text-gray-400">
                  Vaultfire adds a proof/policy layer on top. Each sender gets verified with on-chain
                  attestations, reputation scores, and zero-knowledge proofs.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-vaultfire-accent rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Smart Filtering</h3>
                <p className="text-gray-400">
                  Messages are automatically filtered based on verification status. Unverified or
                  low-reputation senders go to spam. Your inbox stays clean.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Notice */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto glass-effect p-8 rounded-2xl border-2 border-vaultfire-primary/50">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <CheckCircle className="text-vaultfire-primary" />
            Demo for Shane Mac
          </h3>
          <p className="text-gray-300 mb-4">
            This is a proof-of-concept demonstrating how Vaultfire can provide a verification layer
            for XMTP messages. Features include:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400 mb-6">
            <li>Real-time sender verification with reputation scoring</li>
            <li>Automatic spam filtering based on attestation policies</li>
            <li>Verified badge system showing trust levels</li>
            <li>Customizable verification requirements</li>
            <li>Integration with existing XMTP infrastructure</li>
          </ul>
          <p className="text-sm text-gray-500">
            Connect your wallet to test the verified messaging experience. The demo uses XMTP's production
            network with Vaultfire's verification layer.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>
            Built with <span className="text-vaultfire-primary">♥</span> using Vaultfire Protocol + XMTP
          </p>
          <p className="text-sm mt-2">
            <a
              href="https://github.com/ghostkey316/ghostkey-316-vaultfire-init"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-vaultfire-primary transition-colors"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
