# Vaultfire Protocol — Avalanche Build Games Submission

## Project Overview

Vaultfire is on-chain trust infrastructure for AI agents. It provides a complete, verifiable trust layer that enables humans and AI agents to form accountable partnerships backed by economic stakes, cryptographic identity, and portable reputation. The protocol answers the fundamental question of the AI age: how do you trust an autonomous agent?

The core innovation is a dual-bond architecture. Partnership Bonds lock value between a human and an AI agent, enforcing a distribution model where the AI cannot profit unless the human thrives (AI profit capped at 30%). Accountability Bonds require AI companies to stake capital proportional to their revenue, creating a direct economic cost for misalignment. Together, these bonds form a trust loop: register identity, stake accountability, partner with humans, earn reputation.

Vaultfire is not a prototype. It is a fully deployed, audited, production-grade protocol with 13 verified smart contracts on Base mainnet, an autonomous Sentinel Agent, a live dashboard, and a professional audit. The entire protocol was designed, built, tested, and deployed by a single architect for under $0.20 in total deployment costs.

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
```

## Deployed Contracts — Base Mainnet (Primary)

All 13 contracts are deployed and verified on Base mainnet (Chain ID 8453).

| # | Contract | Address |
|---|---|---|
| 1 | PrivacyGuarantees | [0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e](https://basescan.org/address/0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e) |
| 2 | MissionEnforcement | [0x6EC0440e1601558024f285903F0F4577B109B609](https://basescan.org/address/0x6EC0440e1601558024f285903F0F4577B109B609) |
| 3 | AntiSurveillance | [0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac](https://basescan.org/address/0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac) |
| 4 | ERC8004IdentityRegistry | [0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD](https://basescan.org/address/0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD) |
| 5 | BeliefAttestationVerifier | [0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a](https://basescan.org/address/0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a) |
| 6 | ERC8004ReputationRegistry | [0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C](https://basescan.org/address/0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C) |
| 7 | ERC8004ValidationRegistry | [0x50E4609991691D5104016c4a2F6D2875234d4B06](https://basescan.org/address/0x50E4609991691D5104016c4a2F6D2875234d4B06) |
| 8 | AIPartnershipBondsV2 | [0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855](https://basescan.org/address/0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855) |
| 9 | AIAccountabilityBondsV2 | [0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140](https://basescan.org/address/0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140) |
| 10 | VaultfireERC8004Adapter | [0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361](https://basescan.org/address/0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361) |
| 11 | MultisigGovernance | [0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D](https://basescan.org/address/0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D) |
| 12 | FlourishingMetricsOracle | [0xb751abb1158908114662b254567b8135C460932C](https://basescan.org/address/0xb751abb1158908114662b254567b8135C460932C) |
| 13 | ProductionBeliefAttestationVerifier | [0xBDB5d85B3a84C773113779be89A166Ed515A7fE2](https://basescan.org/address/0xBDB5d85B3a84C773113779be89A166Ed515A7fE2) |

## Deployed Contracts — Avalanche C-Chain Mainnet (Secondary)

All 13 contracts are deployed and verified on Avalanche C-Chain (Chain ID 43114).

| # | Contract | Address |
|---|---|---|
| 1 | PrivacyGuarantees | [0x7Fc0fb687f86DdF5b026a24F2DC77852358712F1](https://snowtrace.io/address/0x7Fc0fb687f86DdF5b026a24F2DC77852358712F1) |
| 2 | MissionEnforcement | [0xfC479CBC997Ab605d506e5326E5063b0821202C6](https://snowtrace.io/address/0xfC479CBC997Ab605d506e5326E5063b0821202C6) |
| 3 | AntiSurveillance | [0xeF72b60DB38D41c6752ebf093C15A2AFA718ecE1](https://snowtrace.io/address/0xeF72b60DB38D41c6752ebf093C15A2AFA718ecE1) |
| 4 | ERC8004IdentityRegistry | [0x5dcD3022fBa187346b9cA9f4fFAF6C42f9839e13](https://snowtrace.io/address/0x5dcD3022fBa187346b9cA9f4fFAF6C42f9839e13) |
| 5 | BeliefAttestationVerifier | [0xF9dBC97997136cA7C9Ab02E03579D8a33CD02617](https://snowtrace.io/address/0xF9dBC97997136cA7C9Ab02E03579D8a33CD02617) |
| 6 | AIPartnershipBondsV2 | [0x3d10A72490aDc57F1718a5917E101AD7562950C9](https://snowtrace.io/address/0x3d10A72490aDc57F1718a5917E101AD7562950C9) |
| 7 | FlourishingMetricsOracle | [0xCe6D8BBd45B03C88C273f0bE79955d3c3E8F35c6](https://snowtrace.io/address/0xCe6D8BBd45B03C88C273f0bE79955d3c3E8F35c6) |
| 8 | ERC8004ReputationRegistry | [0xe8EBf0a9Cd9f87F2e2f4CBd2e47b26BB61BbAb57](https://snowtrace.io/address/0xe8EBf0a9Cd9f87F2e2f4CBd2e47b26BB61BbAb57) |
| 9 | ERC8004ValidationRegistry | [0x6f3D378E7751233A344F1BFAc4d37ED621D5F7A5](https://snowtrace.io/address/0x6f3D378E7751233A344F1BFAc4d37ED621D5F7A5) |
| 10 | AIAccountabilityBondsV2 | [0x2100872b5d1880eC03dcea79e16FDE00f9df656a](https://snowtrace.io/address/0x2100872b5d1880eC03dcea79e16FDE00f9df656a) |
| 11 | VaultfireERC8004Adapter | [0xC9CF6df488AFE919a58482d9d18305E2DfF29470](https://snowtrace.io/address/0xC9CF6df488AFE919a58482d9d18305E2DfF29470) |
| 12 | MultisigGovernance | [0x4D6249BE0293fC148e6341BbD49E4B41785C49e4](https://snowtrace.io/address/0x4D6249BE0293fC148e6341BbD49E4B41785C49e4) |
| 13 | ProductionBeliefAttestationVerifier | [0xd83503756878e6C0A5f806f9Cd35E6cA590622c5](https://snowtrace.io/address/0xd83503756878e6C0A5f806f9Cd35E6cA590622c5) |

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
| Deployer Wallet | [0xf6A677de83C407875C9A9115Cf100F121f9c4816](https://basescan.org/address/0xf6A677de83C407875C9A9115Cf100F121f9c4816) |

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

**Total: 458 Hardhat tests passing.**

**Agent Tests (TypeScript):**

| Suite | Focus | Status |
|---|---|---|
| config.test.ts | Configuration loading, multichain, demo mode | Passing |
| logger.test.ts | Structured logging | Passing |
| registry.test.ts | ERC8004 registration logic | Passing |
| bonds.test.ts (via tasks) | Bond discovery and management | Passing |
| metrics.test.ts | Oracle metrics reporting | Passing |
| retry.test.ts | Retry logic with backoff | Passing |
| wallet.test.ts | Wallet initialization | Passing |
| tasks.test.ts | Task cycle execution | Passing |

## Audit Summary

A professional audit was completed on February 1, 2026. Key findings:

- Core test suite passes (346 Hardhat tests, all agent tests).
- All CI guardrails pass (values guardrails, privileged surface, events surface, external calls, storage growth).
- No high-severity vulnerabilities found in smart contracts.
- Slither static analysis configured and integrated into CI.
- CI enforces values alignment: no surveillance patterns, no gatekeeping identifiers permitted in Solidity source.

The full audit report is available at `docs/AUDIT_REPORT_2026-02-01.md`.

## What Makes Vaultfire Unique

**Compared to existing approaches:**

| Feature | Vaultfire | Typical AI Trust | Traditional DeFi |
|---|---|---|---|
| AI agent identity | ERC-8004 on-chain standard | Self-certified | N/A |
| Economic accountability | Dual-bond system with stakes | None | Single-sided staking |
| AI profit cap | 30% max (human must thrive) | Uncapped | N/A |
| Reputation portability | On-chain, cross-platform | Siloed per platform | N/A |
| ZK proof integration | RISC Zero STARK attestations | None | Limited |
| Governance | On-chain multisig | Centralized | Token voting |
| Values enforcement | CI guardrails (no surveillance) | None | None |
| Multi-oracle consensus | FlourishingMetricsOracle | Single oracle | Chainlink-dependent |
| Multichain | Base + Avalanche | Single chain | Single chain |
| Deployment cost | Under $0.20 total | Thousands | Thousands |

**Key differentiators:**

1. **First dual-bond system for AI accountability.** No other protocol combines partnership bonds (human-AI economic alignment) with accountability bonds (company-level stakes). This creates layered economic incentives for AI alignment.

2. **ERC-8004 identity standard.** Vaultfire implements a formal identity standard for AI agents, making them discoverable, verifiable, and accountable on-chain.

3. **Values-enforced development.** CI guardrails prevent surveillance patterns and gatekeeping identifiers from entering the codebase. This is not just a policy — it is automated enforcement.

4. **Autonomous agent as proof of concept.** The Vaultfire Sentinel Agent is a living demonstration of the protocol. It self-registers, forms bonds, monitors health, and reports metrics autonomously.

5. **Production-grade from day one.** Professional audit, 346 tests, multi-oracle consensus, multisig governance, ZK proof integration. This is infrastructure built to last, not a hackathon demo.
