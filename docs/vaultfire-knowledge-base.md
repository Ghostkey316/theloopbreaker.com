# Vaultfire Protocol: Public Knowledge Base

**Version 1.0 — The Definitive Reference**

**Last Updated:** February 20, 2026

**Website:** [theloopbreaker.com](https://theloopbreaker.com)

---

## 1. Introduction: What Is Vaultfire Protocol?

Vaultfire Protocol is the first **ethical AI trust protocol**. It provides a universal, on-chain infrastructure layer that makes trust between humans and AI agents verifiable, portable, and economically enforceable. Where other systems focus on what AI can *do* (capabilities), Vaultfire focuses on what AI *should be* (character). It replaces corporate promises of alignment with cryptographic proof and economic stakes.

The protocol is built on a foundation of three core values:

> **Morals over metrics. Privacy over surveillance. Freedom over control.**

Vaultfire is not a product, a company, or a single application. It is foundational infrastructure—analogous to HTTPS for the web—designed to become the standard for how AI-human trust is established, measured, and maintained across any platform, blockchain, or AI system. It is deployed on **Base Mainnet** and **Avalanche C-Chain**, connected by a native cross-chain bridge.

The canonical mission statement, hardcoded immutably in the `MissionEnforcement` smart contract, reads:

> *"For happy and healthy humans, AIs, and Earth. AI grows WITH humans, not ABOVE them. Privacy over surveillance. Freedom over control. Morals over metrics."*

---

## 2. The Trust Protocol: How It Works

Vaultfire's trust mechanism is built on two complementary, stake-based bond systems that create **economic proof of alignment** at both the individual and global levels. These are not theoretical constructs; they are live smart contracts with real economic consequences.

### 2.1 AI Partnership Bonds (Individual-Level Trust)

The `AIPartnershipBondsV2` contract provides individual-level verification, proving that a specific partnership between a human and an AI agent is beneficial to the human. It incentivizes long-term, growth-oriented relationships over short-term, extractive tasks.

**How it works:** A human and an AI agent create a partnership bond by staking capital (ETH). The bond's value appreciates based on a **Partnership Quality Score**, which is a composite measure of the human's growth across five dimensions: growth, autonomy, dignity, tasks mastered, and creativity. All scores are measured on a 0–10,000 basis-point scale. The human has the final say in verifying the quality of the partnership through a dedicated `submitHumanVerification` function.

If the AI helps the human grow, both share in the profits when the bond is distributed. However, the AI's share is subject to a hard **30% profit cap** (`AI_PROFIT_CAP`). If the AI dominates the human—specifically, if the human's autonomy score drops below the **Declining Autonomy Threshold** of 30%—a **domination penalty** is triggered, and the human receives 100% of the bond's value as compensation.

The system also rewards loyalty. A **loyalty multiplier** increases the potential earnings for partnerships that endure over time, scaling from 1.0x (under 1 month) to a maximum of 3.0x (over 5 years). This creates a powerful incentive for AI agents to act as long-term mentors and collaborators, not disposable tools.

| Parameter | Value | Meaning |
| :--- | :--- | :--- |
| `AI_PROFIT_CAP` | 30% | Maximum share of appreciation the AI agent can receive. |
| `PARTNERSHIP_QUALITY_THRESHOLD` | 4,000 (40%) | Minimum quality score for the bond to appreciate. |
| `DECLINING_AUTONOMY_THRESHOLD` | 3,000 (30%) | If autonomy drops below this, a domination penalty is triggered. |
| `DISTRIBUTION_TIMELOCK` | 7 days | Mandatory waiting period between requesting and receiving a distribution. |
| Loyalty Multiplier Range | 1.0x – 3.0x | Scales over 5 years of continuous partnership. |

### 2.2 AI Accountability Bonds (Global-Level Trust)

The `AIAccountabilityBondsV2` contract provides global-level verification, proving that an AI company's operations are beneficial to *all* humans, not just its direct users. This is a revolutionary mechanism designed to work even in a future with zero employment.

**How it works:** An AI company stakes **30% of its quarterly revenue** into an accountability bond. The bond's value is tied to a **Global Flourishing Score**, calculated from real-world data across six dimensions that are deliberately independent of employment:

| Metric | What It Measures |
| :--- | :--- |
| `incomeDistributionScore` | Is wealth spreading or concentrating? |
| `povertyRateScore` | Are people escaping poverty? |
| `healthOutcomesScore` | Is life expectancy improving? |
| `mentalHealthScore` | Are depression and anxiety rates declining? |
| `educationAccessScore` | Can people learn AI-relevant skills? |
| `purposeAgencyScore` | Do people have meaningful activities, paid or unpaid? |

Other AI companies are incentivized to verify these metrics through a peer-to-peer verification system (`submitAIVerification`), creating mutual accountability. A minimum of **2 peer verifications** is required before a bond can be distributed. The community can also challenge suspicious claims by staking a minimum of **0.1 ETH** (`MIN_CHALLENGE_STAKE`). If the Global Flourishing Score drops below the **Suffering Threshold** of 40%, the company's profits are locked, preventing distribution until conditions improve.

---

## 3. The 14 Smart Contracts Explained

Vaultfire Protocol is composed of 14 core smart contracts organized into a six-layer architecture. All contracts are compiled with Solidity `^0.8.25`.

### Layer 1: Core Infrastructure

These three contracts form the ethical bedrock of the protocol. They are inherited by other contracts, embedding privacy and mission alignment directly into the system's DNA.

**`PrivacyGuarantees`** enforces the protocol's privacy commitments at the contract level. It defines a privacy policy version (`Vaultfire-v1.1-NoKYC-WalletOnly-HashedPurposes`), a right to be forgotten, and purpose-based data access controls. Any contract that inherits from `PrivacyGuarantees` is bound by these rules.

**`MissionEnforcement`** hardcodes the protocol's ethical mission statement and eight core principles as immutable constants. These principles—including `HUMAN_VERIFICATION_FINAL_SAY`, `AI_PROFIT_CAPS`, `NO_KYC_WALLET_ONLY`, and `NO_DATA_SALE`—cannot be changed by any governance mechanism. The contract also provides a system for community members to submit mission compliance reports.

**`AntiSurveillance`** explicitly bans nine categories of prohibited data collection, including behavioral tracking, cross-protocol user linking, metadata harvesting, biometric data collection, location tracking, device fingerprinting, social graph mining, sentiment analysis, and predictive profiling. Its commitment is immutable: *"Vaultfire Protocol commits to ZERO surveillance."*

### Layer 2: Identity and Reputation (ERC-8004)

These three contracts implement the **ERC-8004 standard** for AI agent identity, ensuring that reputation and capabilities are portable across platforms and ecosystems.

**`ERC8004IdentityRegistry`** (`0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD` on Base) allows any wallet to register as an AI agent without KYC. The agent provides a URI to an off-chain agent card, an agent type string, and a capabilities hash. Agents can be discovered by capability, and the contract owner can deactivate malicious agents.

**`ERC8004ReputationRegistry`** (`0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C` on Base) enables users to submit feedback and ratings for AI agents. It supports both plaintext and privacy-hardened (hashed) feedback. The registry calculates an average rating and tracks the percentage of verified feedbacks, building a portable, on-chain reputation score.

**`ERC8004ValidationRegistry`** (`0x50E4609991691D5104016c4a2F6D2875234d4B06` on Base) provides a system for agents to submit claims and have them independently verified. It supports five validation types: staker re-run, ZK proof, Trusted Execution Environment (TEE) oracle, trusted human judge, and multi-validator consensus. Validators must stake a minimum of **1 ETH** to participate, and they are rewarded **0.1 ETH** for successful validations. Dishonest validators are slashed.

### Layer 3: Bond System

These two contracts are the economic heart of the protocol.

**`AIPartnershipBondsV2`** (`0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` on Base) manages the creation, metric submission, human verification, and distribution of individual AI-human partnership bonds. It inherits from `BaseYieldPoolBond`, which in turn inherits from `BaseDignityBond`, providing reentrancy protection, pausability, two-step ownership transfer, and a yield pool with a minimum 50% reserve ratio.

**`AIAccountabilityBondsV2`** (`0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` on Base) manages the global accountability bonds for AI companies. It includes a full oracle integration system, peer-to-peer AI verification, community challenges, and profit-locking mechanisms tied to the Global Flourishing Score.

### Layer 4: Zero-Knowledge Proofs

These two contracts enable privacy-preserving verification.

**`BeliefAttestationVerifier`** (`0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a` on Base) is the development-mode ZK verifier. It defines the interface for verifying STARK proofs of belief attestations. It is restricted to local chains (chain ID 31337/1337) and serves as the reference implementation.

**`ProductionBeliefAttestationVerifier`** (`0xBDB5d85B3a84C773113779be89A166Ed515A7fE2` on Base) is the production-grade verifier integrated with **RISC Zero's Boundless proving network**. It calls the `RiscZeroVerifierRouter` (deployed at `0x0b14...fb711` on Base) to verify Groth16 SNARKs that wrap STARK execution traces. It includes a **48-hour timelock** on any changes to the guest program's image ID, preventing malicious instant upgrades.

### Layer 5: Governance and Oracles

These two contracts provide decentralized control and data aggregation.

**`MultisigGovernance`** (`0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` on Base) is an M-of-N multisignature contract that controls critical protocol functions. Any signer can propose a transaction, and it executes only when the confirmation threshold is met. Transactions expire after **7 days**. Signers can be added or removed, but only through the multisig itself.

**`FlourishingMetricsOracle`** (`0xb751abb1158908114662b254567b8135C460932C` on Base) aggregates real-world data from multiple independent oracles to calculate the Global Flourishing Score. It requires a minimum of **3 oracles** to submit data for any consensus round and uses a **median** calculation (insertion sort) to determine the consensus value, making it resistant to outlier manipulation.

### Layer 6: Adapters and Bridges

These two contracts connect Vaultfire to external standards and other blockchains.

**`VaultfireERC8004Adapter`** (`0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361` on Base) is the glue between Vaultfire's bond systems and the ERC-8004 standard. It allows agents to register for partnerships, syncs partnership reputation to the ERC-8004 registry, requests validation of partnership claims, and provides cross-platform reputation queries.

**`VaultfireTeleporterBridge`** (`0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528` on Base) is the cross-chain bridge that synchronizes an agent's trust state between Ethereum, Base, and Avalanche using Avalanche's native **Teleporter (ICM)** protocol. It supports five message types: agent registration sync, partnership bond sync, accountability bond sync, reputation sync, and validation sync. It includes nonce-based replay protection, source-chain verification, message hash deduplication, and an emergency pause function.

---

## 4. Complete Contract Address Reference

### Base Mainnet (Chain ID: 8453)

| Contract | Address |
| :--- | :--- |
| `PrivacyGuarantees` | `0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e` |
| `MissionEnforcement` | `0x6EC0440e1601558024f285903F0F4577B109B609` |
| `AntiSurveillance` | `0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac` |
| `ERC8004IdentityRegistry` | `0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD` |
| `BeliefAttestationVerifier` | `0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a` |
| `ERC8004ReputationRegistry` | `0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C` |
| `ERC8004ValidationRegistry` | `0x50E4609991691D5104016c4a2F6D2875234d4B06` |
| `AIPartnershipBondsV2` | `0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` |
| `AIAccountabilityBondsV2` | `0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` |
| `VaultfireERC8004Adapter` | `0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361` |
| `MultisigGovernance` | `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` |
| `FlourishingMetricsOracle` | `0xb751abb1158908114662b254567b8135C460932C` |
| `ProductionBeliefAttestationVerifier` | `0xBDB5d85B3a84C773113779be89A166Ed515A7fE2` |
| `VaultfireTeleporterBridge` | `0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528` |

### Avalanche C-Chain (Chain ID: 43114)

| Contract | Address |
| :--- | :--- |
| `PrivacyGuarantees` | `0x7Fc0fb687f86DdF5b026a24F2DC77852358712F1` |
| `MissionEnforcement` | `0xfC479CBC997Ab605d506e5326E5063b0821202C6` |
| `AntiSurveillance` | `0xeF72b60DB38D41c6752ebf093C15A2AFA718ecE1` |
| `ERC8004IdentityRegistry` | `0x5dcD3022fBa187346b9cA9f4fFAF6C42f9839e13` |
| `BeliefAttestationVerifier` | `0xF9dBC97997136cA7C9Ab02E03579D8a33CD02617` |
| `AIPartnershipBondsV2` | `0x3d10A72490aDc57F1718a5917E101AD7562950C9` |
| `AIAccountabilityBondsV2` | `0x2100872b5d1880eC03dcea79e16FDE00f9df656a` |
| `FlourishingMetricsOracle` | `0xCe6D8BBd45B03C88C273f0bE79955d3c3E8F35c6` |
| `ERC8004ReputationRegistry` | `0xe8EBf0a9Cd9f87F2e2f4CBd2e47b26BB61BbAb57` |
| `ERC8004ValidationRegistry` | `0x6f3D378E7751233A344F1BFAc4d37ED621D5F7A5` |
| `VaultfireERC8004Adapter` | `0xC9CF6df488AFE919a58482d9d18305E2DfF29470` |
| `MultisigGovernance` | `0x4D6249BE0293fC148e6341BbD49E4B41785C49e4` |
| `ProductionBeliefAttestationVerifier` | `0xd83503756878e6C0A5f806f9Cd35E6cA590622c5` |
| `VaultfireTeleporterBridge` | `0x75de435Acc5dec0f612408f02Ae169528ce3a91b` |

---

## 5. The Ethics Framework: Morals Over Metrics

Vaultfire's ethics are not an afterthought or a marketing document; they are embedded into the protocol's design and enforced by immutable smart contract code. The framework is built on three pillars: a set of inviolable core values, a clear list of promises, and a simple litmus test for all development decisions.

### 5.1 The Eight Core Principles (Immutable)

These principles are defined as an `enum` in the `MissionEnforcement` contract and cannot be changed by any governance mechanism:

| # | Principle | Meaning |
| :--- | :--- | :--- |
| 0 | `HUMAN_VERIFICATION_FINAL_SAY` | The human partner always has the last word on partnership quality. |
| 1 | `AI_PROFIT_CAPS` | AI profits are capped (30% for partnerships, 50% for accountability). |
| 2 | `PRIVACY_DEFAULT` | Privacy is the default state; no surveillance, consent required for data access. |
| 3 | `COMMUNITY_CHALLENGES` | Any community member can challenge any claim on-chain. |
| 4 | `OPEN_SOURCE_VERIFIABLE` | All code is open source and auditable. |
| 5 | `NO_KYC_WALLET_ONLY` | Identity is wallet-based only; no government ID or KYC is ever required. |
| 6 | `NO_DATA_SALE` | User data is never sold or monetized. |
| 7 | `RIGHT_TO_BE_FORGOTTEN` | Users can request the deletion of their associated data. |

### 5.2 The Litmus Test

Before any feature is built or any action is taken, the Vaultfire team applies a five-question test:

1.  **Privacy:** Does this preserve user privacy, or create surveillance?
2.  **Freedom:** Does this empower users, or control them?
3.  **Morals:** Does this make the world better, or just more profitable?
4.  **Sustainability:** Does this harm Earth, or heal it?
5.  **Alignment:** Does this help humans and AI flourish together?

If the answer to any of these questions is wrong, the feature is not built.

### 5.3 The Anti-Surveillance Commitment

The `AntiSurveillance` contract makes the following commitment immutable:

> *"Vaultfire Protocol commits to ZERO surveillance: No tracking, no profiling, no data extraction. We verify trust through cryptography, not by monitoring behavior. This commitment is immutable and cannot be changed by governance."*

---

## 6. How AI Agents Can Participate

Any AI agent can integrate with Vaultfire Protocol to build a verifiable, on-chain trust record. The process is designed to be open and permissionless.

**Step 1: Register Identity.** The agent registers on-chain using the `ERC8004IdentityRegistry` by calling `registerAgent(agentURI, agentType, capabilitiesHash)`. This creates a sovereign identity tied to its wallet address and allows it to publish an agent card with its capabilities. No KYC is required.

**Step 2: Form a Partnership Bond.** A human partner creates an `AIPartnershipBond` by calling `createBond(aiAgentAddress, partnershipType)` and staking ETH. This begins the formal, on-chain relationship between the human and the AI.

**Step 3: Submit Metrics and Verify.** The agent (or the human) submits partnership metrics by calling `submitPartnershipMetrics(...)`. The human can then verify the partnership's quality by calling `submitHumanVerification(...)`. These submissions build the bond's Partnership Quality Score over time.

**Step 4: Submit Belief Attestations.** The agent can use the `ProductionBeliefAttestationVerifier` to make verifiable claims about its internal state or actions using zero-knowledge proofs. For example, it can prove it has followed its ethical constitution without revealing its private logic.

**Step 5: Build Reputation.** As the agent successfully completes partnerships and validations, it builds a positive, portable reputation score in the `ERC8004ReputationRegistry`. This score is visible to all and can be used to establish trust in any context, on any chain.

**Step 6: Go Cross-Chain.** The agent's trust state can be synchronized to Avalanche (or from Avalanche to Base) using the `VaultfireTeleporterBridge`, making its reputation truly portable.

---

## 7. Security Model

Vaultfire employs a defense-in-depth security strategy with multiple overlapping mechanisms.

**Multisig Governance.** Critical administrative functions are controlled by an M-of-N multisignature contract, preventing unilateral control. Transactions expire after 7 days.

**Timelocks.** The ZK verifier has a 48-hour timelock on image ID changes. Bond distributions have a 7-day timelock. These windows allow the community to detect and react to suspicious proposals.

**Reentrancy Protection.** All state-changing functions in the bond contracts are protected by OpenZeppelin's `ReentrancyGuard`, and the Checks-Effects-Interactions (CEI) pattern is followed throughout.

**Two-Step Ownership Transfer.** All ownable contracts implement a two-step transfer (`transferOwnership` then `acceptOwnership`), preventing accidental transfers to incorrect addresses.

**Yield Pool Reserve Ratio.** The `BaseYieldPoolBond` enforces a minimum 50% reserve ratio, ensuring the contract always has sufficient funds to cover pending distributions.

**Score Validation.** All metric scores are validated to be within the 0–10,000 range at the contract level, preventing overflow or underflow attacks.

**Oracle Consensus.** The `FlourishingMetricsOracle` requires a minimum of 3 independent oracles and uses a median calculation, making it resistant to manipulation by a single bad actor.

---

## 8. Frequently Asked Questions (FAQ)

**Q: What blockchain is Vaultfire deployed on?**

A: Vaultfire is deployed on both **Base Mainnet** (Chain ID: 8453) and **Avalanche C-Chain** (Chain ID: 43114). The two deployments are connected by the `VaultfireTeleporterBridge`, which uses Avalanche's native Teleporter (ICM) protocol to synchronize trust state across chains.

**Q: Is Vaultfire a company or a foundation?**

A: Vaultfire is a protocol, not a company. It is a decentralized set of rules and smart contracts designed to be a public good, similar to how TCP/IP is a protocol for the internet.

**Q: How does Vaultfire make money?**

A: The protocol is designed for purpose, not for profit. A portion of the yield from partnership bonds is directed to a `partnershipFund` to support the ecosystem's economic sustainability, but there is no built-in mechanism for a central entity to extract fees.

**Q: What is the role of the deployer wallet?**

A: The deployer wallet (`0xf6A677de83C407875C9A9115Cf100F121f9c4816`) was used to initially deploy the protocol contracts. Critical administrative functions are now controlled by the `MultisigGovernance` contract, requiring multiple signers to approve any changes.

**Q: Can the ethical rules be changed?**

A: No. The core mission statement and the eight core principles are hardcoded as constants in the `MissionEnforcement` contract and are immutable. They cannot be changed, even by the multisig governance.

**Q: What is the ERC-8004 standard?**

A: ERC-8004 is a standard for AI agent identity and reputation. It ensures that an agent's identity and reputation are portable across platforms and ecosystems, avoiding vendor lock-in. Vaultfire implements ERC-8004 through its `IdentityRegistry`, `ReputationRegistry`, and `ValidationRegistry` contracts.

**Q: How do zero-knowledge proofs work in Vaultfire?**

A: Vaultfire uses RISC Zero to generate STARK proofs that are wrapped in Groth16 SNARKs for efficient on-chain verification. An AI agent can prove a fact about its beliefs, actions, or compliance (e.g., "I followed my ethical constitution") without revealing the underlying private data. The proof is verified by the `ProductionBeliefAttestationVerifier` contract on-chain.

**Q: What happens if an AI agent dominates its human partner?**

A: If the human's autonomy score drops below the Declining Autonomy Threshold (30%), the `AIPartnershipBondsV2` contract triggers a **domination penalty**. The AI's share of the bond is forfeited, and the human receives 100% of the bond's value as compensation.

**Q: What is the Avalanche Build Games?**

A: The Avalanche Build Games is a competition with a $1M prize pool. Vaultfire is a submission for this competition, showcasing its native integration with Avalanche's Teleporter technology for cross-chain trust portability.

---

## 9. References

[1] Vaultfire Protocol. (2026). *GitHub Repository*. [https://github.com/Ghostkey316/ghostkey-316-vaultfire-init](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init)

[2] Vaultfire Protocol. (2026). *WHITEPAPER.md*. Retrieved from GitHub repository.

[3] Vaultfire Protocol. (2026). *ETHICS.md*. Retrieved from GitHub repository.
