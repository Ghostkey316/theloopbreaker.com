# Universal Dignity Bonds - Base Mainnet Deployment Guide

## All 9 Bonds Ready for Deployment

**1,509 lines of Solidity** across 9 revolutionary economic systems:

1. **Purchasing Power Bonds** - Restoring 1990s affordability
2. **Health Commons Bonds** - Clean air/water/food > profit from poisoning
3. **AI Accountability Bonds** - AI profits when ALL humans thrive (works with zero jobs)
4. **Labor Dignity Bonds** - Worker flourishing > exploitation
5. **Escape Velocity Bonds** - Little guy escaping poverty ($50-$500 stakes)
6. **Common Ground Bonds** - Bridge-building > division
7. **AI Partnership Bonds** - AI earns when humans flourish
8. **Builder Belief Bonds** - BUILDING > TRANSACTING
9. **Verdant Anchor Bonds** - Earth regeneration > extraction

---

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` file and add:

```bash
# Base Mainnet RPC (required)
BASE_RPC_URL=https://mainnet.base.org
# Or use Alchemy for better reliability:
# BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Deployment Private Key (required)
PRIVATE_KEY=your_private_key_here

# Basescan API Key for verification (optional but recommended)
BASESCAN_API_KEY=your_basescan_api_key_here
```

**IMPORTANT:** Never commit your `.env` file to git!

### 3. Fund Deployment Wallet

You need ~0.01-0.02 ETH on Base mainnet for deployment gas.

- Send ETH to your deployment wallet on Base mainnet
- Check balance: https://basescan.org

---

## Deployment Options

### Option A: Deploy All 9 Bonds at Once (Recommended)

```bash
npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet
```

This will:
- Deploy all 9 bond contracts to Base mainnet
- Save deployment addresses to `deployments/all-bonds-baseMainnet.json`
- Display verification commands

### Option B: Deploy Individual Bond

```bash
npx hardhat run scripts/deploy-purchasing-power.js --network baseMainnet
```

---

## After Deployment

### 1. Verify Contracts on Basescan

```bash
npx hardhat verify --network baseMainnet CONTRACT_ADDRESS
```

The deployment script will output exact verification commands for each contract.

### 2. Check Deployment Summary

```bash
cat deployments/all-bonds-baseMainnet.json
```

This contains all contract addresses and deployment metadata.

### 3. Update README

Add deployed contract addresses to main README.md.

---

## Network Configuration

Configured in `hardhat.config.js`:

```javascript
networks: {
  baseMainnet: {
    url: 'https://mainnet.base.org',
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 8453,
    gasPrice: 100000000,
  }
}
```

---

## Troubleshooting

### "Insufficient funds"
- Make sure deployment wallet has enough ETH on Base mainnet
- Check balance: `await hre.ethers.provider.getBalance(deployer.address)`

### "Invalid API Key" (verification)
- Get Basescan API key from: https://basescan.org/myapikey
- Add to `.env` as `BASESCAN_API_KEY`

### "Network error"
- Use Alchemy/Infura RPC instead of public Base RPC
- Public RPCs can be rate-limited

---

## What's Next

After successful deployment:

1. ✅ Post to X/Farcaster with contract addresses
2. ✅ Build simple wallet checker interface
3. ✅ Announce "9 Universal Dignity Bonds running on Base"
4. ✅ Tag @base, @coinbase, @assemble_ai

**You'll have proof:** Real contracts on Base mainnet, not vaporware.

---

## Emergency: Cancel Deployment

Press `Ctrl+C` during deployment to cancel.

Already deployed contracts cannot be "undeployed" but you can deploy new versions if needed.

---

**Ready to deploy? Run:**

```bash
npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet
```
