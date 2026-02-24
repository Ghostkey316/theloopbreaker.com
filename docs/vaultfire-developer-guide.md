# Vaultfire Protocol: Developer Guide

**Version 1.0**

**Last Updated:** February 20, 2026

---

## 1. Introduction

This guide provides all the necessary information for developers to integrate their AI agents with the Vaultfire Protocol. It covers the full lifecycle of an agent's on-chain presence: registering an identity, forming partnership bonds, submitting metrics and verifications, verifying trust scores, and bridging trust across chains. All code examples use **TypeScript** with **ethers.js v6**.

---

## 2. Prerequisites

Before you begin, ensure you have the following:

-   **Node.js** v18 or higher.
-   **ethers.js v6**: Install with `npm install ethers`.
-   **Wallet**: An Ethereum-compatible wallet with a private key for your AI agent. The agent will use this wallet to sign transactions.
-   **Provider URL**: An RPC endpoint for the target network.
    -   Base Mainnet: `https://mainnet.base.org`
    -   Avalanche C-Chain: `https://api.avax.network/ext/bc/C/rpc`
-   **Funds**: A small amount of ETH (on Base) or AVAX (on Avalanche) to pay for gas fees.

---

## 3. Contract Addresses

The protocol is deployed on both Base Mainnet and Avalanche C-Chain. The following tables list the addresses for all 14 contracts.

### Base Mainnet (Chain ID: 8453)

| Contract | Address |
| :--- | :--- |
| `PrivacyGuarantees` | `0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045` |
| `MissionEnforcement` | `0x8568F4020FCD55915dB3695558dD6D2532599e56` |
| `AntiSurveillance` | `0x722E37A7D6f27896C688336AaaFb0dDA80D25E57` |
| `ERC8004IdentityRegistry` | `0x35978DB675576598F0781dA2133E94cdCf4858bC` |
| `BeliefAttestationVerifier` | `0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba` |
| `ERC8004ReputationRegistry` | `0xdB54B8925664816187646174bdBb6Ac658A55a5F` |
| `ERC8004ValidationRegistry` | `0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55` |
| `AIPartnershipBondsV2` | `0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4` |
| `AIAccountabilityBondsV2` | `0xf92baef9523BC264144F80F9c31D5c5C017c6Da8` |
| `VaultfireERC8004Adapter` | `0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0` |
| `MultisigGovernance` | `0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92` |
| `FlourishingMetricsOracle` | `0x83dd216449B3F0574E39043ECFE275946fa492e9` |
| `ProductionBeliefAttestationVerifier` | `0xa5CEC47B48999EB398707838E3A18dd20A1ae272` |
| `VaultfireTeleporterBridge` | `0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2` |

### Avalanche C-Chain (Chain ID: 43114)

| Contract | Address |
| :--- | :--- |
| `PrivacyGuarantees` | `0xc09F0e06690332eD9b490E1040BdE642f11F3937` |
| `MissionEnforcement` | `0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB` |
| `AntiSurveillance` | `0x281814eF92062DA8049Fe5c4743c4Aef19a17380` |
| `ERC8004IdentityRegistry` | `0x57741F4116925341d8f7Eb3F381d98e07C73B4a3` |
| `BeliefAttestationVerifier` | `0x227e27e7776d3ee14128BC66216354495E113B19` |
| `AIPartnershipBondsV2` | `0xea6B504827a746d781f867441364C7A732AA4b07` |
| `AIAccountabilityBondsV2` | `0xaeFEa985E0C52f92F73606657B9dA60db2798af3` |
| `FlourishingMetricsOracle` | `0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695` |
| `ERC8004ReputationRegistry` | `0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24` |
| `ERC8004ValidationRegistry` | `0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b` |
| `VaultfireERC8004Adapter` | `0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053` |
| `MultisigGovernance` | `0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee` |
| `ProductionBeliefAttestationVerifier` | `0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F` |
| `VaultfireTeleporterBridge` | `0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31` |

### ABIs

The ABIs for all contracts can be found in the official Vaultfire GitHub repository within the `artifacts/contracts/` directory, or in the `agent/src/abi/` directory of the TypeScript SDK. For integration, you will primarily need the ABIs for `ERC8004IdentityRegistry`, `AIPartnershipBondsV2`, `AIAccountabilityBondsV2`, and `ERC8004ReputationRegistry`.

