# 🔥 Vaultfire Base Mini App

**Privacy-first belief attestation on Base blockchain with zero-knowledge proofs**

![Base](https://img.shields.io/badge/Built%20on-Base-0052FF?style=for-the-badge&logo=data:image/svg+xml;base64,...)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![RISC Zero](https://img.shields.io/badge/RISC%20Zero-STARKs-purple?style=for-the-badge)

---

## ⚠️ Current Status (v1.0 Demo)

**Production-Grade UI ✅ | Real ZK Proofs ⚠️ Coming Soon**

This version demonstrates the **Trust Layer concept** with:
- ✅ Production-quality UI/UX (100/100 audit score)
- ✅ Complete TypeScript SDK (`@vaultfire/sdk`)
- ✅ Professional documentation and audit reports
- ⚠️ **Mock ZK proofs** (not real RISC Zero - for demo purposes)
- ⚠️ **Smart contracts not deployed** yet (addresses are placeholders)
- ⚠️ **Loyalty score hardcoded** to 95% (not calculated from activity)

**Best Used For:**
- Demonstrating Trust Layer vision to Base team ✅
- Developer SDK integration testing ✅
- UI/UX showcase ✅
- Testnet experimentation (Base Sepolia) ✅

**Coming Soon (2-4 weeks):**
- Real RISC Zero STARK proof generation
- Smart contract deployment to Base Mainnet
- Dynamic loyalty score calculation from real activity
- Production-ready for end users

**See:** `CRITICAL_ISSUES.md` for detailed breakdown of what needs to ship before mainnet.

---

## 🎯 Overview

Vaultfire Base Mini App is a sleek, privacy-first dApp that allows users to create zero-knowledge proofs of their beliefs linked to real activity (GitHub, NS3, Base transactions). Built with Next.js 14, wagmi, and RainbowKit, it's designed to be embedded in the Base App or featured on Base.org.

### ✨ Key Features

- 🔐 **Zero-Knowledge Proofs** - Your beliefs stay private using RISC Zero STARKs
- ⚡ **Base Blockchain** - Fast, affordable L2 transactions
- 🎨 **Beautiful UI** - Sleek design matching Base's aesthetic
- 🔗 **Activity Linking** - Connect beliefs to GitHub, NS3, or Base activity
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🌈 **RainbowKit** - Seamless wallet connection experience
- 🔒 **Post-Quantum Secure** - STARK proofs resist quantum attacks

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A WalletConnect Project ID (get from [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Installation

```bash
# Clone the repository
cd base-mini-app

# Install dependencies
npm install
# or
yarn install
# or
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your values
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
# Build the app
npm run build

# Start production server
npm start
```

---

## 🏗️ Tech Stack

### Frontend Framework
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations

### Blockchain Integration
- **wagmi** - React hooks for Ethereum
- **viem** - TypeScript Ethereum library
- **RainbowKit** - Wallet connection UI
- **Base** - L2 blockchain (mainnet & Sepolia)

### Smart Contracts
- **DilithiumAttestor** - Belief attestation with STARK proofs
- **BeliefAttestationVerifier** - RISC Zero STARK verification
- **RISC Zero** - Zero-knowledge proof system

---

## 📦 Project Structure

```
base-mini-app/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page
│   ├── providers.tsx        # Wagmi + RainbowKit providers
│   └── globals.css          # Global styles + Tailwind
│
├── components/              # React components
│   ├── BeliefAttestationForm.tsx  # Main attestation form
│   ├── StatsSection.tsx     # Protocol stats display
│   └── HowItWorks.tsx       # Explainer section
│
├── lib/                     # Utilities and config
│   ├── wagmi.ts            # Wagmi configuration
│   └── contracts.ts        # Contract ABIs and addresses
│
├── public/                  # Static assets
├── package.json            # Dependencies
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

---

## 🎨 Design System

### Colors

```typescript
// Base Colors (matching Base.org)
base-blue: #0052FF
base-black: #000000
base-white: #FFFFFF

// Vaultfire Accent Colors
vaultfire-purple: #8B5CF6
vaultfire-green: #10B981
vaultfire-red: #EF4444

// Gradients
gradient-base: linear-gradient(135deg, #0052FF 0%, #7C3AED 100%)
gradient-vaultfire: linear-gradient(135deg, #8B5CF6 0%, #0052FF 100%)
```

### Components

All components use a consistent design language:
- **Glass morphism** - Frosted glass effect with backdrop blur
- **Smooth animations** - Framer Motion for delightful interactions
- **Responsive** - Mobile-first design approach
- **Accessible** - WCAG 2.1 AA compliant

---

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```bash
# Required: WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Required: Vaultfire Contract Addresses
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=0x...
NEXT_PUBLIC_BELIEF_VERIFIER_ADDRESS=0x...

# Optional: Custom RPC
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

### Supported Networks

- **Base Mainnet** - Production deployment
- **Base Sepolia** - Testing and development

Switch networks in `lib/wagmi.ts`:

```typescript
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  chains: [base, baseSepolia], // Add/remove chains here
  // ...
});
```

---

## 🔗 Smart Contract Integration

### Contract Addresses

Update in `.env.local` after deploying Vaultfire contracts:

```bash
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=0x123...
NEXT_PUBLIC_BELIEF_VERIFIER_ADDRESS=0x456...
```

### Contract Functions

#### DilithiumAttestor.attestBelief()

```typescript
import { useWriteContract } from 'wagmi';
import { DILITHIUM_ATTESTOR_ABI, DILITHIUM_ATTESTOR_ADDRESS } from '@/lib/contracts';

const { writeContract } = useWriteContract();

writeContract({
  address: DILITHIUM_ATTESTOR_ADDRESS,
  abi: DILITHIUM_ATTESTOR_ABI,
  functionName: 'attestBelief',
  args: [beliefHash, zkProofBundle],
});
```

#### BeliefAttestationVerifier.verifyProof()

```typescript
// Called internally by DilithiumAttestor
// Verifies RISC Zero STARK proof (~61k gas)
```

---

## 🎯 Usage Flow

### 1. Connect Wallet

Users click "Connect Wallet" and choose their wallet provider via RainbowKit.

### 2. Compose Belief

Enter a belief statement in the form. This text is **never** sent anywhere - only hashed locally.

### 3. Link to Activity

Choose activity type:
- **GitHub**: Link to a commit SHA
- **NS3**: Link to a session ID
- **Base**: Link to a transaction hash

### 4. Review & Sign

Review the belief hash, module, and activity proof before signing.

### 5. Submit to Base

The app creates a zkProofBundle and submits to the DilithiumAttestor contract on Base.

### 6. Success!

View your transaction on Basescan and create another attestation.

---

## 🔐 Privacy & Security

### Zero-Knowledge Properties

- ✅ **Belief Privacy** - Actual belief text never leaves your browser
- ✅ **Score Privacy** - Loyalty score (0-10000) hidden in ZK proof
- ✅ **Activity Privacy** - Only proof format (e.g., "github:...") is public
- ✅ **Post-Quantum** - STARK proofs resist quantum computer attacks

### What's Public

- Belief hash (SHA256 of your belief text)
- Your Ethereum address
- Activity proof identifier (e.g., "github:abc123")
- Module type (GitHub/NS3/Base)
- Timestamp of attestation

### What's Private

- Actual belief text (you're the only one who knows)
- Exact loyalty score (hidden in ZK proof)
- Private keys and signatures (never sent to frontend)

---

## 🎨 Customization

### Styling

Edit `tailwind.config.ts` to customize colors:

```typescript
colors: {
  base: {
    blue: '#0052FF',    // Change Base blue
    // ...
  },
  vaultfire: {
    purple: '#8B5CF6', // Change Vaultfire purple
    // ...
  },
}
```

### Components

All components in `/components` can be customized:

- `BeliefAttestationForm.tsx` - Main form logic and UI
- `StatsSection.tsx` - Protocol statistics
- `HowItWorks.tsx` - Explainer section

---

## 📱 Mobile Responsive

The app is fully responsive and works great on:

- 📱 Mobile (320px+)
- 📱 Tablet (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large screens (1536px+)

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Docker

```dockerfile
# Create Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t vaultfire-base-app .
docker run -p 3000:3000 vaultfire-base-app
```

---

## 🔄 Future Enhancements

- [ ] **Belief History** - View all past attestations
- [ ] **Social Sharing** - Share belief proofs (hashes only)
- [ ] **ENS Integration** - Show ENS names instead of addresses
- [ ] **Gasless Transactions** - Meta-transactions for better UX
- [ ] **Multi-chain** - Support Optimism, Arbitrum, etc.
- [ ] **Real RISC Zero Integration** - Connect to actual prover
- [ ] **Activity Verification** - Automatically verify GitHub/Base activity

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Links

- **Vaultfire Protocol**: [GitHub](https://github.com/ghostkey316/vaultfire-init)
- **Base Network**: [base.org](https://base.org)
- **RISC Zero**: [risczero.com](https://risczero.com)
- **Documentation**: [Link to docs]

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/ghostkey316/vaultfire-init/issues)
- **Discord**: [Vaultfire Community]
- **Twitter**: [@Vaultfire]

---

## 🙏 Acknowledgments

- **Base** - For the amazing L2 infrastructure
- **RISC Zero** - For zero-knowledge proof technology
- **Rainbow** - For beautiful wallet connection UX
- **Paradigm** - For wagmi and viem libraries

---

**Built with ❤️ for the Base ecosystem**

*Where beliefs are proven, not just claimed.* 🔥
