# Multi-Sig Operational Procedures
## Vaultfire Protocol Governance & Security Operations

**Version:** 1.0
**Last Updated:** January 9, 2026
**Status:** Production Ready

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Multi-Sig Setup](#multi-sig-setup)
3. [Operational Procedures](#operational-procedures)
4. [Emergency Procedures](#emergency-procedures)
5. [Security Best Practices](#security-best-practices)
6. [Timelock Management](#timelock-management)
7. [Contract Upgrade Procedures](#contract-upgrade-procedures)
8. [Incident Response](#incident-response)

---

## 🎯 OVERVIEW

### Multi-Sig Architecture

Vaultfire uses a **3-of-5 Gnosis Safe multi-signature wallet** for protocol governance. This provides:

✅ **Security**: No single key can compromise the protocol
✅ **Availability**: Protocol can operate if 2 signers are unavailable
✅ **Accountability**: All actions require multiple trusted parties
✅ **Transparency**: All transactions are recorded on-chain

### Governance Structure

```
┌─────────────────────────────────────────────────────────────┐
│              Vaultfire Governance Structure                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Gnosis Safe Multi-Sig (3-of-5)                     │   │
│  │  - Signer 1: Core Team Lead                          │   │
│  │  - Signer 2: Technical Lead                          │   │
│  │  - Signer 3: Security Auditor                        │   │
│  │  - Signer 4: Community Representative                │   │
│  │  - Signer 5: Legal/Compliance                        │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                         │
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RewardStream Contract                               │   │
│  │  - admin: Multi-sig (can initiate admin/governor)   │   │
│  │  - governorTimelock: Multi-sig (updates multipliers)│   │
│  │  - 2-day timelock on all privileged operations      │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                         │
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AIAccountabilityBondsV2 & Other Contracts          │   │
│  │  - owner: Multi-sig (emergency pause only)          │   │
│  │  - humanTreasury: Multi-sig (receives human share)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 MULTI-SIG SETUP

### Step 1: Deploy Gnosis Safe

**Recommended Configuration:**
- **Network**: Base Mainnet
- **Threshold**: 3 of 5 signers
- **Signers**: 5 trusted parties with diverse expertise

**Deployment Checklist:**
- [ ] Verify all signer addresses are correct
- [ ] Confirm each signer has access to their wallet
- [ ] Test signing with a small transaction
- [ ] Document Safe address in team records
- [ ] Set up Safe transaction monitoring

**Tools:**
- Gnosis Safe UI: https://app.safe.global
- Safe CLI: `npm install -g @safe-global/safe-cli`

### Step 2: Configure Vaultfire Contracts

Once Safe is deployed, configure contracts to use multi-sig:

```javascript
// Example deployment script
const { ethers } = require('hardhat');

async function main() {
  const MULTI_SIG_ADDRESS = "0x..."; // Your Gnosis Safe address

  // Deploy RewardStream with multi-sig as both admin and governor
  const RewardStream = await ethers.getContractFactory('RewardStream');
  const stream = await RewardStream.deploy(
    MULTI_SIG_ADDRESS,  // admin
    MULTI_SIG_ADDRESS   // governorTimelock
  );
  await stream.waitForDeployment();

  // Deploy AIAccountabilityBondsV2 with multi-sig as human treasury
  const BondsV2 = await ethers.getContractFactory('AIAccountabilityBondsV2');
  const bonds = await BondsV2.deploy(MULTI_SIG_ADDRESS); // humanTreasury
  await bonds.waitForDeployment();

  // Transfer ownership to multi-sig
  await bonds.transferOwnership(MULTI_SIG_ADDRESS);

  console.log('✅ All contracts configured with multi-sig');
  console.log('Multi-sig address:', MULTI_SIG_ADDRESS);
  console.log('RewardStream:', await stream.getAddress());
  console.log('BondsV2:', await bonds.getAddress());
}
```

### Step 3: Verify Configuration

**Verification Checklist:**
- [ ] Confirm multi-sig is admin of RewardStream
- [ ] Confirm multi-sig is governor of RewardStream
- [ ] Confirm multi-sig is owner of all bond contracts
- [ ] Confirm multi-sig is humanTreasury of BondsV2
- [ ] Test initiating a timelock operation
- [ ] Test canceling a timelock operation

---

## 🔄 OPERATIONAL PROCEDURES

### Procedure 1: Admin Transfer (2-Day Timelock)

**When to Use:** Transferring admin role to new multi-sig or contract

**Steps:**

1. **Initiate Transfer** (Day 0)
   ```
   Multi-sig proposes transaction:
   RewardStream.transferAdmin(newAdminAddress)

   Required: 3 of 5 signatures
   ```

2. **Wait for Timelock** (Day 0-2)
   ```
   - Timelock: 2 days (48 hours)
   - Community can review the proposed change
   - Can cancel if needed using cancelAdminTransfer()
   ```

3. **Accept Transfer** (Day 2+)
   ```
   New admin calls:
   RewardStream.acceptAdmin()

   This completes the transfer
   ```

**Emergency Cancel:**
```
Current admin can cancel anytime during timelock:
RewardStream.cancelAdminTransfer()
```

---

### Procedure 2: Governor Transfer (2-Day Timelock)

**When to Use:** Changing the governor (multiplier controller)

**Steps:**

1. **Initiate Transfer** (Day 0)
   ```
   Multi-sig proposes transaction:
   RewardStream.transferGovernor(newGovernorAddress)

   Required: 3 of 5 signatures
   ```

2. **Wait for Timelock** (Day 0-2)
   ```
   - Timelock: 2 days (48 hours)
   - Verify new governor contract is correct
   - Community review period
   ```

3. **Accept Transfer** (Day 2+)
   ```
   New governor calls:
   RewardStream.acceptGovernor()
   ```

**Emergency Cancel:**
```
RewardStream.cancelGovernorTransfer()
```

---

### Procedure 3: Update Human Treasury

**When to Use:** Changing the address that receives human profit share

**Steps:**

1. **Verify New Treasury**
   - Confirm address can receive ETH (has `receive()` or is EOA)
   - Verify address ownership (multi-sig or trusted party)
   - Test with small amount first

2. **Propose Transaction**
   ```
   Multi-sig proposes:
   AIAccountabilityBondsV2.setHumanTreasury(newTreasuryAddress)

   Required: 3 of 5 signatures
   ```

3. **Execute Immediately**
   ```
   No timelock - executes immediately once threshold reached
   ```

**⚠️ Warning:** This is instant - ensure address is correct!

---

### Procedure 4: Emergency Pause

**When to Use:** Critical security incident detected

**Steps:**

1. **Immediate Action**
   ```
   Multi-sig proposes:
   AIAccountabilityBondsV2.pause()

   Required: 3 of 5 signatures (emergency fast-track)
   ```

2. **Investigate**
   - Identify the security issue
   - Assess impact on users
   - Develop fix or mitigation

3. **Unpause After Fix**
   ```
   Multi-sig proposes:
   AIAccountabilityBondsV2.unpause()

   Required: 3 of 5 signatures
   ```

**Fast-Track Process:**
- Emergency pause should be executed within 1 hour
- Use Gnosis Safe mobile app for fastest signing
- Notify all signers via emergency channel (Signal/Telegram)

---

### Procedure 5: Ownership Transfer

**When to Use:** Transferring contract ownership (emergency power)

**Steps:**

1. **Initiate Transfer**
   ```
   Multi-sig proposes:
   BaseDignityBond.transferOwnership(newOwnerAddress)

   Required: 3 of 5 signatures
   ```

2. **Execute Immediately**
   ```
   No timelock - executes immediately
   ```

**⚠️ Warning:** This is instant and transfers pause/unpause power!

---

## 🚨 EMERGENCY PROCEDURES

### Emergency Type 1: Critical Smart Contract Vulnerability

**Severity:** CRITICAL
**Response Time:** < 1 hour

**Actions:**
1. **Immediately pause all affected contracts**
   ```
   For each affected contract:
   contract.pause()
   ```

2. **Alert all signers**
   - Use emergency communication channel
   - Clearly describe the vulnerability
   - Request immediate signing

3. **Fast-track multi-sig approval**
   - Aim for 3 signatures within 15 minutes
   - Use mobile wallets for fastest response

4. **Public Communication**
   - Announce pause on Twitter/Discord
   - Explain reason (without revealing exploit details)
   - Provide timeline for resolution

5. **Develop Fix**
   - Engage security auditors
   - Develop and test patch
   - Deploy fixed version

6. **Unpause After Verification**
   - Verify fix is working
   - Get community approval
   - Unpause contracts

---

### Emergency Type 2: Multi-Sig Signer Compromise

**Severity:** HIGH
**Response Time:** < 4 hours

**Actions:**
1. **Assess Compromise**
   - Determine which signer(s) compromised
   - Check if threshold is still secure (3 of 5)

2. **If Threshold Broken (≥3 compromised):**
   - **CRITICAL**: Immediately transfer all assets to new Safe
   - Deploy new multi-sig with trusted signers
   - Transfer all admin/owner roles to new Safe

3. **If Threshold Secure (<3 compromised):**
   - Remove compromised signer(s) from Safe
   - Add new trusted signer(s)
   - Monitor for suspicious transactions

4. **Change All Timelock Operations**
   - Cancel any pending admin/governor transfers
   - Review recent transactions for anomalies

---

### Emergency Type 3: Failed Timelock Operation

**Severity:** MEDIUM
**Response Time:** < 24 hours

**Scenario:** Admin/governor transfer initiated but can't be completed

**Actions:**
1. **Cancel Pending Transfer**
   ```
   RewardStream.cancelAdminTransfer()
   // or
   RewardStream.cancelGovernorTransfer()
   ```

2. **Investigate Root Cause**
   - Check if new address is correct
   - Verify new address can accept role
   - Confirm timelock delay has passed

3. **Re-initiate Correctly**
   - Fix the issue identified
   - Start transfer process again

---

## 🔒 SECURITY BEST PRACTICES

### For Multi-Sig Signers

1. **Hardware Wallets**
   - ✅ Use hardware wallet (Ledger/Trezor) for signing
   - ❌ Never use hot wallet or browser extension
   - ✅ Store hardware wallet in secure location
   - ✅ Have backup seed phrase in separate secure location

2. **Operational Security**
   - ✅ Verify transaction details carefully before signing
   - ✅ Use Gnosis Safe simulation to preview effects
   - ❌ Never sign transactions you don't fully understand
   - ✅ Communicate with other signers before signing

3. **Communication Security**
   - ✅ Use Signal or encrypted channel for coordination
   - ❌ Don't discuss sensitive operations in public channels
   - ✅ Verify identity of other signers in messages

4. **Physical Security**
   - ✅ Keep hardware wallet in safe/secure location
   - ✅ Never share seed phrase (not even with other signers)
   - ✅ Have contingency plan if wallet is lost/stolen

### For Transaction Proposal

1. **Before Proposing:**
   - Simulate transaction in Gnosis Safe interface
   - Verify all addresses are correct (copy-paste from etherscan)
   - Check gas limits are reasonable
   - Document reason for transaction

2. **During Signing:**
   - Verify on hardware wallet screen:
     - Contract address matches expected
     - Function call is correct
     - Parameters are as expected
   - Don't rush - take time to verify

3. **After Execution:**
   - Verify transaction succeeded on Basescan
   - Check contract state changed as expected
   - Document transaction hash

---

## ⏱️ TIMELOCK MANAGEMENT

### Understanding Timelocks

Vaultfire uses **2-day timelocks** for critical operations:

| Operation | Timelock | Reason |
|-----------|----------|--------|
| Admin transfer | 2 days | Prevents instant takeover |
| Governor transfer | 2 days | Prevents instant multiplier control |
| Ownership transfer | **INSTANT** | Emergency response capability |
| Human treasury update | **INSTANT** | Operational flexibility |

### Timelock Timeline

```
Day 0 (00:00): Transfer initiated
  ↓
  | Community review period
  | Can cancel if issues discovered
  |
Day 2 (00:00): Timelock expires
  ↓
Day 2+: New admin/governor can accept
```

### Best Practices

1. **Announce Before Initiating**
   - Post on governance forum 24 hours before
   - Explain reason for change
   - Give community time to provide feedback

2. **Monitor During Timelock**
   - Watch for community concerns
   - Be ready to cancel if issues arise
   - Keep communication channel open

3. **Coordinate Acceptance**
   - Ensure new admin/governor is ready to accept
   - Don't let timelock expire without plan
   - Have backup plan if acceptance fails

---

## 🔄 CONTRACT UPGRADE PROCEDURES

### Upgrade Pattern

Vaultfire contracts are **non-upgradeable** for security and transparency. Upgrades require:

1. **Deploy New Version**
   - Deploy new contract with fixes/improvements
   - Comprehensive testing on testnet
   - Security audit of changes

2. **Migration Process**
   - Pause old contract
   - Migrate state to new contract (if needed)
   - Transfer admin/owner roles to multi-sig
   - Update frontend to use new contract

3. **Deprecation**
   - Keep old contract paused but accessible
   - Allow users to withdraw funds from old version
   - Document migration path

### V2 → V3 Upgrade Example

```javascript
// 1. Deploy V3
const BondsV3 = await ethers.getContractFactory('AIAccountabilityBondsV3');
const bondsV3 = await BondsV3.deploy(MULTI_SIG_ADDRESS);

// 2. Pause V2
await bondsV2.connect(multiSig).pause();

// 3. Transfer ownership of V3 to multi-sig
await bondsV3.transferOwnership(MULTI_SIG_ADDRESS);

// 4. Announce migration to community
// 5. Update frontend to V3 address
// 6. Keep V2 paused but allow emergency withdrawals
```

---

## 🔥 INCIDENT RESPONSE

### Incident Severity Levels

| Level | Description | Response Time | Actions |
|-------|-------------|---------------|---------|
| **P0** | Active exploit, funds at risk | < 1 hour | Immediate pause, emergency meeting |
| **P1** | Critical vulnerability discovered | < 4 hours | Coordinated response, develop fix |
| **P2** | High severity issue, no active exploit | < 24 hours | Plan fix, schedule upgrade |
| **P3** | Medium severity, low risk | < 1 week | Regular upgrade cycle |

### Incident Response Team

**On-Call Rotation:**
- Week 1: Technical Lead + Security Auditor
- Week 2: Core Team Lead + Community Rep
- Week 3: Technical Lead + Legal/Compliance
- Week 4: All signers on-call (rotation restart)

**Contact Methods:**
- Emergency: Signal group "Vaultfire Emergency"
- High Priority: Discord DM to all signers
- Medium Priority: Governance forum post
- Low Priority: Weekly sync meeting

### Post-Incident Review

After every P0/P1 incident:

1. **Write Incident Report** (within 48 hours)
   - Timeline of events
   - Root cause analysis
   - Impact assessment
   - Actions taken

2. **Community Communication** (within 72 hours)
   - Public blog post explaining incident
   - Transparency about what happened
   - Steps taken to prevent recurrence

3. **Process Improvement** (within 1 week)
   - Update operational procedures
   - Add monitoring/alerts
   - Conduct training if needed

---

## 📞 CONTACTS & RESOURCES

### Emergency Contacts

- **Technical Lead**: Signal @vaultfire-tech
- **Security Auditor**: Signal @vaultfire-security
- **Multi-Sig Signers**: Signal group "Vaultfire Emergency"

### Important Links

- **Gnosis Safe UI**: https://app.safe.global
- **Basescan**: https://basescan.org
- **Governance Forum**: [Your forum URL]
- **Status Page**: [Your status page URL]

### Contract Addresses (Base Mainnet)

```
Multi-Sig Safe: 0x... (REPLACE WITH ACTUAL)
RewardStream: 0x... (REPLACE WITH ACTUAL)
AIAccountabilityBondsV2: 0x... (REPLACE WITH ACTUAL)
BeliefAttestationVerifier: 0x... (REPLACE WITH ACTUAL)
DilithiumAttestor: 0x... (REPLACE WITH ACTUAL)
```

### Monitoring & Alerts

**Set up alerts for:**
- ✅ Any pause() function call
- ✅ Admin/governor transfer initiation
- ✅ Large bond distributions (> $10k)
- ✅ Multi-sig threshold changes
- ✅ Failed transactions from multi-sig

**Tools:**
- Tenderly alerts: https://tenderly.co
- OpenZeppelin Defender: https://defender.openzeppelin.com
- Custom monitoring scripts in /scripts/monitoring/

---

## ✅ OPERATIONAL CHECKLIST

### Daily Operations
- [ ] Check Gnosis Safe for pending transactions
- [ ] Review any timelock operations in progress
- [ ] Monitor contract events for anomalies
- [ ] Check community channels for issues

### Weekly Operations
- [ ] Review all transactions from past week
- [ ] Sync with all multi-sig signers
- [ ] Update operational documentation if needed
- [ ] Test emergency pause procedure

### Monthly Operations
- [ ] Full security review of all contracts
- [ ] Review and update this document
- [ ] Conduct emergency response drill
- [ ] Rotate on-call schedule

### Quarterly Operations
- [ ] Security audit of any new features
- [ ] Review multi-sig signer composition
- [ ] Update incident response procedures
- [ ] Community governance review

---

## 📚 APPENDIX

### A. Multi-Sig Transaction Templates

**Template 1: Admin Transfer**
```
To: RewardStream (0x...)
Function: transferAdmin(address)
Params: newAdminAddress (0x...)
Value: 0 ETH
Gas Limit: 100,000
```

**Template 2: Emergency Pause**
```
To: AIAccountabilityBondsV2 (0x...)
Function: pause()
Params: none
Value: 0 ETH
Gas Limit: 50,000
```

### B. Verification Scripts

```javascript
// Verify multi-sig configuration
async function verifyMultiSig() {
  const stream = await ethers.getContractAt('RewardStream', STREAM_ADDRESS);
  const admin = await stream.admin();
  const governor = await stream.governorTimelock();

  console.log('Admin:', admin);
  console.log('Governor:', governor);
  console.log('Expected Multi-Sig:', MULTI_SIG_ADDRESS);

  if (admin !== MULTI_SIG_ADDRESS || governor !== MULTI_SIG_ADDRESS) {
    throw new Error('Multi-sig configuration mismatch!');
  }

  console.log('✅ Multi-sig correctly configured');
}
```

### C. Gnosis Safe Best Practices

1. **Never reuse nonces** - Always execute in order
2. **Use labels** - Label transactions clearly
3. **Set spending limits** - For routine operations
4. **Enable notifications** - Get alerts for new proposals
5. **Regular backups** - Export transaction history monthly

---

**Document Version:** 1.0
**Last Review:** January 9, 2026
**Next Review Due:** April 9, 2026
**Maintained By:** Vaultfire Technical Team

---

*This document is a living guide. Update it as procedures evolve and lessons are learned from operations.*