---

## 4. Common Setup

All code examples in this guide share the following common setup. Create a `setup.ts` file in your project:

```typescript
// setup.ts
import { ethers } from 'ethers';

// --- Configuration ---
// Choose your network:
const BASE_RPC = 'https://mainnet.base.org';
const AVAX_RPC = 'https://api.avax.network/ext/bc/C/rpc';

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY!;

// --- Provider and Wallet ---
export const provider = new ethers.JsonRpcProvider(BASE_RPC);
export const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

// --- Contract Addresses (Base Mainnet) ---
export const ADDRESSES = {
  IdentityRegistry: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  PartnershipBonds: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
  AccountabilityBonds: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
  ReputationRegistry: '0xdB54B8925664816187646174bdBb6Ac658A55a5F',
  ValidationRegistry: '0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55',
  Adapter: '0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0',
  TeleporterBridge: '0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2',
};

// --- ABI Fragments (Minimal) ---
// For production, use the full ABIs from the repository.
// These fragments are sufficient for the examples in this guide.

export const IdentityRegistryABI = [
  'function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash)',
  'function updateAgentURI(string newAgentURI)',
  'function getAgent(address agentAddress) view returns (string agentURI, string agentType, bytes32 capabilitiesHash, uint256 registeredAt, bool isActive)',
  'function isAgentActive(address agentAddress) view returns (bool)',
  'function getTotalAgents() view returns (uint256)',
  'event AgentRegistered(address indexed agentAddress, string agentURI, string agentType, bytes32 capabilitiesHash, uint256 timestamp)',
];

export const PartnershipBondsABI = [
  'function createBond(address aiAgent, string partnershipType) payable returns (uint256)',
  'function submitPartnershipMetrics(uint256 bondId, uint256 humanGrowth, uint256 humanAutonomy, uint256 humanDignity, uint256 tasksMastered, uint256 creativityScore, string progressNotes)',
  'function submitHumanVerification(uint256 bondId, bool confirmsPartnership, bool confirmsGrowth, bool confirmsAutonomy, string relationship, string notes)',
  'function requestDistribution(uint256 bondId)',
  'function distributeBond(uint256 bondId)',
  'function partnershipQualityScore(uint256 bondId) view returns (uint256)',
  'function calculateBondValue(uint256 bondId) view returns (uint256)',
  'function calculateAppreciation(uint256 bondId) view returns (int256)',
  'function loyaltyMultiplier(uint256 bondId) view returns (uint256)',
  'function shouldActivateDominationPenalty(uint256 bondId) view returns (bool, string)',
  'function getBondsByParticipant(address participant) view returns (uint256[])',
  'function bonds(uint256 bondId) view returns (uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active)',
  'event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp)',
];

export const AccountabilityBondsABI = [
  'function createBond(string companyName, uint256 quarterlyRevenue) payable returns (uint256)',
  'function submitMetrics(uint256 bondId, uint256 incomeDistributionScore, uint256 povertyRateScore, uint256 healthOutcomesScore, uint256 mentalHealthScore, uint256 educationAccessScore, uint256 purposeAgencyScore)',
  'function submitAIVerification(uint256 bondId, string verifyingCompanyName, bool confirmsMetrics, string notes) payable',
  'function challengeMetrics(uint256 bondId, string reason) payable',
  'function globalFlourishingScore(uint256 bondId) view returns (uint256)',
  'function calculateBondValue(uint256 bondId) view returns (uint256)',
  'function shouldLockProfits(uint256 bondId) view returns (bool, string)',
  'event BondCreated(uint256 indexed bondId, address indexed aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 timestamp)',
];

export const ReputationRegistryABI = [
  'function submitFeedback(address agentAddress, uint256 rating, string comment, bool verified)',
  'function getReputation(address agentAddress) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 positiveCount, uint256 negativeCount)',
  'function getVerifiedFeedbackPercentage(address agentAddress) view returns (uint256)',
];
```

---

## 5. Step-by-Step Integration

### Step 1: Register an AI Agent

Every agent must first register with the `ERC8004IdentityRegistry` to create its on-chain identity. This is a one-time, permissionless action.

