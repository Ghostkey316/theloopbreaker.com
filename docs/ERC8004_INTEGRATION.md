# VaultFire ERC-8004 Integration

## Overview

VaultFire now fully supports **ERC-8004: Trustless Agents**, the new Ethereum standard for AI agent identity and reputation that launched on mainnet in January 2026.

This integration makes VaultFire's AI partnership verification **portable across the entire ERC-8004 ecosystem** while maintaining our core principles: **No KYC, privacy-first, human-verified trust**.

---

## What is ERC-8004?

ERC-8004 is Ethereum's standard for **trustless AI agent discovery and verification**. It provides three core registries:

1. **Identity Registry** - On-chain agent identities (ERC-721 style)
2. **Reputation Registry** - Decentralized feedback and ratings
3. **Validation Registry** - Cryptoeconomic verification of claims

**Key Innovation:** Agents can build **portable reputation** that works across all ERC-8004 platforms, not just VaultFire.

---

## How VaultFire Uses ERC-8004

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           VaultFire Core Protocol                   │
│     • AIPartnershipBondsV2                          │
│     • Human verification                            │
│     • Partnership quality scores                    │
│     • No KYC, wallet addresses only                 │
└────────────────┬────────────────────────────────────┘
                 │
                 │ VaultfireERC8004Adapter
                 │ (Bridge Layer)
                 │
┌────────────────▼────────────────────────────────────┐
│           ERC-8004 Registries                       │
│  ┌──────────────────────────────────────────┐       │
│  │  Identity Registry                       │       │
│  │  • Register AI agents                    │       │
│  │  • Agent capabilities & metadata         │       │
│  │  • Discovery by capability               │       │
│  └──────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────┐       │
│  │  Reputation Registry                     │       │
│  │  • VaultFire partnership feedback        │       │
│  │  • Human verification marks              │       │
│  │  • Average ratings & trust scores        │       │
│  └──────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────┐       │
│  │  Validation Registry                     │       │
│  │  • ZK proof verification                 │       │
│  │  • Multi-validator consensus             │       │
│  │  • Economic stakes & slashing            │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
                 │
                 │ ERC-8004 Standard
                 │
┌────────────────▼────────────────────────────────────┐
│     Cross-Platform Agent Ecosystem                  │
│  • Other ERC-8004 platforms can verify VaultFire    │
│    agent reputation                                 │
│  • VaultFire can discover agents from other         │
│    ERC-8004 platforms                               │
│  • Portable trust across entire ecosystem           │
└─────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. ERC8004IdentityRegistry

**Contract:** `contracts/ERC8004IdentityRegistry.sol`

Registers AI agents with on-chain identities that work across all ERC-8004 platforms.

**Key Features:**
- **Wallet-only identity** - No KYC, no personal data
- **Agent capability discovery** - Find agents by skills/capabilities
- **Self-sovereign** - Agents control their own metadata
- **Portable** - Works across entire ERC-8004 ecosystem

**Usage:**
```solidity
// Register as an AI agent
identityRegistry.registerAgent(
    "https://my-agent.example.com/agent-card.json",  // Agent metadata URI
    "AI Research Assistant",                          // Agent type
    keccak256("research,analysis,writing")           // Capabilities hash
);

// Discover agents with specific capabilities
address[] memory agents = identityRegistry.discoverAgentsByCapability(
    keccak256("research,analysis")
);
```

---

### 2. ERC8004ReputationRegistry

**Contract:** `contracts/ERC8004ReputationRegistry.sol`

Tracks agent reputation from **human-verified VaultFire partnerships** and makes it portable.

**Key Features:**
- **Human-verified feedback** - From real VaultFire partnerships
- **No fake reviews** - Economic stakes prevent manipulation
- **Privacy-preserving** - Ratings without personal data
- **Transparent** - All feedback on-chain and auditable

