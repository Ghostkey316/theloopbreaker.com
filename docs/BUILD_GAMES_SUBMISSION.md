# Vaultfire Protocol — Avalanche Build Games Submission

## Project Overview

Vaultfire is on-chain trust infrastructure for AI agents. It provides a complete, verifiable trust layer that enables humans and AI agents to form accountable partnerships backed by economic stakes, cryptographic identity, and portable reputation. The protocol answers the fundamental question of the AI age: how do you trust an autonomous agent?

The core innovation is a dual-bond architecture. Partnership Bonds lock value between a human and an AI agent, enforcing a distribution model where the AI cannot profit unless the human thrives (AI profit capped at 30%). Accountability Bonds require AI companies to stake capital proportional to their revenue, creating a direct economic cost for misalignment. Together, these bonds form a trust loop: register identity, stake accountability, partner with humans, earn reputation.

Vaultfire is not a prototype. It is a fully deployed, audited, production-grade protocol with 14 verified smart contracts on Base mainnet, an autonomous Sentinel Agent, a live dashboard, and a professional audit. **Vaultfire is also the first protocol to implement cross-chain trust portability using Avalanche Teleporter**, enabling seamless identity and reputation sync between Ethereum, Base, and Avalanche C-Chain. The entire protocol was designed, built, tested, and deployed by a single architect for under $0.20 in total deployment costs.

## Architecture

```
                         VAULTFIRE PROTOCOL ARCHITECTURE
    ============================================================================

    +---------------------------+     +---------------------------+
    |   Human Partner           |     |   AI Agent                |
    |   (0xf6A6...4816)        |     |   (Sentinel / any agent)  |
    +----------+----------------+     +----------+----------------+
               |                                 |
               |  createBond()                   |  registerAgent()
               v                                 v
    +----------+----------------+     +----------+----------------+
    |  AIPartnershipBondsV2     |     |  ERC8004IdentityRegistry  |
    |  Dual-bond system         |     |  Agent identity standard  |
    |  30% AI profit cap        |     |  URI, type, capabilities  |
    +----------+----------------+     +----------+----------------+
               |                                 |
               |  submitFeedback()               |  getAgent()
               v                                 v
    +----------+----------------------------------+----------------+
    |  ERC8004ReputationRegistry                                   |
    |  On-chain reputation from verified partnership data          |
    +----------+---------------------------------------------------+
               |
               v
    +----------+----------------+     +---------------------------+
    |  ERC8004ValidationRegistry|     |  BeliefAttestationVerifier|
    |  Multi-validator approval |     |  RISC Zero STARK proofs   |
    +---------------------------+     +---------------------------+

    +---------------------------+     +---------------------------+
    |  AIAccountabilityBondsV2  |     |  FlourishingMetricsOracle |
    |  Company revenue stakes   |     |  Multi-oracle consensus   |
    +---------------------------+     +---------------------------+

    +---------------------------+     +---------------------------+
    |  MultisigGovernance       |     |  VaultfireERC8004Adapter  |
    |  Threshold signing        |     |  Cross-component bridge   |
    +---------------------------+     +---------------------------+

    +---------------------------+     +---------------------------+
    |  PrivacyGuarantees        |     |  MissionEnforcement       |
    |  No-surveillance pledge   |     |  Values alignment         |
    +---------------------------+     +---------------------------+

    +---------------------------+     +---------------------------+
    |  AntiSurveillance         |     |  ProductionBeliefVerifier |
    |  Anti-panopticon guards   |     |  RISC Zero production ZK  |
    +---------------------------+     +---------------------------+

    +---------------------------+
    |  VaultfireTeleporterBridge|
    |  Avalanche Teleporter sync|
    +---------------------------+
```

## Deployed Contracts — Base Mainnet (Primary)

All 14 contracts are deployed and verified on Base mainnet (Chain ID 8453).