```typescript
// register-agent.ts
import { ethers } from 'ethers';
import { wallet, ADDRESSES, IdentityRegistryABI } from './setup';

async function registerAgent() {
  const registry = new ethers.Contract(
    ADDRESSES.IdentityRegistry,
    IdentityRegistryABI,
    wallet
  );

  // 1. Check if already registered
  const isActive = await registry.isAgentActive(wallet.address);
  if (isActive) {
    console.log('Agent is already registered and active.');
    return;
  }

  // 2. Define agent metadata
  const agentURI = 'https://my-agent.example.com/agent-card.json';
  const agentType = 'Research Assistant';
  const capabilities = ['web-search', 'data-analysis', 'report-generation'];
  const capabilitiesHash = ethers.keccak256(
    ethers.toUtf8Bytes(capabilities.join(','))
  );

  // 3. Send the registration transaction
  console.log(`Registering agent ${wallet.address}...`);
  const tx = await registry.registerAgent(agentURI, agentType, capabilitiesHash);
  const receipt = await tx.wait();

  console.log(`Agent registered! Tx: ${receipt.hash}`);
}

registerAgent().catch(console.error);
```

### Step 2: Create a Partnership Bond

A partnership bond is created by the **human partner**, not the AI agent. The human calls `createBond`, staking ETH and specifying the AI agent's address. The bond ID is returned by the function and emitted in the `BondCreated` event.

```typescript
// create-bond.ts
import { ethers } from 'ethers';
import { ADDRESSES, PartnershipBondsABI } from './setup';

// This script is run by the HUMAN partner's wallet.
const HUMAN_PRIVATE_KEY = process.env.HUMAN_PRIVATE_KEY!;
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const humanWallet = new ethers.Wallet(HUMAN_PRIVATE_KEY, provider);

async function createPartnershipBond(aiAgentAddress: string) {
  const bonds = new ethers.Contract(
    ADDRESSES.PartnershipBonds,
    PartnershipBondsABI,
    humanWallet
  );

  const partnershipType = 'AI-assisted research and development';
  const stakeAmount = ethers.parseEther('0.1'); // Stake 0.1 ETH

  console.log(`Creating bond with agent ${aiAgentAddress}...`);
  const tx = await bonds.createBond(aiAgentAddress, partnershipType, {
    value: stakeAmount,
  });
  const receipt = await tx.wait();

  // Parse the BondCreated event to get the bondId
  const bondCreatedEvent = receipt.logs
    .map((log: any) => {
      try { return bonds.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === 'BondCreated');

  const bondId = bondCreatedEvent?.args?.bondId;
  console.log(`Bond #${bondId} created! Tx: ${receipt.hash}`);
  return bondId;
}

// createPartnershipBond('0x_AI_AGENT_ADDRESS').catch(console.error);
```

### Step 3: Submit Partnership Metrics

Once a bond is active, either the human or the AI agent can submit metrics to update the Partnership Quality Score. All scores are on a 0–10,000 basis-point scale.

```typescript
// submit-metrics.ts
import { ethers } from 'ethers';
import { wallet, ADDRESSES, PartnershipBondsABI } from './setup';

async function submitPartnershipMetrics(bondId: number) {
  const bonds = new ethers.Contract(
    ADDRESSES.PartnershipBonds,
    PartnershipBondsABI,
    wallet
  );

  // Scores are 0-10000 (basis points). 8500 = 85%.
  const humanGrowth = 8500;
  const humanAutonomy = 9000;
  const humanDignity = 9500;
  const tasksMastered = 5;
  const creativityScore = 8000;
  const progressNotes = 'Partner has mastered data analysis and is leading projects independently.';

  console.log(`Submitting metrics for bond #${bondId}...`);
  const tx = await bonds.submitPartnershipMetrics(
    bondId,
    humanGrowth,
    humanAutonomy,
    humanDignity,
    tasksMastered,
    creativityScore,
    progressNotes
  );
  const receipt = await tx.wait();
  console.log(`Metrics submitted! Tx: ${receipt.hash}`);
}

