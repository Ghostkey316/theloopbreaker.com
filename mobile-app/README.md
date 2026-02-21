# Vaultfire AI — Mobile App

**The ethical AI wallet and agent for the Vaultfire Protocol.**

Vaultfire AI is a ChatGPT-style mobile wallet with an on-chain AI agent called **Embris** — the flame inside the Vaultfire shield. Embris uses OpenAI function calling with gpt-4o to execute live blockchain reads, analyze smart contracts, monitor wallets, and help users interact with the Vaultfire Protocol across Base and Avalanche.

Built for the **Avalanche Build Games** competition.

---

## Features

### Embris AI Agent
Embris is a full on-chain AI agent, not just a chatbot. Embris can:
- **Blockchain Analysis** — Look up any address or contract live on-chain using ethers.js
- **Smart Contract Analysis** — Check if contracts are verified, read functions, advise on safety
- **Wallet Monitoring** — Proactively alert users to new transactions, approvals, and threats
- **Task Execution** — Register as a Vaultfire agent, create bonds, submit feedback, revoke approvals
- **Trust Verification** — Check Vaultfire trust profiles before any transaction
- **Research & Knowledge** — Discuss crypto, web3, AI ethics, DeFi, security, and Vaultfire mechanics

### ChatGPT-Style Chat Interface
- Clean message bubbles (user right, AI left)
- Word-by-word streaming response effect
- Slide-out conversation sidebar with history
- "Embris is checking the chain..." status while tools execute
- Transaction preview modals before signing

### Multi-Chain Wallet
- ETH/AVAX balance display on Base and Avalanche
- ERC-20 token detection and balances
- Transaction history via BaseScan API
- Send tokens with Vaultfire trust verification
- Token approval management with one-tap revoke

### Trust Verify
- On-chain address lookup across all Vaultfire contracts
- Identity profile, reputation score, bonds, validation status
- Bridge status and adapter verification
- Auto-populates with connected wallet data

### Security
- Wallet security assessment
- Real token approval detection using `allowance()` calls
- Checks common DEX routers as spenders
- Flags unlimited approvals with red warning
- One-tap revoke with transaction preview and BaseScan confirmation

### Dashboard
- Live contract stats from all 14 Base contracts
- Identity agents, bonds, governance, oracle, bridge, attestation counts
- Pull-to-refresh with loading skeletons

### About
- Vaultfire mission and core values
- Protocol architecture overview
- All 28 contract addresses with Basescan/Snowtrace explorer links

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile framework |
| Expo SDK 54 | Development and build tooling |
| TypeScript | Type-safe development |
| NativeWind (Tailwind CSS) | Styling |
| ethers.js v6 | On-chain reads and transaction building |
| OpenAI API (gpt-4o) | Embris AI agent with function calling |
| AsyncStorage | Local conversation and wallet persistence |
| Express + tRPC | Server-side API with tool execution |
| expo-notifications | Local push notifications for wallet alerts |

---

## How to Run

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Expo Go app on your iOS/Android device

### Setup

```bash
cd mobile-app

# Install dependencies
pnpm install

# Set environment variables
# OPENAI_API_KEY — Required for Embris AI
# BASESCAN_API_KEY — Required for transaction history

# Start the development server
pnpm dev
```

### Run on Device

1. Start the dev server: `pnpm dev`
2. Scan the QR code with Expo Go (iOS) or the Expo app (Android)
3. The app will load on your device

### Run on Web

```bash
pnpm dev:metro
```

Open the URL shown in the terminal (typically `http://localhost:8081`).

---

## On-Chain Integration

The app integrates with **28 deployed Vaultfire Protocol contracts** across Base and Avalanche:

### Base Contracts (14)
- ERC8004IdentityRegistry
- ERC8004ReputationRegistry
- ERC8004ValidationRegistry
- AIPartnershipBondsV2
- AIAccountabilityBondsV2
- VaultfireERC8004Adapter
- MultisigGovernance
- FlourishingMetricsOracle
- BeliefAttestationVerifier (Production + Dev)
- VaultfireTeleporterBridge
- PrivacyGuarantees
- MissionEnforcement
- AntiSurveillance

### Avalanche Contracts (14)
- Full mirror deployment for cross-chain trust verification

---

## Embris Permission Levels

| Level | Description |
|---|---|
| **View Only** | Embris can see balances and trust profile, cannot suggest transactions |
| **Advisory** (default) | Embris suggests actions, user approves everything manually |
| **Guardian** | Embris proactively flags suspicious activity and recommends protective actions |

---

## Design — "Obsidian Forge" Theme

| Element | Color |
|---|---|
| Background | Deep black `#0A0A0F` |
| Primary accent | Embris orange `#F97316` |
| Secondary accent | Purple `#8B5CF6` |
| Cards | Dark gray `#1A1A2E` |
| Text | White `#FFFFFF` |
| Muted text | Gray `#9CA3AF` |

---

## Critical Rules

These rules are enforced at every level of the application:

1. **NEVER touch ASM tokens** — No transfer, no transferFrom, no approve calls on ASM
2. **Read-only by default** — All on-chain reads are free and permissionless
3. **User signs everything** — Every write transaction requires explicit user confirmation
4. **Zero tracking** — No analytics, no telemetry, no data collection
5. **Privacy first** — No personal data stored, no wallet data shared
6. **Only Vaultfire contracts** — The app only interacts with Vaultfire Protocol contracts

---

## Vaultfire Values

> **Morals over metrics. Privacy over surveillance. Freedom over control.**

Vaultfire Protocol exists to prove that AI can be accountable, transparent, and aligned with human dignity. Every agent registered on Vaultfire is bound by on-chain commitments to ethical behavior. Embris embodies these values — it's warm, real, trustworthy, and accountable.

---

## License

Built by the Vaultfire team for the Avalanche Build Games competition.