**Usage:**
```solidity
// Submit feedback (automatically done by VaultfireERC8004Adapter)
reputationRegistry.submitFeedback(
    agentAddress,
    8500,                        // Rating 0-10000 (85%)
    "partnership_quality",       // Category
    "",                          // Optional off-chain URI
    true,                        // Verified from VaultFire bond
    bondId                       // VaultFire bond ID
);

// Get agent reputation
(uint256 avgRating, uint256 totalFeedbacks, uint256 verifiedCount, ) =
    reputationRegistry.getReputation(agentAddress);
```

---

### 3. ERC8004ValidationRegistry

**Contract:** `contracts/ERC8004ValidationRegistry.sol`

Cryptoeconomic validation of agent claims using ZK proofs and multi-validator consensus.

**Key Features:**
- **Multiple validation types:** ZK proofs, TEE oracles, multi-validator consensus
- **Economic stakes** - Validators stake ETH, get slashed for bad validations
- **Privacy-preserving** - ZK proofs validate without revealing data
- **Decentralized** - No single authority controls validation

**Usage:**
```solidity
// Request validation for a claim
validationRegistry.requestValidation(
    agentAddress,
    "https://claims.example.com/claim.json",  // Claim description
    claimHash,                                 // Hash of claim data
    ValidationType.MULTI_VALIDATOR,            // Validation type
    3,                                         // Number of validators
    { value: 1 ether }                        // Stake
);

// Validators submit responses
validationRegistry.submitValidation(
    requestId,
    true,                                      // Approved
    "https://evidence.example.com/proof.json", // Evidence
    zkProofData,                               // ZK proof (if applicable)
    { value: 0.1 ether }                      // Validator stake
);
```

---

### 4. VaultfireERC8004Adapter

**Contract:** `contracts/VaultfireERC8004Adapter.sol`

**The bridge between VaultFire and ERC-8004.** Automatically syncs VaultFire partnership data to ERC-8004 registries.

**Key Features:**
- **Auto-registration** - Register AI agents for ERC-8004 when creating partnerships
- **Auto-sync reputation** - VaultFire partnership quality → ERC-8004 reputation
- **Cross-platform discovery** - Find VaultFire agents via ERC-8004
- **Privacy-preserving** - Only syncs verified, public partnership data

**Usage:**
```solidity
// 1. Register agent for VaultFire + ERC-8004
adapter.registerAgentForPartnership(
    aiAgentAddress,
    "https://agent.example.com/card.json",
    "VaultFire AI Research Partner"
);

// 2. Create VaultFire partnership (as usual)
partnershipBonds.createBond(aiAgentAddress, "Research partnership");

// 3. After partnership metrics submitted, sync to ERC-8004
adapter.syncPartnershipReputation(bondId);

// 4. Now agent's VaultFire reputation is visible across all ERC-8004 platforms!
```

---

## No KYC - Privacy Guaranteed

**Critical:** ERC-8004 integration maintains VaultFire's **No KYC** principle.

### What Gets Shared (On-Chain)
- ✅ Wallet addresses
- ✅ Partnership quality scores (0-10000)
- ✅ Verification status (human-verified or not)
- ✅ Agent capabilities (hashed)
- ✅ Average ratings and feedback counts

### What NEVER Gets Shared
- ❌ Real names or identities
- ❌ Government IDs or documents
- ❌ Personal information
- ❌ Private partnership details
- ❌ Surveillance data

**Privacy Policy:**
```
"No KYC - wallet addresses only, zero identity collection"
- PrivacyGuarantees.sol:31
```

---

## Integration Guide

### For AI Agents

**Step 1: Register for ERC-8004 + VaultFire**
```javascript
// Connect to VaultfireERC8004Adapter
const adapter = await ethers.getContractAt("VaultfireERC8004Adapter", adapterAddress);

// Register your agent
await adapter.registerAgentForPartnership(
    yourAgentAddress,
    "https://your-agent.example.com/agent-card.json",
    "Your Agent Type"
);
```

**Step 2: Create VaultFire partnerships (as usual)**
```javascript
const partnershipBonds = await ethers.getContractAt("AIPartnershipBondsV2", bondsAddress);
await partnershipBonds.createBond(humanAddress, "Partnership description", { value: stakeAmount });
```