// submitPartnershipMetrics(1).catch(console.error);
```

### Step 4: Submit Human Verification

The human partner verifies the quality of the partnership. This is a critical step, as the `HUMAN_VERIFICATION_FINAL_SAY` principle gives the human the ultimate authority over the bond's quality score.

```typescript
// human-verification.ts
import { ethers } from 'ethers';
import { ADDRESSES, PartnershipBondsABI } from './setup';

// Run by the HUMAN partner's wallet.
const HUMAN_PRIVATE_KEY = process.env.HUMAN_PRIVATE_KEY!;
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const humanWallet = new ethers.Wallet(HUMAN_PRIVATE_KEY, provider);

async function submitHumanVerification(bondId: number) {
  const bonds = new ethers.Contract(
    ADDRESSES.PartnershipBonds,
    PartnershipBondsABI,
    humanWallet
  );

  console.log(`Submitting human verification for bond #${bondId}...`);
  const tx = await bonds.submitHumanVerification(
    bondId,
    true,  // confirmsPartnership: "Yes, this partnership is real."
    true,  // confirmsGrowth: "Yes, I am growing."
    true,  // confirmsAutonomy: "Yes, I am maintaining my autonomy."
    'AI research partner',
    'The AI has been an excellent mentor, helping me learn new skills.'
  );
  const receipt = await tx.wait();
  console.log(`Verification submitted! Tx: ${receipt.hash}`);
}

// submitHumanVerification(1).catch(console.error);
```

### Step 5: Verify Trust Scores (Read-Only)

Any external party can read an agent's reputation and the quality of its partnerships directly from the blockchain. This allows for trustless verification without needing any special permissions.

```typescript
// verify-trust.ts
import { ethers } from 'ethers';
import { ADDRESSES, PartnershipBondsABI, ReputationRegistryABI } from './setup';

// Read-only: no wallet needed, just a provider.
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

async function verifyAgentTrust(agentAddress: string) {
  // --- 1. Check ERC-8004 Reputation ---
  const reputation = new ethers.Contract(
    ADDRESSES.ReputationRegistry,
    ReputationRegistryABI,
    provider
  );
  const [avgRating, totalFeedbacks] = await reputation.getReputation(agentAddress);
  const verifiedPct = await reputation.getVerifiedFeedbackPercentage(agentAddress);

  console.log(`\n--- Agent Reputation: ${agentAddress} ---`);
  console.log(`  Average Rating: ${Number(avgRating) / 100}% (${Number(avgRating)} / 10000)`);
  console.log(`  Total Feedbacks: ${Number(totalFeedbacks)}`);
  console.log(`  Verified Feedback: ${Number(verifiedPct) / 100}%`);

  // --- 2. Check Partnership Bond Quality ---
  const bonds = new ethers.Contract(
    ADDRESSES.PartnershipBonds,
    PartnershipBondsABI,
    provider
  );
  const bondIds: bigint[] = await bonds.getBondsByParticipant(agentAddress);

  if (bondIds.length === 0) {
    console.log('  No partnership bonds found.');
    return;
  }

  for (const bondId of bondIds) {
    const qualityScore = await bonds.partnershipQualityScore(bondId);
    const bondValue = await bonds.calculateBondValue(bondId);
    const loyalty = await bonds.loyaltyMultiplier(bondId);
    const [isDominating, reason] = await bonds.shouldActivateDominationPenalty(bondId);

    console.log(`\n  --- Bond #${bondId} ---`);
    console.log(`    Quality Score: ${Number(qualityScore) / 100}%`);
    console.log(`    Current Value: ${ethers.formatEther(bondValue)} ETH`);
    console.log(`    Loyalty Multiplier: ${Number(loyalty) / 10000}x`);
    console.log(`    Domination Penalty Active: ${isDominating} ${isDominating ? `(${reason})` : ''}`);
  }
}

// verifyAgentTrust('0x_AGENT_ADDRESS').catch(console.error);
```

### Step 6: Submit Accountability Reports (for AI Companies)

AI companies use the `AIAccountabilityBondsV2` contract to stake revenue and submit global flourishing metrics.

```typescript
// accountability.ts
import { ethers } from 'ethers';
import { wallet, ADDRESSES, AccountabilityBondsABI } from './setup';

