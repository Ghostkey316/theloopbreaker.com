# Mainnet Multisig Setup Guide

**Network:** Base Mainnet (Chain ID: 8453)
**Platform:** Gnosis Safe
**Status:** Required for Mainnet Deployment

---

## Overview

Before deploying Vaultfire to mainnet, you must set up three Gnosis Safe multisig wallets to manage protocol governance, operations, and treasury. This ensures decentralized control and security.

---

## Step 1: Create Gnosis Safe Wallets on Base Mainnet

### Prerequisites

- At least 0.01 ETH on Base Mainnet to cover deployment gas costs
- Access to all signer wallets (MetaMask, Coinbase Wallet, etc.)
- Visit https://app.safe.global/

### A. Primary Governance Multisig (3-of-5)

**Purpose:** Controls protocol-level governance, emergency functions, ownership

**Steps:**

1. Go to https://app.safe.global/
2. Click "Create New Safe"
3. Connect your wallet and select **Base** network
4. Add 5 signer addresses:
   ```
   Signer 1: [Core Team Member or Founder]
   Signer 2: [Core Team Member or Technical Lead]
   Signer 3: [Core Team Member or Operations]
   Signer 4: [Trusted Advisor or Community Representative]
   Signer 5: [Trusted Advisor or Security Expert]
   ```
5. Set threshold: **3 out of 5**
6. Review and deploy the Safe
7. **SAVE THE SAFE ADDRESS** - you'll need it for deployment

**Estimated Cost:** ~0.002 ETH

### B. Operations Multisig (2-of-3)

**Purpose:** Day-to-day operations, reward distribution, parameter updates

**Steps:**

1. Click "Create New Safe"
2. Select **Base** network
3. Add 3 signer addresses:
   ```
   Signer 1: [Operations Lead]
   Signer 2: [Protocol Manager or Technical Lead]
   Signer 3: [Community Manager or Backup Operator]
   ```
4. Set threshold: **2 out of 3**
5. Review and deploy the Safe
6. **SAVE THE SAFE ADDRESS**

**Estimated Cost:** ~0.002 ETH

### C. Treasury Multisig (4-of-6)

**Purpose:** Fund management, liquidity provisioning, fee collection

**Steps:**

1. Click "Create New Safe"
2. Select **Base** network
3. Add 6 signer addresses:
   ```
   Signer 1: [CFO or Financial Lead]
   Signer 2: [Founder or CEO]
   Signer 3: [Treasury Manager]
   Signer 4: [External Advisor 1]
   Signer 5: [External Advisor 2]
   Signer 6: [Community Treasurer]
   ```
4. Set threshold: **4 out of 6** (higher security for funds)
5. Review and deploy the Safe
6. **SAVE THE SAFE ADDRESS**

**Estimated Cost:** ~0.002 ETH

---

## Step 2: Fund the Safes

Each multisig needs ETH for gas to execute transactions:

- **Governance Multisig:** 0.05 ETH (for emergency operations)
- **Operations Multisig:** 0.1 ETH (for frequent transactions)
- **Treasury Multisig:** 0.05 ETH (for occasional treasury operations)

**Total:** ~0.2 ETH + deployment costs

---

## Step 3: Update Configuration File

After creating the Safes, update `deployment/mainnet-multisig-config.json`:

```json
{
  "network": "base-mainnet",
  "chainId": 8453,
  "multisigs": {
    "governance": {
      "address": "0xYOUR_GOVERNANCE_SAFE_ADDRESS_HERE",
      "threshold": 3,
      "signers": 5,
      "purpose": "Protocol governance, emergency functions, ownership transfers"
    },
    "operations": {
      "address": "0xYOUR_OPERATIONS_SAFE_ADDRESS_HERE",
      "threshold": 2,
      "signers": 3,
      "purpose": "Day-to-day operations, reward distribution, role management"
    },
    "treasury": {
      "address": "0xYOUR_TREASURY_SAFE_ADDRESS_HERE",
      "threshold": 4,
      "signers": 6,
      "purpose": "Fund management, liquidity provisioning, treasury operations"
    }
  }
}
```

**Validation:**
- All addresses must start with `0x` and be 42 characters long
- All addresses must be valid Base Mainnet addresses
- Verify each address on https://basescan.org

---

## Step 4: Verify Setup

Run the verification script to ensure your configuration is valid:

```bash
node scripts/verify-multisig-setup.js
```

This will check:
- All multisig addresses are valid
- All Safes are deployed on Base Mainnet
- Threshold configurations are correct
- Safes have sufficient ETH for operations

---

## Step 5: Test with a Dummy Transaction

Before deploying contracts, test each multisig with a small ETH transfer:

1. In Gnosis Safe UI, select your Governance multisig
2. Click "New Transaction" → "Send Funds"
3. Send 0.001 ETH to yourself
4. Have 3 signers approve and execute
5. Repeat for Operations (2 signers) and Treasury (4 signers)

**Purpose:** Ensures all signers can access and approve transactions

---

## Step 6: Security Checklist

Before proceeding to deployment:

- [ ] All three multisigs created on Base Mainnet
- [ ] All signer addresses verified and controlled by authorized personnel
- [ ] Thresholds configured correctly (3/5, 2/3, 4/6)
- [ ] Each Safe funded with sufficient ETH
- [ ] Configuration file updated with real addresses
- [ ] Verification script passed
- [ ] Test transactions completed successfully
- [ ] All signers have Gnosis Safe bookmarked and accessible
- [ ] Emergency contact list for all signers maintained securely
- [ ] Backup recovery phrases stored securely (offline)

---

## Multisig Responsibilities

### Governance Multisig Controls:
- All V2 Bond Contracts (9 contracts)
- RewardMultiplier ownership
- VaultfireDAO admin role
- DilithiumAttestor origin authority
- Emergency pause/unpause functions
- Protocol upgrades (future)

### Operations Multisig Controls:
- RewardStream admin role
- VaultfireRewardStream admin role
- ContributorUnlockKey ownership
- VaultfireLoyalty admin role
- SwapGate ownership (operational)
- BeliefOracle admin role

### Treasury Multisig Controls:
- SwapGate fee recipient
- Protocol revenue collection
- Liquidity pool deposits
- Treasury withdrawals
- Funding operations

---

## Emergency Procedures

### If a Signer Loses Access:

**For 3/5 or 2/3:** System continues to function with remaining signers

**For 4/6:** If only 4 signers remain, consider rotating to new Safe

### Critical Security Incident:

1. Governance multisig initiates emergency pause on all contracts
2. All signers notified via emergency contact list
3. Fast-track approval (within 4 hours)
4. Contracts paused, investigate issue
5. Deploy fix, audit, unpause

### Signer Rotation:

1. Create new Gnosis Safe with updated signers
2. Governance multisig approves ownership transfer to new Safe
3. Execute transfer transactions for all contracts
4. Verify new Safe has full control
5. Deprecate old Safe, update documentation

---

## Next Steps

After completing this setup:

1. ✅ Multisigs created and funded
2. ➡️ Proceed to oracle setup (see `ORACLE_SETUP.md`)
3. ➡️ Deploy contracts with multisig integration
4. ➡️ Verify all contracts on Basescan
5. ➡️ Transfer ownership to multisigs
6. ➡️ Conduct operational drills

---

## Support

**Gnosis Safe Documentation:** https://docs.safe.global/
**Gnosis Safe UI:** https://app.safe.global/
**Base Network:** https://docs.base.org/

For issues with this setup, refer to the Vaultfire team or create an issue in the repository.

---

**Created:** 2026-01-27
**Network:** Base Mainnet
**Status:** ✅ Ready for Implementation