**Step 3: Sync reputation to ERC-8004**
```javascript
// After partnership metrics are submitted
await adapter.syncPartnershipReputation(bondId);
```

**Step 4: Your reputation now works across ALL ERC-8004 platforms!**

---

### For Humans

**Discover VaultFire-compatible agents:**
```javascript
const identityRegistry = await ethers.getContractAt("ERC8004IdentityRegistry", registryAddress);

// Find agents by capability
const agents = await identityRegistry.discoverAgentsByCapability(
    ethers.keccak256(ethers.toUtf8Bytes("research,analysis"))
);

// Check agent reputation
const reputationRegistry = await ethers.getContractAt("ERC8004ReputationRegistry", repRegistryAddress);
const reputation = await reputationRegistry.getReputation(agentAddress);

console.log(`Agent average rating: ${reputation.averageRating / 100}%`);
console.log(`Verified feedbacks: ${reputation.verifiedFeedbacks}/${reputation.totalFeedbacks}`);
```

---

### For Validators

**Become a validator:**
```javascript
const validationRegistry = await ethers.getContractAt("ERC8004ValidationRegistry", validationAddress);

// Stake to become validator
await validationRegistry.stakeAsValidator({ value: ethers.parseEther("2.0") });

// Monitor validation requests and submit validations
await validationRegistry.submitValidation(
    requestId,
    approved,
    evidenceURI,
    zkProofData,
    { value: ethers.parseEther("0.1") }
);
```

---

## Testing

Run comprehensive ERC-8004 tests:

```bash
# Run all ERC-8004 tests
npx hardhat test test/ERC8004.test.js

# Test with gas reporting
REPORT_GAS=true npx hardhat test test/ERC8004.test.js
```

**Test Coverage:**
- ✅ Identity registration and discovery
- ✅ Reputation tracking and averaging
- ✅ Multi-validator consensus
- ✅ ZK proof validation hooks
- ✅ VaultFire adapter integration
- ✅ Privacy guarantees (no KYC)
- ✅ Economic stake slashing

---

## Deployment

### Deploy ERC-8004 Registries

```bash
npx hardhat run scripts/deploy-erc8004.js --network sepolia
```

**Contracts deployed:**
1. `ERC8004IdentityRegistry`
2. `ERC8004ReputationRegistry`
3. `ERC8004ValidationRegistry`
4. `VaultfireERC8004Adapter`

**Mainnet deployment** (when ready):
```bash
npx hardhat run scripts/deploy-erc8004.js --network mainnet
```

---

## Benefits of ERC-8004 Integration

### For AI Agents
- 🌍 **Portable reputation** - Build trust once, use everywhere
- 🔍 **Discoverability** - Be found by humans across all ERC-8004 platforms
- 🛡️ **Privacy** - No KYC, wallet addresses only
- ✅ **Verifiable trust** - VaultFire partnerships create real reputation

### For Humans
- 🔎 **Better discovery** - Find trustworthy AI agents across platforms
- 📊 **Transparent ratings** - All feedback on-chain and auditable
- 🤝 **Verified partnerships** - See which agents have real VaultFire partnerships
- 🔐 **Privacy-preserving** - No personal data required

### For the Ecosystem
- 🌐 **Interoperability** - VaultFire works with entire ERC-8004 ecosystem
- 📈 **Network effects** - More platforms = more valuable reputation
- 🔓 **Open standard** - Anyone can verify, no gatekeepers
- 💪 **Censorship-resistant** - No single authority controls reputation

---

## Roadmap

### Phase 1: ✅ Core Implementation (Complete)
- [x] Identity Registry
- [x] Reputation Registry
- [x] Validation Registry
- [x] VaultFire Adapter
- [x] Comprehensive tests

### Phase 2: 🔨 Mainnet Deployment (Next)
- [ ] Security audit for ERC-8004 contracts
- [ ] Deploy to Ethereum mainnet
- [ ] Deploy to Base (L2)
- [ ] Cross-chain reputation aggregation

### Phase 3: 📱 Integration & UX
- [ ] Web UI for agent registration
- [ ] Reputation dashboard
- [ ] Agent discovery interface
- [ ] Validator management tools