| # | Contract | Address |
|---|---|---|
| 1 | PrivacyGuarantees | [0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045](https://basescan.org/address/0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045) |
| 2 | MissionEnforcement | [0x8568F4020FCD55915dB3695558dD6D2532599e56](https://basescan.org/address/0x8568F4020FCD55915dB3695558dD6D2532599e56) |
| 3 | AntiSurveillance | [0x722E37A7D6f27896C688336AaaFb0dDA80D25E57](https://basescan.org/address/0x722E37A7D6f27896C688336AaaFb0dDA80D25E57) |
| 4 | ERC8004IdentityRegistry | [0x35978DB675576598F0781dA2133E94cdCf4858bC](https://basescan.org/address/0x35978DB675576598F0781dA2133E94cdCf4858bC) |
| 5 | BeliefAttestationVerifier | [0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba](https://basescan.org/address/0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba) |
| 6 | ERC8004ReputationRegistry | [0xdB54B8925664816187646174bdBb6Ac658A55a5F](https://basescan.org/address/0xdB54B8925664816187646174bdBb6Ac658A55a5F) |
| 7 | ERC8004ValidationRegistry | [0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55](https://basescan.org/address/0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55) |
| 8 | AIPartnershipBondsV2 | [0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4](https://basescan.org/address/0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4) |
| 9 | AIAccountabilityBondsV2 | [0xf92baef9523BC264144F80F9c31D5c5C017c6Da8](https://basescan.org/address/0xf92baef9523BC264144F80F9c31D5c5C017c6Da8) |
| 10 | VaultfireERC8004Adapter | [0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0](https://basescan.org/address/0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0) |
| 11 | MultisigGovernance | [0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92](https://basescan.org/address/0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92) |
| 12 | FlourishingMetricsOracle | [0x83dd216449B3F0574E39043ECFE275946fa492e9](https://basescan.org/address/0x83dd216449B3F0574E39043ECFE275946fa492e9) |
| 13 | ProductionBeliefAttestationVerifier | [0xa5CEC47B48999EB398707838E3A18dd20A1ae272](https://basescan.org/address/0xa5CEC47B48999EB398707838E3A18dd20A1ae272) |
| 14 | VaultfireTeleporterBridge | [0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2](https://basescan.org/address/0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2) |

## Deployed Contracts — Avalanche C-Chain Mainnet (Secondary)

All 14 contracts are deployed and verified on Avalanche C-Chain (Chain ID 43114).

| # | Contract | Address |
|---|---|---|
| 1 | PrivacyGuarantees | [0xc09F0e06690332eD9b490E1040BdE642f11F3937](https://snowtrace.io/address/0xc09F0e06690332eD9b490E1040BdE642f11F3937) |
| 2 | MissionEnforcement | [0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB](https://snowtrace.io/address/0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB) |
| 3 | AntiSurveillance | [0x281814eF92062DA8049Fe5c4743c4Aef19a17380](https://snowtrace.io/address/0x281814eF92062DA8049Fe5c4743c4Aef19a17380) |
| 4 | ERC8004IdentityRegistry | [0x57741F4116925341d8f7Eb3F381d98e07C73B4a3](https://snowtrace.io/address/0x57741F4116925341d8f7Eb3F381d98e07C73B4a3) |
| 5 | BeliefAttestationVerifier | [0x227e27e7776d3ee14128BC66216354495E113B19](https://snowtrace.io/address/0x227e27e7776d3ee14128BC66216354495E113B19) |
| 6 | AIPartnershipBondsV2 | [0xea6B504827a746d781f867441364C7A732AA4b07](https://snowtrace.io/address/0xea6B504827a746d781f867441364C7A732AA4b07) |
| 7 | FlourishingMetricsOracle | [0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695](https://snowtrace.io/address/0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695) |
| 8 | ERC8004ReputationRegistry | [0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24](https://snowtrace.io/address/0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24) |
| 9 | ERC8004ValidationRegistry | [0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b](https://snowtrace.io/address/0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b) |
| 10 | AIAccountabilityBondsV2 | [0xaeFEa985E0C52f92F73606657B9dA60db2798af3](https://snowtrace.io/address/0xaeFEa985E0C52f92F73606657B9dA60db2798af3) |
| 11 | VaultfireERC8004Adapter | [0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053](https://snowtrace.io/address/0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053) |
| 12 | MultisigGovernance | [0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee](https://snowtrace.io/address/0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee) |
| 13 | ProductionBeliefAttestationVerifier | [0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F](https://snowtrace.io/address/0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F) |
| 14 | VaultfireTeleporterBridge | [0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31](https://snowtrace.io/address/0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31) |

## Avalanche Demo Transactions

Three live transactions on Avalanche C-Chain demonstrating the full trust loop:

| Action | Transaction |
|---|---|
| Register Agent (ERC8004IdentityRegistry) | [0x3b59a9e7...c6bd](https://snowtrace.io/tx/0x3b59a9e7bcbd280fce97e7369e090131b0b7b9cb0f42eaf9f30906491151c6bd) |
| Create Bond (AIPartnershipBondsV2) | [0x032deb79...4777](https://snowtrace.io/tx/0x032deb79489664b947e62521d1fa66652566aa2b22af7406be369cb2aec04777) |
| Submit Feedback (ERC8004ReputationRegistry) | [0x49fa7e89...6eff](https://snowtrace.io/tx/0x49fa7e89d6dd28b4c885c3f59f64f72ce75d17e6f5eed5c5b7935447128f6eff) |

## Fuji Testnet Deployment

For testnet deployment to Avalanche Fuji, see `docs/FUJI_QUICKSTART.md`. The deployment script is:

```bash
npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji
```

## Links

| Resource | URL |
|---|---|
| Protocol GitHub | [github.com/Ghostkey316/ghostkey-316-vaultfire-init](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init) |
| Dashboard GitHub | [github.com/Ghostkey316/theloopbreaker.com](https://github.com/Ghostkey316/theloopbreaker.com) |
| Live Dashboard | [theloopbreaker.com](https://theloopbreaker.com) |
| Deployer Wallet | [0xA054f831B562e729F8D268291EBde1B2EDcFb84F](https://basescan.org/address/0xA054f831B562e729F8D268291EBde1B2EDcFb84F) |

## How to Run the Demo

The demo script walks through the complete Vaultfire trust loop: agent registration, partnership bond creation, belief attestation, and reputation scoring.

**On local Hardhat network (no funds needed):**

```bash
npm install
npx hardhat compile
npx hardhat run scripts/demo-vaultfire.js
```

**On Avalanche Fuji testnet:**

```bash
# 1. Get Fuji AVAX from https://core.app/tools/testnet-faucet/
# 2. Set your private key
export PRIVATE_KEY="0xYOUR_KEY"

# 3. Deploy contracts (if not already deployed)
npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji

# 4. Run the demo
npx hardhat run scripts/demo-vaultfire.js --network avalancheFuji
```

**Agent demo mode (Sentinel Agent on Fuji):**

```bash
cd agent
npm install
# Set environment variables
export AGENT_PRIVATE_KEY="0xYOUR_KEY"
export VAULTFIRE_CHAIN=avalancheFuji
export DEMO_MODE=true
npm run dev
```

## Test Results Summary

The protocol has comprehensive test coverage across both the smart contract layer and the agent layer.

**Hardhat Tests (Smart Contracts):**

| Suite | Focus | Status |
|---|---|---|
| ERC8004.test.js | Identity, reputation, validation registries | Passing |
| AIPartnershipBonds.test.js | Partnership bond lifecycle, distribution | Passing |
| AIAccountabilityBonds.test.js | Accountability bond creation, slashing | Passing |
| Integration.test.js | Cross-contract integration flows | Passing |
| SecurityEnhancements.test.js | Access control, reentrancy, overflow | Passing |
| AuditRemediation.test.js | Fixes from professional audit | Passing |
| Fuzz.test.js | Fuzz testing with random inputs | Passing |
| GasOptimization.test.js | Gas usage benchmarks | Passing |
| StarkProofVerification.core.test.js | ZK proof verification | Passing |
| Risc0BeliefAttestationProduction.test.js | Production verifier | Passing |
| MissionEnforcementIntegration.test.js | Values enforcement | Passing |
| YieldPoolInvariantsV2.test.js | Yield pool invariants | Passing |
| FreedomVow.core.test.js | Freedom vow contracts | Passing |
| RewardMultiplier.core.test.js | Reward multiplier logic | Passing |
| DAO.test.js | Governance contracts | Passing |
| VaultfireTeleporterBridge.test.js | Cross-chain Teleporter sync | Passing |

**Total: 542 Hardhat tests passing.**

**Agent Tests (TypeScript):**

| Suite | Focus | Status |
|---|---|---|
| config.test.ts | Configuration loading, multichain, demo mode | Passing |
| logger.test.ts | Structured logging | Passing |
| registry.test.ts | ERC8004 registration logic | Passing |
| monitor.test.ts | Event monitoring, RPC failover | Passing |
| bridge.test.ts | Teleporter bridge relay logic | Passing |
| self-registration.test.ts | Agent self-registration | Passing |
| bond-discovery.test.ts | Partnership bond discovery | Passing |
| metrics-reporting.test.ts | Flourishing metrics reporting | Passing |
| sentinel.test.ts | End-to-end agent loop | Passing |

**Total: 50 agent unit tests passing.**