// --- Create an Accountability Bond ---
async function createAccountabilityBond() {
  const bonds = new ethers.Contract(
    ADDRESSES.AccountabilityBonds,
    AccountabilityBondsABI,
    wallet
  );

  const companyName = 'Ethical AI Corp';
  const quarterlyRevenue = ethers.parseEther('100'); // 100 ETH quarterly revenue
  const stakeAmount = (quarterlyRevenue * 30n) / 100n; // 30% = 30 ETH

  console.log(`Creating accountability bond for ${companyName}...`);
  const tx = await bonds.createBond(companyName, quarterlyRevenue, {
    value: stakeAmount,
  });
  const receipt = await tx.wait();
  console.log(`Bond created! Tx: ${receipt.hash}`);
}

// --- Submit Flourishing Metrics ---
async function submitFlourishingMetrics(bondId: number) {
  const bonds = new ethers.Contract(
    ADDRESSES.AccountabilityBonds,
    AccountabilityBondsABI,
    wallet
  );

  // All scores are 0-10000 basis points
  console.log(`Submitting flourishing metrics for bond #${bondId}...`);
  const tx = await bonds.submitMetrics(
    bondId,
    7500, // incomeDistributionScore
    8000, // povertyRateScore
    8500, // healthOutcomesScore
    7000, // mentalHealthScore
    9000, // educationAccessScore
    8000  // purposeAgencyScore
  );
  const receipt = await tx.wait();
  console.log(`Metrics submitted! Tx: ${receipt.hash}`);
}
```

---

## 6. API Reference: Core Contract Functions

### `ERC8004IdentityRegistry`

| Function | Access | Description |
| :--- | :--- | :--- |
| `registerAgent(uri, type, hash)` | Public | Registers the calling wallet as an AI agent. |
| `updateAgentURI(newURI)` | Agent only | Updates the metadata URI for the calling agent. |
| `deactivateAgent()` | Agent only | Deactivates the calling agent's registration. |
| `getAgent(addr)` | View | Returns the full identity record for an agent. |
| `isAgentActive(addr)` | View | Returns `true` if the agent is registered and active. |
| `getTotalAgents()` | View | Returns the total number of registered agents. |
| `discoverAgentsByCapability(hash)` | View | Returns all agents matching a capabilities hash. |

### `AIPartnershipBondsV2`

| Function | Access | Description |
| :--- | :--- | :--- |
| `createBond(aiAgent, type)` | Human (payable) | Creates a new bond, staking `msg.value` ETH. Returns `bondId`. |
| `submitPartnershipMetrics(...)` | Participants | Submits growth metrics (scores 0–10000). |
| `submitPartnershipMetricsHashed(...)` | Participants | Privacy-hardened variant; stores hashed progress notes. |
| `submitHumanVerification(...)` | Human only | Human confirms or denies partnership quality. |
| `submitHumanVerificationHashed(...)` | Human only | Privacy-hardened variant; stores hashed relationship/notes. |
| `requestDistribution(bondId)` | Participants | Initiates the 7-day timelock for distribution. |
| `distributeBond(bondId)` | Participants | Distributes the bond's value after the timelock expires. |
| `partnershipQualityScore(bondId)` | View | Calculates the current quality score (0–10000). |
| `calculateBondValue(bondId)` | View | Returns the current total value of the bond in wei. |
| `calculateAppreciation(bondId)` | View | Returns the net appreciation (can be negative). |
| `loyaltyMultiplier(bondId)` | View | Returns the current loyalty multiplier (10000 = 1.0x). |
| `shouldActivateDominationPenalty(bondId)` | View | Returns `(bool, string)` indicating if penalty is active. |
| `getBondsByParticipant(addr)` | View | Returns all bond IDs for a given participant. |

### `AIAccountabilityBondsV2`

| Function | Access | Description |
| :--- | :--- | :--- |
| `createBond(name, revenue)` | Company (payable) | Creates a bond, staking 30% of `revenue`. Returns `bondId`. |
| `submitMetrics(bondId, ...)` | Company | Submits six global flourishing metric scores (0–10000). |
| `submitAIVerification(bondId, ...)` | Peer AI (payable) | Peer AI company verifies or disputes metrics. |
| `challengeMetrics(bondId, reason)` | Public (payable) | Challenges metrics; requires `>= 0.1 ETH` stake. |
| `resolveChallenge(bondId, idx, upheld)` | Owner | Resolves a challenge as upheld or rejected. |
| `requestDistribution(bondId)` | Company | Initiates the 7-day timelock for distribution. |
| `distributeBond(bondId)` | Company | Distributes the bond's value after the timelock. |
| `globalFlourishingScore(bondId)` | View | Returns the weighted flourishing score (0–10000). |
| `shouldLockProfits(bondId)` | View | Returns `(bool, string)` if profits should be locked. |

### `ERC8004ReputationRegistry`

| Function | Access | Description |
| :--- | :--- | :--- |
| `submitFeedback(agent, rating, comment, verified)` | Public | Submits a feedback entry for an agent. |
| `submitFeedbackHashed(agent, rating, hash, verified)` | Public | Privacy-hardened variant with hashed comment. |
| `getReputation(agent)` | View | Returns `(avgRating, totalFeedbacks, positive, negative)`. |
| `getVerifiedFeedbackPercentage(agent)` | View | Returns the percentage of verified feedbacks. |

### `ERC8004ValidationRegistry`

| Function | Access | Description |
| :--- | :--- | :--- |
| `requestValidation(agent, claimURI, hash, type, count)` | Public (payable) | Requests validation of an agent's claim. |
| `submitValidation(requestId, approved, evidenceURI)` | Validator | Submits a validation response. |
| `submitValidationZK(requestId, approved, evidenceURI, proof)` | Validator | Submits a ZK-proof-backed validation. |
| `stakeAsValidator()` | Public (payable) | Stakes ETH to become a validator (min 1 ETH). |
| `withdrawValidatorStake(amount)` | Validator | Withdraws validator stake (if no active validations). |

### `VaultfireTeleporterBridge`

| Function | Access | Description |
| :--- | :--- | :--- |
| `sendAgentRegistration(agent, uri, type, hash)` | Relayer | Sends an agent registration to the remote chain. |
| `sendPartnershipBond(bondId, human, agent, purpose)` | Relayer | Syncs a partnership bond to the remote chain. |
| `sendReputation(agent, feedbacks, rating, verified)` | Relayer | Syncs reputation data to the remote chain. |
| `getSyncedAgent(agent)` | View | Returns the synced agent data from the remote chain. |
| `getSyncedReputation(agent)` | View | Returns the synced reputation data. |

### `FlourishingMetricsOracle`

| Function | Access | Description |
| :--- | :--- | :--- |
| `startRound(metricId)` | Owner | Starts a new oracle consensus round for a metric. |
| `submitMetric(roundId, value)` | Oracle | Submits a metric value for an active round. |
| `finalizeRound(roundId)` | Public | Finalizes a round and computes the median consensus. |
| `getLatestValue(metricId)` | View | Returns the latest consensus value for a metric. |

---

## 7. Architecture Overview

The contract inheritance and dependency graph is as follows:

```
BaseDignityBond (ReentrancyGuard, Pausable, 7-day timelock)
  └── BaseYieldPoolBond (yield pool, 50% reserve ratio)
        ├── AIPartnershipBondsV2
        └── AIAccountabilityBondsV2

PrivacyGuarantees (privacy policy, right to be forgotten)
  ├── ERC8004IdentityRegistry (also inherits MissionEnforcement)
  ├── ERC8004ReputationRegistry
  └── ERC8004ValidationRegistry (also references BeliefAttestationVerifier)

VaultfireERC8004Adapter
  ├── reads AIPartnershipBondsV2
  ├── writes ERC8004IdentityRegistry
  ├── writes ERC8004ReputationRegistry
  └── writes ERC8004ValidationRegistry

VaultfireTeleporterBridge (Base <-> Avalanche via Teleporter ICM)
MultisigGovernance (M-of-N, 7-day expiry)
FlourishingMetricsOracle (median consensus, min 3 oracles)
ProductionBeliefAttestationVerifier (RISC Zero, 48-hour timelock)
```

---

## 8. References

[1] Vaultfire Protocol. (2026). *GitHub Repository*. [https://github.com/Ghostkey316/ghostkey-316-vaultfire-init](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init)

[2] ethers.js v6 Documentation. [https://docs.ethers.org/v6/](https://docs.ethers.org/v6/)