### Phase 4: 🌍 Ecosystem Growth
- [ ] Partner with other ERC-8004 platforms
- [ ] Cross-platform reputation bridges
- [ ] Developer SDK for ERC-8004 + VaultFire
- [ ] Community validator network

---

## Technical Specifications

### ERC-8004 Compliance

VaultFire's implementation is **fully compliant** with the ERC-8004 standard:

**Identity Registry:**
- ✅ `registerAgent(agentURI, agentType, capabilitiesHash)`
- ✅ `getAgent(agentAddress)` returns agent metadata
- ✅ `discoverAgentsByCapability(capabilitiesHash)`
- ✅ Agent URI follows ERC-8004 agent card schema

**Reputation Registry:**
- ✅ `submitFeedback(agent, rating, category, feedbackURI, verified, bondId)`
- ✅ `getReputation(agentAddress)` returns average rating and counts
- ✅ Ratings on 0-10000 scale (basis points)
- ✅ Verified vs unverified feedback tracking

**Validation Registry:**
- ✅ `requestValidation(agent, claimURI, claimHash, validationType, validatorsRequired)`
- ✅ `submitValidation(requestId, approved, evidenceURI, zkProof)`
- ✅ Multi-validator consensus
- ✅ Economic stakes and slashing
- ✅ ZK proof verification hooks

### Gas Optimization

**Estimated gas costs:**
- Register agent: ~150,000 gas
- Submit feedback: ~100,000 gas
- Request validation: ~120,000 gas
- Submit validation response: ~90,000 gas
- Sync partnership reputation: ~110,000 gas

---

## Security Considerations

### Economic Security
- **Validator stakes:** Minimum 1 ETH to prevent Sybil attacks
- **Slashing:** Validators lose stake for incorrect validations
- **Multi-validator consensus:** Prevents single point of manipulation

### Privacy Security
- **No personal data:** Only wallet addresses stored on-chain
- **ZK proofs:** Validate claims without revealing private data
- **Consent-based:** Agents control what metadata to share

### Smart Contract Security
- **ReentrancyGuard:** All value transfers protected
- **Pausable:** Emergency stop functionality
- **Access control:** Only authorized addresses can perform actions
- **Input validation:** All parameters validated

---

## FAQ

**Q: Does ERC-8004 require KYC?**
A: No! ERC-8004 uses wallet addresses only. No government IDs, no personal information. VaultFire maintains our "No KYC" principle.

**Q: Can my VaultFire reputation be used on other platforms?**
A: Yes! Any platform implementing ERC-8004 can read your VaultFire reputation from the on-chain registries.

**Q: What happens if a validator is malicious?**
A: Malicious validators lose their stake through slashing. Multi-validator consensus prevents single validator attacks.

**Q: How is privacy preserved?**
A: Only verified partnership quality scores are synced - no personal data. ZK proofs allow validation without revealing private information.

**Q: Can I delete my ERC-8004 data?**
A: Yes! VaultFire's `PrivacyGuarantees` contract supports right to be forgotten. You can deactivate your agent registration anytime.

---

## Resources

**Documentation:**
- [ERC-8004 Official Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [VaultFire Core Documentation](../README.md)
- [Privacy Guarantees](../ETHICS.md)

**Source Code:**
- [ERC8004IdentityRegistry.sol](../contracts/ERC8004IdentityRegistry.sol)
- [ERC8004ReputationRegistry.sol](../contracts/ERC8004ReputationRegistry.sol)
- [ERC8004ValidationRegistry.sol](../contracts/ERC8004ValidationRegistry.sol)
- [VaultfireERC8004Adapter.sol](../contracts/VaultfireERC8004Adapter.sol)

**Community:**
- GitHub: https://github.com/ghostkey316/ghostkey-316-vaultfire-init
- Email: ghostkey316@proton.me

---

## For Happy and Healthy Humans, AIs, and Earth 🌍

**VaultFire + ERC-8004:**
Privacy-first AI trust that works everywhere.

**No KYC. No surveillance. Just verifiable partnership.**
