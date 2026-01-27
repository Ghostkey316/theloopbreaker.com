# Vaultfire V2 Mainnet Deployment Guide

**Complete Step-by-Step Guide for Base Mainnet Deployment**

**Network:** Base Mainnet (Chain ID: 8453)
**Status:** Production Ready
**Date:** 2026-01-27

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Setup](#pre-deployment-setup)
3. [Deployment Process](#deployment-process)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Frontend Configuration](#frontend-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Access

- [ ] Wallet with at least 0.5 ETH on Base Mainnet (for deployment gas)
- [ ] WalletConnect Project ID (https://cloud.walletconnect.com)
- [ ] RISC Zero Bonsai API Key (https://bonsai.xyz)
- [ ] Basescan API Key (https://basescan.org/myapikey)
- [ ] Sentry DSN (optional but recommended) (https://sentry.io)

### Technical Requirements

- [ ] Node.js v18+ installed
- [ ] Git installed
- [ ] Hardhat configured
- [ ] Access to Gnosis Safe UI (https://app.safe.global/)

### Team Requirements

- [ ] 5 signers for Governance Multisig (3-of-5)
- [ ] 3 signers for Operations Multisig (2-of-3)
- [ ] 6 signers for Treasury Multisig (4-of-6)

---

## Pre-Deployment Setup

### Step 1: Create Gnosis Safe Multisig Wallets

Follow the complete guide: [`MAINNET_MULTISIG_SETUP.md`](./MAINNET_MULTISIG_SETUP.md)

**Summary:**
1. Visit https://app.safe.global/
2. Create three Safes on Base Mainnet:
   - **Governance**: 3-of-5 signers (~0.002 ETH gas)
   - **Operations**: 2-of-3 signers (~0.002 ETH gas)
   - **Treasury**: 4-of-6 signers (~0.002 ETH gas)
3. Fund each Safe with operational ETH:
   - Governance: 0.05 ETH
   - Operations: 0.1 ETH
   - Treasury: 0.05 ETH

**Save the Safe addresses - you'll need them next!**

### Step 2: Configure Multisig Addresses

Edit `deployment/mainnet-multisig-config.json`:

```json
{
  "multisigs": {
    "governance": {
      "address": "0xYOUR_GOVERNANCE_SAFE_ADDRESS"
    },
    "operations": {
      "address": "0xYOUR_OPERATIONS_SAFE_ADDRESS"
    },
    "treasury": {
      "address": "0xYOUR_TREASURY_SAFE_ADDRESS"
    }
  }
}
```

### Step 3: Verify Multisig Configuration

```bash
npx hardhat run scripts/verify-multisig-setup.js --network baseMainnet
```

**Expected Output:**
```
✅ VERIFICATION SUCCESSFUL!
All multisig wallets are properly configured.
```

If verification fails, fix issues before proceeding.

### Step 4: Configure Environment Variables

Copy the template:
```bash
cp deployment/.env.mainnet.template .env
```

Edit `.env` with your values:

```bash
# CRITICAL - Keep this secret!
PRIVATE_KEY=your_deployer_private_key_here

# Network
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key_here

# Multisigs (filled from Step 2)
GOVERNANCE_MULTISIG=0xYOUR_GOVERNANCE_SAFE_ADDRESS
OPERATIONS_MULTISIG=0xYOUR_OPERATIONS_SAFE_ADDRESS
TREASURY_MULTISIG=0xYOUR_TREASURY_SAFE_ADDRESS

# RISC Zero
RISC_ZERO_API_KEY=your_bonsai_api_key_here
RISC_ZERO_PROVER_URL=https://api.bonsai.xyz

# Frontend
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
NEXT_PUBLIC_USE_MOCK_PROOFS=false  # CRITICAL: Must be false for production!

# Monitoring (optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

**Security Checklist:**
- [ ] `.env` file is in `.gitignore`
- [ ] Private key is valid and wallet is funded
- [ ] All API keys are working (test each one)
- [ ] Mock proofs are disabled (`NEXT_PUBLIC_USE_MOCK_PROOFS=false`)

---

## Deployment Process

### Step 5: Final Pre-Deployment Checks

Run the pre-deployment checklist:

```bash
# Check deployer balance
npx hardhat run scripts/check-balance.js --network baseMainnet

# Verify multisig setup
npx hardhat run scripts/verify-multisig-setup.js --network baseMainnet

# Compile contracts
npx hardhat compile
```

**Expected:**
- Deployer has at least 0.5 ETH
- All multisigs verified
- Contracts compile without errors

### Step 6: Deploy to Mainnet

**IMPORTANT: This is the point of no return. Double-check everything!**

```bash
npx hardhat run scripts/deploy-mainnet-production.js --network baseMainnet
```

**What This Does:**
1. Deploys RewardStream with multisig roles
2. Deploys DilithiumAttestor (signature-only mode for V2)
3. Deploys BeliefOracle with governance guardian
4. Deploys MultiOracleConsensus
5. Deploys all 9 V2 Bond Contracts
6. Deploys RewardMultiplier and ContributorUnlockKey
7. Transfers ownership to appropriate multisigs
8. Verifies all roles and permissions
9. Saves deployment data to `deployment/mainnet-deployment.json`

**Estimated Time:** 10-15 minutes
**Estimated Cost:** 0.1-0.3 ETH (varies with gas prices)

**Expected Output:**
```
🔥 VAULTFIRE V2 PRODUCTION MAINNET DEPLOYMENT 🔥
...
✅ DEPLOYMENT COMPLETE!
Total Time: 12.34 minutes
```

**Save the deployment output!** You'll need the contract addresses.

---

## Post-Deployment Verification

### Step 7: Verify Deployment Integrity

```bash
npx hardhat run scripts/verify-deployment.js --network baseMainnet
```

**This Checks:**
- All contracts exist on-chain
- Ownership transferred correctly to multisigs
- Roles (admin, guardian, governor) assigned properly
- DilithiumAttestor in signature-only mode (V2)
- BeliefOracle guardian is governance multisig
- RewardStream roles configured correctly

**Expected Output:**
```
✅ VERIFICATION SUCCESSFUL!
All contracts deployed and configured correctly!
```

### Step 8: Verify Contracts on Basescan

Make contracts publicly verifiable on Basescan:

```bash
# Get addresses from deployment/mainnet-deployment.json
# Then verify each contract:

npx hardhat verify --network baseMainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

**Example:**
```bash
# RewardStream
npx hardhat verify --network baseMainnet 0x... "0xOPERATIONS_MULTISIG" "0xGOVERNANCE_MULTISIG"

# DilithiumAttestor
npx hardhat verify --network baseMainnet 0x... "0xGOVERNANCE_MULTISIG" false "0x0000000000000000000000000000000000000000"

# BeliefOracle
npx hardhat verify --network baseMainnet 0x... "0xATTESTOR_ADDRESS" "0xREWARD_STREAM_ADDRESS" "0xGOVERNANCE_MULTISIG" "0x0000000000000000000000000000000000000042"

# V2 Bond Contracts (no constructor args)
npx hardhat verify --network baseMainnet 0x...

# Continue for all contracts...
```

**Tip:** Create a script to verify all contracts at once (optional).

### Step 9: Test Multisig Operations

Test each multisig via Gnosis Safe UI:

**Governance Multisig Test:**
1. Go to https://app.safe.global/
2. Select your Governance Safe
3. New Transaction → Contract Interaction
4. Contract Address: `BeliefOracle` address
5. Function: `setResonanceDrift(bool active)`
6. Parameters: `false`
7. Have 3 signers approve and execute
8. Verify transaction succeeded

**Operations Multisig Test:**
1. Select Operations Safe
2. New Transaction → Send Funds
3. Send 0.001 ETH to yourself
4. Have 2 signers approve and execute
5. Verify transaction succeeded

**Treasury Multisig Test:**
1. Select Treasury Safe
2. New Transaction → Send Funds
3. Send 0.001 ETH to yourself
4. Have 4 signers approve and execute
5. Verify transaction succeeded

**Checklist:**
- [ ] Governance multisig can execute (3/5 threshold works)
- [ ] Operations multisig can execute (2/3 threshold works)
- [ ] Treasury multisig can execute (4/6 threshold works)
- [ ] All signers can access Gnosis Safe UI
- [ ] All test transactions succeeded

---

## Frontend Configuration

### Step 10: Update Frontend with Contract Addresses

Edit frontend environment file (e.g., `base-mini-app/.env.local`):

```bash
# Copy addresses from deployment/mainnet-deployment.json

NEXT_PUBLIC_REWARD_STREAM_ADDRESS=0x...
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=0x...
NEXT_PUBLIC_BELIEF_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_MULTI_ORACLE_CONSENSUS_ADDRESS=0x...

# Bond contracts
NEXT_PUBLIC_BUILDER_BELIEF_BONDS_V2_ADDRESS=0x...
NEXT_PUBLIC_LABOR_DIGNITY_BONDS_V2_ADDRESS=0x...
# ... etc for all 9 bond contracts

# Network config
NEXT_PUBLIC_DEFAULT_CHAIN_ID=8453
NEXT_PUBLIC_ENABLE_TESTNETS=false
NEXT_PUBLIC_ENV=production

# CRITICAL: Disable mock proofs
NEXT_PUBLIC_USE_MOCK_PROOFS=false

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# RISC Zero
NEXT_PUBLIC_ZKP_PROVER_URL=https://api.bonsai.xyz
NEXT_PUBLIC_ZKP_API_KEY=your_bonsai_api_key_here

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

### Step 11: Build and Deploy Frontend

```bash
cd base-mini-app

# Install dependencies
npm install

# Build for production
npm run build

# Expected: Build succeeds with no errors

# Deploy to Vercel
vercel --prod

# Or deploy to your hosting platform of choice
```

**Vercel Environment Variables:**
Set the same environment variables in Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all `NEXT_PUBLIC_*` variables
3. Redeploy if already deployed

### Step 12: Test End-to-End

Test the complete flow on production:

1. **Wallet Connection:**
   - Visit your deployed frontend
   - Connect wallet (MetaMask/Coinbase Wallet)
   - Verify network switches to Base Mainnet
   - Disconnect and reconnect to test

2. **Belief Attestation:**
   - Create a new belief attestation
   - Generate ZK proof (uses real Bonsai, not mocks!)
   - Submit to BeliefOracle
   - Verify transaction succeeds on Basescan
   - Check resonance score returned

3. **Oracle Interaction:**
   - Preview resonance for a belief
   - Query belief resonance
   - Verify bonus multiplier applied (if resonance > 80)
   - Check RewardStream multiplier updated

4. **Contract Reads:**
   - View bond contracts
   - Read BeliefOracle constants
   - Check MultiOracleConsensus state
   - All reads should work without errors

**Checklist:**
- [ ] Wallet connection works
- [ ] Network switching works
- [ ] Real ZK proofs generating (not mocks!)
- [ ] Belief attestations submitting successfully
- [ ] Resonance scores calculating correctly
- [ ] No JavaScript errors in console
- [ ] Mobile responsive (test on phone)
- [ ] Cross-browser (Chrome, Firefox, Safari)

---

## Monitoring & Maintenance

### Step 13: Set Up Monitoring

**Basescan Alerts:**
1. Go to https://basescan.org/myapikey
2. Create watch list for all deployed contracts
3. Set up email alerts for:
   - Contract interactions
   - Ownership transfers
   - Emergency pause events

**Sentry Error Tracking:**
1. Verify Sentry catching errors
2. Set up alert rules:
   - Any error in production
   - Failed transactions
   - ZK proof failures
3. Test by triggering a test error

**Multisig Notifications:**
1. Enable email notifications in Gnosis Safe
2. All signers should receive:
   - New transaction proposals
   - Execution confirmations
   - Balance warnings

### Step 14: Create Emergency Response Plan

Document emergency procedures:

**Emergency Contacts:**
```
Governance Multisig Signers:
- Signer 1: [Name, Email, Phone]
- Signer 2: [Name, Email, Phone]
- Signer 3: [Name, Email, Phone]
- Signer 4: [Name, Email, Phone]
- Signer 5: [Name, Email, Phone]

Operations Multisig Signers:
- Signer 1: [Name, Email, Phone]
- Signer 2: [Name, Email, Phone]
- Signer 3: [Name, Email, Phone]

Treasury Multisig Signers:
- Signer 1: [Name, Email, Phone]
- ...
```

**Emergency Procedures:**

1. **Security Incident:**
   - Notify all governance signers immediately
   - Propose pause transaction via Gnosis Safe
   - Fast-track approval (4-hour window)
   - Execute pause
   - Investigate and fix issue
   - Unpause when safe

2. **Compromised Signer:**
   - Remove signer from multisig
   - Rotate to new signer
   - Update all documentation
   - Notify team

3. **Contract Vulnerability:**
   - Deploy new contract version
   - Update frontend to new address
   - Migrate user data if needed
   - Announce migration to users

---

## Troubleshooting

### Common Issues

**Issue: "Insufficient funds for gas"**
- **Solution:** Fund deployer wallet with more ETH

**Issue: "Network connection failed"**
- **Solution:** Check BASE_RPC_URL is working, try alternative RPC

**Issue: "Multisig transaction stuck"**
- **Solution:** Check if enough signers have approved, push for approvals

**Issue: "ZK proof generation failed"**
- **Solution:** Verify Bonsai API key, check quota/billing

**Issue: "Contract verification failed"**
- **Solution:** Check constructor args match exactly, try manual verification

**Issue: "Frontend can't find contracts"**
- **Solution:** Verify contract addresses in .env.local, check network ID is 8453

### Getting Help

**Documentation:**
- Vaultfire docs: `docs/` directory
- Hardhat docs: https://hardhat.org/docs
- Gnosis Safe docs: https://docs.safe.global/
- Base docs: https://docs.base.org/

**Community:**
- GitHub Issues: Create detailed issue with logs
- Team chat: Contact team directly
- Base Discord: https://discord.gg/buildonbase

---

## Post-Launch Checklist

After successful deployment:

- [ ] All contracts deployed and verified on Basescan
- [ ] Multisig operations tested and working
- [ ] Frontend deployed and accessible
- [ ] End-to-end testing completed
- [ ] Monitoring and alerts configured
- [ ] Emergency procedures documented
- [ ] Team trained on multisig operations
- [ ] Backup of all deployment data
- [ ] Public announcement prepared
- [ ] Community channels ready

---

## Deployment Summary Template

Save this info for your records:

```
Vaultfire V2 Mainnet Deployment
================================

Deployment Date: YYYY-MM-DD
Network: Base Mainnet (8453)
Deployer: 0x...

Multisig Addresses:
- Governance (3/5): 0x...
- Operations (2/3): 0x...
- Treasury (4/6): 0x...

Core Contracts:
- RewardStream: 0x...
- DilithiumAttestor: 0x...
- BeliefOracle: 0x...
- MultiOracleConsensus: 0x...

Bond Contracts:
- BuilderBeliefBondsV2: 0x...
- LaborDignityBondsV2: 0x...
- PurchasingPowerBondsV2: 0x...
- AIAccountabilityBondsV2: 0x...
- HealthCommonsBondsV2: 0x...
- EscapeVelocityBondsV2: 0x...
- AIPartnershipBondsV2: 0x...
- CommonGroundBondsV2: 0x...
- VerdantAnchorBondsV2: 0x...

Additional Contracts:
- RewardMultiplier: 0x...
- ContributorUnlockKey: 0x...

Frontend URL: https://...
Basescan Links: https://basescan.org/address/0x...

Total Deployment Cost: X.XX ETH
Deployment Time: XX minutes

Status: ✅ Production Live
```

---

## Success! 🎉

**Congratulations!** Vaultfire V2 is now live on Base Mainnet.

You've successfully deployed:
- ✅ Complete protocol infrastructure
- ✅ Decentralized multisig governance
- ✅ Oracle system for belief verification
- ✅ All 9 V2 belief bond contracts
- ✅ Production-ready frontend

**Next Steps:**
1. Announce the mainnet launch
2. Start community outreach
3. Monitor system health closely
4. Gather user feedback
5. Plan future enhancements

**Mission:** Privacy over surveillance. Freedom over control. Humanity thriving with AI.

**It's not in the repo anymore. It's in the world.** 🔥

---

**Document Version:** 1.0
**Last Updated:** 2026-01-27
**Status:** Production Ready ✅
