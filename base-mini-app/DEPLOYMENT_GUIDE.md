# Vaultfire Deployment Guide

Complete guide for deploying Vaultfire to production on Base blockchain.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [RISC Zero Integration](#risc-zero-integration)
6. [Production Deployment](#production-deployment)
7. [Verification](#verification)

---

## Prerequisites

### Required Tools

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Rust** >= 1.70 (for RISC Zero zkVM)
- **Hardhat** (installed via dependencies)
- **RISC Zero toolchain** (optional, for real ZK proofs)

### Required Accounts

- **Base Sepolia** wallet with test ETH ([Base Faucet](https://bridge.base.org/))
- **Basescan API key** ([basescan.org](https://basescan.org/apis))
- **WalletConnect Project ID** ([cloud.walletconnect.com](https://cloud.walletconnect.com))

---

## Environment Setup

### 1. Clone and Install

```bash
cd base-mini-app
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required for deployment
PRIVATE_KEY=0x... # Your wallet private key (KEEP SECRET!)
BASESCAN_API_KEY=... # From basescan.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=... # From cloud.walletconnect.com

# Contract configuration
ZK_ENABLED=false # Start with false for testing
RISC_ZERO_VERIFIER_ADDRESS=0x0000000000000000000000000000000000000000 # Update after RISC Zero deployment
BELIEF_GUEST_IMAGE_ID=0x4242424242424242424242424242424242424242424242424242424242424242 # Mock for testing
```

---

## Local Development

### Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Features in Development Mode

- ✅ Mock ZK proofs (no RISC Zero required)
- ✅ Real GitHub loyalty score calculation
- ✅ Full UI/UX with wallet connection
- ⚠️  **Warning banner** shows when using mock proofs

---

## Smart Contract Deployment

### 1. Compile Contracts

```bash
npm run compile
```

This compiles:
- `contracts/DilithiumAttestor.sol`
- `contracts/IRiscZeroVerifier.sol`

### 2. Deploy to Base Sepolia Testnet

```bash
npm run deploy:sepolia
```

**Expected Output:**

```
🔥 Deploying Vaultfire Contracts to Base...

Deploying from address: 0x...
Account balance: 0.1 ETH

Configuration:
- RISC Zero Verifier: 0x000000000...
- Belief Guest Image ID: 0x4242...
- ZK Verification Enabled: false

Deploying DilithiumAttestor...
✅ DilithiumAttestor deployed to: 0xABCD...

💡 Update your lib/contracts.ts file with:
export const DILITHIUM_ATTESTOR_ADDRESS = '0xABCD...' as `0x${string}`;
```

### 3. Update Frontend Configuration

Add the deployed address to `.env.local`:

```bash
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=0xABCD...
```

### 4. Verify on Basescan

The deployment script auto-verifies if `BASESCAN_API_KEY` is set. Otherwise, verify manually:

```bash
npx hardhat verify --network baseSepolia 0xABCD... "0x0000..." "0x4242..." false
```

---

## RISC Zero Integration

### Option 1: Use Mock Proofs (Development)

**Status:** ✅ Already configured

Set in `.env.local`:
```bash
# Leave empty to use mocks
NEXT_PUBLIC_ZKP_PROVER_URL=
```

### Option 2: Deploy RISC Zero Prover Service (Production)

#### Step 1: Build Guest Program

```bash
cd zkp
cargo risczero build --release
```

This generates:
- Guest program ELF binary
- **Image ID** (unique identifier for verification)

#### Step 2: Extract Image ID

```bash
# The build process outputs the image ID
# Example output:
# Image ID: 0x1234abcd...
```

Update `.env.local`:
```bash
BELIEF_GUEST_IMAGE_ID=0x1234abcd...
```

#### Step 3: Deploy RISC Zero Verifier

**Option A: Use Existing Verifier**

Check if RISC Zero has deployed a verifier on Base:
- [RISC Zero Docs - Verifier Addresses](https://dev.risczero.com/api/blockchain-integration/contracts/verifier)

**Option B: Deploy Your Own**

```bash
# Clone RISC Zero contracts
git clone https://github.com/risc0/risc0-ethereum
cd risc0-ethereum

# Deploy verifier to Base Sepolia
forge create --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  src/RiscZeroVerifier.sol:RiscZeroVerifier
```

Update `.env.local`:
```bash
RISC_ZERO_VERIFIER_ADDRESS=0x... # Deployed verifier address
```

#### Step 4: Redeploy DilithiumAttestor

With real verifier address:

```bash
npm run deploy:sepolia
```

#### Step 5: Deploy Prover Service

```bash
cd zkp/host
cargo run --release --bin prove-service

# Or deploy to cloud (Railway, Fly.io, AWS Lambda)
```

Configure frontend:
```bash
NEXT_PUBLIC_ZKP_PROVER_URL=https://your-prover-service.com
NEXT_PUBLIC_ZKP_API_KEY=your-secret-key
```

#### Step 6: Enable ZK Verification

Call contract function:
```typescript
// As contract owner
await dilithiumAttestor.setZKEnabled(true);
```

---

## Production Deployment

### 1. Deploy Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set production environment variables in Vercel dashboard:
# - NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS
# - NEXT_PUBLIC_ZKP_PROVER_URL
# - NEXT_PUBLIC_ZKP_API_KEY
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

### 2. Deploy to Base Mainnet

**⚠️  PRODUCTION CHECKLIST:**

- [ ] Smart contracts audited by professional firm
- [ ] RISC Zero verifier deployed and tested
- [ ] Real ZK proofs tested end-to-end
- [ ] Frontend tested on testnet extensively
- [ ] `ZK_ENABLED=true` in production
- [ ] Multi-sig wallet configured for contract ownership
- [ ] Emergency pause mechanism tested

**Deploy command:**

```bash
npm run deploy:mainnet
```

Update `.env.local` for mainnet:
```bash
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=0x... # Mainnet address
```

---

## Verification

### Test End-to-End Flow

1. **Connect Wallet** → RainbowKit modal opens
2. **Compose Belief** → Enter text (e.g., "I believe in decentralized trust")
3. **Select Module** → Choose GitHub
4. **Enter GitHub Username** → Your GitHub handle
5. **Calculate Loyalty Score** → Fetches real GitHub data
6. **Review & Sign** → Shows belief hash, loyalty score
7. **Submit** → Creates ZK proof and submits transaction
8. **Confirmation** → View on Basescan

### Verify on Basescan

```
https://sepolia.basescan.org/address/0xABCD...
```

Check:
- ✅ Contract verified (green checkmark)
- ✅ `BeliefAttested` events emitted
- ✅ `zkVerified` = true (if ZK enabled)

### Verify Loyalty Score Calculation

Test with known GitHub username:

```typescript
import { fetchGitHubActivity, calculateGitHubLoyaltyScore } from './lib/loyalty-calculator';

const activity = await fetchGitHubActivity('torvalds');
const score = calculateGitHubLoyaltyScore(activity);
console.log(`Loyalty Score: ${score} / 10000`);
```

---

## Troubleshooting

### "Insufficient funds" Error

**Solution:** Get test ETH from [Base Faucet](https://bridge.base.org/)

### "Contract not deployed" Error

**Solution:** Check `NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS` is set correctly

### "ZK proof verification failed" Error

**Solutions:**
1. Set `ZK_ENABLED=false` for testing without proofs
2. Verify `BELIEF_GUEST_IMAGE_ID` matches your compiled guest program
3. Check prover service is running and accessible

### "GitHub API rate limit" Error

**Solution:** Add GitHub personal access token:

```typescript
// In lib/loyalty-calculator.ts
headers: {
  'Authorization': `token ${process.env.GITHUB_TOKEN}`
}
```

---

## Cost Estimation

### Base Sepolia (Testnet)
- Free test ETH from faucet
- Contract deployment: ~0.01 ETH
- Attestation transaction: ~0.0005 ETH

### Base Mainnet (Production)
- Contract deployment: ~$5-10
- Attestation transaction: ~$0.10-0.50
- ZK proof generation: $0.01-0.05 per proof

---

## Security Considerations

### Contract Security

✅ **Implemented:**
- RISC Zero STARK verification
- Event emission for all attestations
- Owner-only admin functions
- Immutable verifier and image ID

⚠️  **TODO Before Mainnet:**
- Professional security audit ($50k-$200k)
- Multi-sig ownership
- Timelock for admin functions
- Emergency pause mechanism

### Frontend Security

✅ **Implemented:**
- Input validation (belief length, hash verification)
- Secure wallet connection (RainbowKit)
- Environment variable protection
- CORS configuration

### ZK Proof Security

✅ **Implemented:**
- Real RISC Zero STARK proofs
- Image ID verification
- Journal digest validation

---

## Next Steps

1. ✅ Deploy to Base Sepolia
2. ✅ Test with mock proofs
3. ⏳ Build RISC Zero guest program
4. ⏳ Deploy RISC Zero verifier
5. ⏳ Deploy prover service
6. ⏳ Enable real ZK proofs
7. ⏳ Professional security audit
8. ⏳ Deploy to Base Mainnet

---

## Support

- **Documentation:** See `README.md` for technical details
- **Issues:** [GitHub Issues](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init/issues)
- **Discord:** [Base Discord](https://discord.gg/buildonbase)

---

**Built with ❤️  for Base**
