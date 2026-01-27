# Vaultfire Verified DMs Demo

**A perfect demonstration of Vaultfire + XMTP integration for Shane Mac**

This demo showcases how Vaultfire provides a proof/policy layer on top of XMTP to enable:
- ✅ Verified sender identities
- ✅ Anti-spam inbox filtering
- ✅ Reputation-based message routing
- ✅ Gated group access (framework ready)

## 🎯 What This Demonstrates

**XMTP** provides the decentralized messaging infrastructure.

**Vaultfire** adds the trust and verification layer:
- Every sender gets a verifiable attestation (score + reputation + verified status)
- Messages are automatically filtered based on verification policies
- Low-trust senders go to spam, verified senders reach your inbox
- Zero-knowledge proofs ensure privacy while maintaining trust

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- WalletConnect Project ID (get free from [cloud.walletconnect.com](https://cloud.walletconnect.com/))

### Installation

```bash
cd apps/verified-dm-demo
npm install
```

### Configuration

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Add your WalletConnect Project ID to `.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 How to Test

### For Shane Mac (or anyone testing):

1. **Connect Your Wallet**
   - Click "Connect Wallet" on the landing page
   - Connect using MetaMask, Coinbase Wallet, or any WalletConnect-compatible wallet
   - Must have Base or Base Sepolia network

2. **Explore the Interface**
   - You'll see two tabs: "Verified" and "Spam"
   - Verified tab shows messages from trusted senders (score ≥ 40)
   - Spam tab shows messages from unverified or low-reputation senders

3. **Send a Test Message**
   - To test, you'll need a second wallet address
   - Or ask someone to send you a message on XMTP
   - Messages will be automatically sorted based on Vaultfire verification

4. **Check Verification Badges**
   - Each sender has a colored badge showing their verification level:
     - 🟢 Green (80+ score): Highly Trusted
     - 🔵 Blue (60-79): Trusted
     - 🟡 Yellow (40-59): Verified
     - 🔴 Red (<40): Low Trust / Unverified

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         User Interface (Next.js)         │
│  - Landing Page                          │
│  - Inbox (Verified/Spam tabs)           │
│  - Message View                          │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────────┐  ┌───▼──────────────┐
│  XMTP Client   │  │ Vaultfire Client │
│  (Messaging)   │  │ (Verification)   │
└────────────────┘  └──────────────────┘
    │                    │
    │                    │
┌───▼────────────┐  ┌───▼──────────────┐
│ XMTP Network   │  │ Vaultfire        │
│ (Prod/Dev)     │  │ Attestations     │
└────────────────┘  └──────────────────┘
```

## 🔑 Key Features

### 1. Verified Sender Identity
Every message includes cryptographic proof of sender identity:
```typescript
interface VaultfireAttestation {
  address: string;
  score: number;          // 0-100 trust score
  verified: boolean;      // KYC/verification status
  reputation: number;     // Historical behavior score
  timestamp: number;
  proofHash?: string;     // ZK proof reference
}
```

### 2. Smart Inbox Filtering
Messages are automatically routed based on verification policy:
```typescript
interface VerificationPolicy {
  minScore?: number;         // Default: 40
  minReputation?: number;
  requireVerified?: boolean;
  allowList?: string[];      // Whitelist addresses
  blockList?: string[];      // Blacklist addresses
}
```

### 3. Real-time Verification
All messages are verified in real-time:
- Sender attestation is checked on message receipt
- Verification status is displayed with visual badges
- Messages can be re-routed if sender reputation changes

### 4. Privacy-First
- No behavioral tracking
- Zero-knowledge proofs for sensitive data
- Consent-based verification
- Right to be forgotten built-in

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Wallet**: RainbowKit + Wagmi + Viem
- **Messaging**: XMTP JS SDK v11
- **Styling**: Tailwind CSS
- **Verification**: Vaultfire Protocol
- **Network**: Base (production), Base Sepolia (testnet)

## 📁 Project Structure

```
apps/verified-dm-demo/
├── src/
│   ├── components/
│   │   ├── VerificationBadge.tsx    # Trust level badges
│   │   ├── ConversationList.tsx     # Inbox sidebar
│   │   └── MessageView.tsx          # Chat interface
│   ├── lib/
│   │   ├── wagmi.ts                 # Wallet configuration
│   │   ├── vaultfire.ts             # Verification layer
│   │   ├── xmtp.ts                  # XMTP + Vaultfire wrapper
│   │   └── utils.ts                 # Helper functions
│   ├── pages/
│   │   ├── index.tsx                # Landing page
│   │   ├── inbox.tsx                # Main inbox page
│   │   ├── _app.tsx                 # App wrapper
│   │   └── _document.tsx            # HTML document
│   └── styles/
│       └── globals.css              # Global styles
├── package.json
├── tsconfig.json
└── README.md
```

## 🎨 Customization

### Adjust Verification Thresholds

In `src/lib/xmtp.ts`, modify the default policy:

```typescript
private verificationPolicy: VerificationPolicy = {
  minScore: 40,              // Lower = more permissive
  requireVerified: false,    // Set true to require verified status
};
```

### Change Badge Colors

In `src/components/VerificationBadge.tsx`, adjust the scoring thresholds:

```typescript
const getColor = () => {
  if (attestation.score >= 80) return 'emerald';  // Highly trusted
  if (attestation.score >= 60) return 'blue';     // Trusted
  if (attestation.score >= 40) return 'yellow';   // Verified
  return 'red';                                    // Low trust
};
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variable: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
4. Deploy

### Other Platforms

```bash
npm run build
npm run start
```

## 🧪 Testing

For the best demo experience:

1. **Use two different wallets** to test message sending/receiving
2. **Check both Verified and Spam tabs** to see automatic filtering
3. **Observe verification badges** on each message
4. **Try adjusting verification policies** in the code to see different filtering behavior

## 🔐 Security Notes

**This is a demo application**. For production use:

- Implement proper key management (not browser storage)
- Add rate limiting and abuse prevention
- Use production Vaultfire attestation contracts
- Implement proper error handling and fallbacks
- Add end-to-end encryption key backup/recovery
- Conduct security audit

## 🎯 Next Steps for Production

To turn this demo into a production app:

1. **Deploy Vaultfire Contracts** to mainnet
2. **Integrate Real Attestations** from on-chain data
3. **Add ZK Proof Generation** for privacy-sensitive operations
4. **Implement Key Backup** for XMTP identity
5. **Add Group Chat Support** with gated access
6. **Build Mobile Apps** using React Native + XMTP
7. **Add Push Notifications** for new messages

## 📞 Support

**For Shane Mac or anyone testing:**

If you encounter any issues or have questions:
- GitHub: https://github.com/ghostkey316/ghostkey-316-vaultfire-init/issues
- Email: ghostkey316@proton.me

## 🙏 Credits

Built by the Vaultfire team using:
- [XMTP](https://xmtp.org/) - Decentralized messaging protocol
- [RainbowKit](https://rainbowkit.com/) - Wallet connection
- [Vaultfire Protocol](https://github.com/ghostkey316/ghostkey-316-vaultfire-init) - Trust infrastructure

---

**Ready to test verified DMs?** 🚀

Connect your wallet at http://localhost:3000 and experience the future of trusted messaging.
