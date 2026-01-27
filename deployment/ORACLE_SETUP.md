# Oracle System Setup Guide

**Network:** Base Mainnet
**Oracle Contracts:** BeliefOracle, MultiOracleConsensus
**Status:** Required for Mainnet Deployment

---

## Overview

Vaultfire uses a dual-oracle system for resilience and decentralization:

1. **BeliefOracle** - Primary oracle for resonance scoring and attestation
2. **MultiOracleConsensus** - Decentralized multi-oracle network for future data feeds

This guide covers deployment and configuration of both systems.

---

## Part 1: BeliefOracle Setup

### What is BeliefOracle?

BeliefOracle is the gateway for resonance scoring backed by Dilithium attestations. It:
- Validates belief attestations using cryptographic signatures
- Calculates deterministic resonance scores (0-100)
- Applies reward multipliers for high-resonance beliefs
- Provides drift protection via guardian controls

### BeliefOracle Architecture

```
User → BeliefOracle → DilithiumAttestor (signature verification)
                   → RewardStream (multiplier updates)
```

### Deployment Parameters

The BeliefOracle constructor requires:

```solidity
constructor(
    DilithiumAttestor attestor_,      // Address of deployed DilithiumAttestor
    RewardStream rewardStream_,        // Address of deployed RewardStream
    address guardian_,                 // Governance multisig address
    address ghostEcho_                 // Entropy source address (can be any address)
)
```

**Configuration:**
- **attestor_**: DilithiumAttestor contract address (deployed first)
- **rewardStream_**: RewardStream contract address (deployed first)
- **guardian_**: Governance multisig (3-of-5) - controls drift settings
- **ghostEcho_**: Entropy source for resonance calculation (can use deployer address or specific entropy address)

### BeliefOracle Features

**Resonance Scoring:**
- Deterministic calculation based on vow hash + seeker + entropy
- Range: 0-100
- High resonance (>80) triggers bonus multipliers

**Guardian Controls:**
- Toggle resonance drift protection on/off
- Rotate guardian address
- Emergency controls for system health

**Reward Integration:**
- Automatically updates RewardStream multipliers for high-resonance beliefs
- Bonus multiplier: 120% (20% boost)
- Applied once per unique vow hash

---

## Part 2: MultiOracleConsensus Setup

### What is MultiOracleConsensus?

A decentralized oracle network with stake-based consensus for future data feeds. Features:
- Multiple independent oracles stake ETH to participate
- Consensus reached via stake-weighted median
- Slashing for malicious/inaccurate data
- Reputation tracking

### When to Deploy MultiOracleConsensus

**V2 Launch:** Deploy but not actively used yet
**Future Use Cases:**
- Off-chain data verification
- Cross-chain data feeds
- Decentralized pricing oracles
- External API integrations

### Deployment Parameters

```solidity
constructor() {
    owner = msg.sender;  // Operations multisig
}
```

**Configuration:**
- **owner**: Operations multisig (2-of-3)
- **Minimum Oracle Stake**: 10 ETH (hardcoded constant)
- **Consensus Threshold**: 60% stake agreement (6000 basis points)
- **Max Deviation**: 20% (2000 basis points)
- **Consensus Window**: 24 hours

### Oracle Registration Process

After deployment, oracles can register:

```solidity
function registerOracle(
    string memory dataSource,    // e.g., "Chainlink ETH/USD"
    string memory publicKey      // For encrypted submissions
) external payable {
    // Must stake at least 10 ETH
}
```

**Initial Oracles (Post-Launch):**
1. Deploy MultiOracleConsensus
2. Operations multisig registers 3-5 initial trusted oracles
3. Fund initial oracles with 10 ETH each for staking
4. Community oracles can register permissionlessly

---

## Part 3: Deployment Sequence

### Step 1: Deploy Core Dependencies

```bash
# Deploy DilithiumAttestor (signature-only mode for V2)
# Deploy RewardStream
# Both deployed by main deployment script
```

### Step 2: Deploy Oracle Contracts

```javascript
// 1. Deploy BeliefOracle
const BeliefOracle = await ethers.getContractFactory('BeliefOracle');
const oracle = await BeliefOracle.deploy(
    dilithiumAttestorAddress,  // From step 1
    rewardStreamAddress,        // From step 1
    governanceMultisig,         // From multisig config
    entropyAddress              // ghostEcho parameter
);

// 2. Deploy MultiOracleConsensus
const MultiOracleConsensus = await ethers.getContractFactory('MultiOracleConsensus');
const consensus = await MultiOracleConsensus.deploy();

// 3. Transfer ownership to operations multisig
await consensus.transferOwnership(operationsMultisig);
```

### Step 3: Configure BeliefOracle

```javascript
// BeliefOracle is deployed with correct parameters
// No additional configuration needed
// Guardian (governance multisig) can adjust settings via Gnosis Safe
```

### Step 4: Register Initial Oracles (Optional for V2)

```javascript
// Via operations multisig in Gnosis Safe:
// Contract: MultiOracleConsensus
// Function: registerOracle(dataSource, publicKey)
// Value: 10 ETH per oracle
// Parameters:
//   dataSource: "Vaultfire Core Oracle"
//   publicKey: "0x..." (oracle's public key)
```

---

## Part 4: Oracle Configuration File

Update `deployment/oracle-config.json`:

```json
{
  "network": "base-mainnet",
  "beliefOracle": {
    "deployed": false,
    "address": null,
    "guardian": "governance_multisig",
    "admin": "operations_multisig",
    "ghostEcho": "0xENTROPY_SOURCE_ADDRESS",
    "constants": {
      "maxResonance": 100,
      "bonusThreshold": 80,
      "bonusMultiplier": 120
    }
  },
  "multiOracleConsensus": {
    "deployed": false,
    "address": null,
    "owner": "operations_multisig",
    "constants": {
      "minimumOracleStake": "10000000000000000000",
      "consensusThreshold": 6000,
      "maxDeviation": 2000,
      "consensusWindow": 86400,
      "slashPercentage": 5000,
      "minimumOracles": 3
    },
    "initialOracles": []
  }
}
```

---

## Part 5: Oracle Operations

### BeliefOracle Guardian Operations

**Set Resonance Drift (via Governance Multisig):**

```javascript
// Gnosis Safe Transaction Builder
Contract: BeliefOracle
Function: setResonanceDrift(bool active)
Parameters:
  active: true/false
```

**Update Guardian (via Governance Multisig):**

```javascript
Contract: BeliefOracle
Function: updateGuardian(address newGuardian)
Parameters:
  newGuardian: <new_governance_multisig_address>
```

### MultiOracleConsensus Operations

**Start Consensus Round (via Operations Multisig):**

```javascript
Contract: MultiOracleConsensus
Function: startConsensusRound(bytes32 metricId)
Parameters:
  metricId: keccak256("metric_name")
Returns: roundId
```

**Pause System (Emergency - via Operations Multisig):**

```javascript
Contract: MultiOracleConsensus
Function: pause()
```

---

## Part 6: Monitoring & Maintenance

### BeliefOracle Monitoring

**Key Metrics:**
- Total beliefs queried
- Resonance distribution (0-100)
- Multipliers applied
- Drift status

**View Functions:**
```javascript
// Preview resonance without triggering attestation
await oracle.previewResonance(vow, seekerAddress);

// Get cached resonance for a vow
await oracle.cachedResonance(vowHash);

// Get user's last resonance score
await oracle.lastResonance(userAddress);
```

### MultiOracleConsensus Monitoring

**Key Metrics:**
- Active oracle count
- Consensus success rate
- Average response time
- Slash events

**View Functions:**
```javascript
// Get active oracle count
await consensus.getActiveOracleCount();

// Get oracle reputation
await consensus.getOracleReputation(oracleAddress);

// Get round details
await consensus.getRoundDetails(roundId);

// Get latest consensus value
await consensus.getLatestConsensusValue(metricId);
```

---

## Part 7: Security Considerations

### BeliefOracle Security

✅ **Guardian-controlled drift protection** - Prevents abuse during anomalies
✅ **Immutable dependencies** - attestor and rewardStream cannot be changed
✅ **Deterministic scoring** - Prevents manipulation via predictable calculation
✅ **Single bonus per vow** - Prevents multiplier farming
✅ **Try/catch on multiplier updates** - Fails gracefully if RewardStream reverts

### MultiOracleConsensus Security

✅ **Stake-based participation** - 10 ETH minimum prevents sybil attacks
✅ **Slashing mechanism** - 50% stake slashed for malicious behavior
✅ **Consensus threshold** - 60% stake agreement required
✅ **Dispute resolution** - Owner can resolve disputes and slash bad actors
✅ **Reputation tracking** - Historical accuracy tracked per oracle
✅ **ReentrancyGuard** - All withdrawal functions protected

---

## Part 8: Post-Deployment Checklist

- [ ] BeliefOracle deployed to Base Mainnet
- [ ] MultiOracleConsensus deployed to Base Mainnet
- [ ] BeliefOracle guardian set to governance multisig
- [ ] MultiOracleConsensus ownership transferred to operations multisig
- [ ] Oracle addresses updated in oracle-config.json
- [ ] Test belief query executed successfully
- [ ] Resonance calculation verified
- [ ] Guardian functions tested via governance multisig
- [ ] BaseScan verification completed for both contracts
- [ ] Monitoring dashboard configured (optional)
- [ ] Initial oracles registered (if launching consensus system)

---

## Part 9: Troubleshooting

### BeliefOracle Issues

**Error: "GuardianRequired()"**
- Solution: Call from governance multisig address

**Error: Resonance always returns 0**
- Solution: Check ghostEcho address is set correctly

**Multiplier not applying**
- Solution: Check resonance > 80 and bonusApplied[vowHash] == false

### MultiOracleConsensus Issues

**Error: "Insufficient active oracles"**
- Solution: Register at least 3 oracles with 10 ETH stake each

**Error: "Consensus deadline passed"**
- Solution: Increase consensus window or ensure oracles submit faster

**Consensus not reaching**
- Solution: Check oracle submissions are within 20% deviation

---

## Next Steps

After oracle setup:

1. ✅ Oracles deployed and configured
2. ➡️ Complete mainnet deployment
3. ➡️ Test end-to-end attestation flow
4. ➡️ Monitor oracle performance
5. ➡️ Register additional oracles (if using consensus system)

---

**Created:** 2026-01-27
**Network:** Base Mainnet
**Status:** ✅ Ready for Implementation
