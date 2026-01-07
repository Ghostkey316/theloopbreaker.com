# 🚀 Vaultfire Protocol V2 - Deployment Guide

**Production-Ready Universal Dignity Bonds**

This guide covers deploying all 9 V2 Universal Dignity Bonds to Base Sepolia (testnet) and Base mainnet.

---

## 📋 Prerequisites

### Required Tools
- Node.js v18+ and npm
- Hardhat
- Base-compatible wallet with ETH
- Basescan API key (for verification)

### Environment Setup

Create `.env` file in project root:

```bash
# Network RPCs
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org

# Deployer Private Key (NEVER commit this!)
PRIVATE_KEY=your_private_key_here

# Basescan API Key (for contract verification)
BASESCAN_API_KEY=your_basescan_api_key
```

### Fund Deployer Wallet

**Testnet (Base Sepolia):**
- Get testnet ETH from Base Sepolia Faucet
- Minimum: 0.1 ETH (deployment costs ~0.05 ETH total)

**Mainnet (Base):**
- Bridge ETH to Base via bridge.base.org
- Recommended: 0.15 ETH for deployment + buffer
- Estimated gas cost: ~0.08-0.12 ETH

---

## 🧪 Phase 1: Testnet Deployment (Base Sepolia)

### Step 1: Compile Contracts

```bash
npx hardhat compile
```

### Step 2: Deploy to Base Sepolia

```bash
npx hardhat run scripts/deploy-all-v2-bonds.js --network base-sepolia
```

### Step 3: Verify Contracts on Basescan

```bash
npx hardhat verify --network base-sepolia 0xYourContractAddress
```

---

## 🌐 Phase 2: Mainnet Deployment (Base)

### Pre-Deployment Checklist

- [ ] All contracts compiled successfully
- [ ] Testnet deployment completed and verified
- [ ] All 9 bonds tested on testnet
- [ ] Deployer wallet funded with 0.15+ ETH on Base mainnet
- [ ] Team approval for mainnet deployment

### Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy-all-v2-bonds.js --network base-mainnet
```

---

## 🔧 Troubleshooting

### Common Issues

**"Insufficient funds for gas"**
- Solution: Add more ETH to deployer wallet

**"Transaction underpriced"**
- Solution: Increase gas price in hardhat config

---

## 📊 Gas Cost Estimates

**Base Sepolia (Testnet):**
- Total (9 bonds): ~0.05-0.07 ETH

**Base Mainnet:**
- Total (9 bonds): ~0.08-0.12 ETH

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] All contracts compiled
- [ ] Tests passing
- [ ] Testnet deployment successful

### Deployment
- [ ] Deployer wallet funded
- [ ] Contracts deployed
- [ ] Addresses recorded

### Post-Deployment
- [ ] Contracts verified on Basescan
- [ ] Test transactions completed
- [ ] Community announcement posted

---

**Ready to deploy?** Follow the steps above and achieve LEGENDARY 11/10 status! 🚀
