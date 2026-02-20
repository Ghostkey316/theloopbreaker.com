# Vaultfire Protocol Security Model

This document outlines the current security posture, ownership model, and decentralization roadmap for the Vaultfire Protocol smart contracts deployed on **Base Mainnet** and **Avalanche C-Chain**.

## 1. Current Ownership Model

As of February 20, 2026, the Vaultfire Protocol is deployed across two chains. On each chain, critical contracts are owned by a `MultisigGovernance` contract configured as a **1-of-1 multisig**. This configuration, while providing a single point of control, ensures that all critical protocol operations are channeled through a single, auditable governance contract.

### Base Mainnet (Canonical — Chain ID 8453)

Contract addresses will be populated after deployment. The deployer wallet `0x5F804B9bF07fF23Fe50B317d6936a4c5DEF8F324` is the initial owner of all contracts prior to ownership transfer to `MultisigGovernance`.

| Contract | Owner | Notes |
|---|---|---|
| `PrivacyGuarantees` | Deployer (no owner function) | Stateless privacy guarantees module. |
| `MissionEnforcement` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `AntiSurveillance` | `MultisigGovernance` | Single-step ownership transfer mechanism. |
| `ERC8004IdentityRegistry` | Deployer (inherits PrivacyGuarantees + MissionEnforcement) | Identity registration module. |
| `BeliefAttestationVerifier` | N/A | Development-mode verifier. No owner function. |
| `AIPartnershipBondsV2` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `FlourishingMetricsOracle` | `MultisigGovernance` | Single-step ownership transfer mechanism. |
| `AIAccountabilityBondsV2` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `ERC8004ReputationRegistry` | Deployer | Depends on ERC8004IdentityRegistry. |
| `ERC8004ValidationRegistry` | Deployer | Depends on ERC8004IdentityRegistry + BeliefAttestationVerifier. |
| `VaultfireERC8004Adapter` | Deployer | Adapter connecting ERC-8004 registries. |
| `MultisigGovernance` | Self-governing | 1-of-1 multisig (deployer wallet). |
| `ProductionBeliefAttestationVerifier` | `MultisigGovernance` | 48-hour timelock for ZK image changes. |
| `VaultfireTeleporterBridge` | `MultisigGovernance` | Cross-chain bridge to Avalanche. |

### Avalanche C-Chain (Secondary — Chain ID 43114)

| Contract | Address | Notes |
|---|---|---|
| `PrivacyGuarantees` | `0x7Fc0fb687f86DdF5b026a24F2DC77852358712F1` | |
| `MissionEnforcement` | `0xfC479CBC997Ab605d506e5326E5063b0821202C6` | |
| `AntiSurveillance` | `0xeF72b60DB38D41c6752ebf093C15A2AFA718ecE1` | |
| `ERC8004IdentityRegistry` | `0x5dcD3022fBa187346b9cA9f4fFAF6C42f9839e13` | |
| `BeliefAttestationVerifier` | `0xF9dBC97997136cA7C9Ab02E03579D8a33CD02617` | |
| `AIPartnershipBondsV2` | `0x3d10A72490aDc57F1718a5917E101AD7562950C9` | |
| `FlourishingMetricsOracle` | `0xCe6D8BBd45B03C88C273f0bE79955d3c3E8F35c6` | |
| `AIAccountabilityBondsV2` | `0x2100872b5d1880eC03dcea79e16FDE00f9df656a` | |
| `ERC8004ReputationRegistry` | `0xe8EBf0a9Cd9f87F2e2f4CBd2e47b26BB61BbAb57` | |
| `ERC8004ValidationRegistry` | `0x6f3D378E7751233A344F1BFAc4d37ED621D5F7A5` | |
| `VaultfireERC8004Adapter` | `0xC9CF6df488AFE919a58482d9d18305E2DfF29470` | |
| `MultisigGovernance` | `0x4D6249BE0293fC148e6341BbD49E4B41785C49e4` | |
| `ProductionBeliefAttestationVerifier` | `0xd83503756878e6C0A5f806f9Cd35E6cA590622c5` | |
| `VaultfireTeleporterBridge` | *Pending deployment* | Deploy with `deploy-avalanche-missing.js` |

## 2. Owner Powers

The `MultisigGovernance` contract, through its current 1-of-1 configuration, holds significant control over the protocol. The powers it can exercise, as identified in a recent security audit [2], include:

*   **Yield Pool Management:** The owner can withdraw ETH from the `BaseYieldPoolBond` (inherited by `AIPartnershipBondsV2` and `AIAccountabilityBondsV2`) and adjust the `minimumYieldPoolBalance`. While checks are in place to prevent withdrawal below the minimum, the owner can set this minimum to zero, effectively draining the pool.
*   **Oracle Manipulation:** In `FlourishingMetricsOracle`, the owner can add or remove oracles, which allows for control over data submission and consensus, potentially influencing the reported metrics for personal gain.
*   **Protocol Halting:** Contracts inheriting from `BaseDignityBond` (e.g., `AIPartnershipBondsV2`, `AIAccountabilityBondsV2`) can be paused by the owner, effectively halting bond creation and distributions.
*   **ZK Image Changes:** In `ProductionBeliefAttestationVerifier`, the owner can propose changes to the Zero-Knowledge (ZK) image ID. Although this is subject to a 48-hour timelock, it still grants the owner the ability to alter the fundamental verification logic of the protocol.
*   **Relayer Management:** In `VaultfireTeleporterBridge`, the owner can add or remove authorized relayers and pause the bridge, which can impact cross-chain trust portability.

## 3. API Security

### Rate Limiting

The Ember chat API endpoints implement rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|---|---|---|
| `ember.sendMessage` | 20 requests | per minute per user |
| `ember.quickSend` | 10 requests | per minute per IP |

Rate limiting is enforced server-side using an in-memory sliding window counter. Exceeding the limit returns a `429 Too Many Requests` error.

### Authentication

All Ember chat endpoints (except `quickSend`) require authentication via session cookies. The `protectedProcedure` middleware validates the session before processing any request.

## 4. Decentralization Roadmap

The Vaultfire Protocol is committed to progressive decentralization. The current 1-of-1 `MultisigGovernance` is an interim step. The roadmap for decentralization includes:

1.  **Multi-Signer Expansion:** The immediate next step is to identify and onboard independent, trusted signers to the `MultisigGovernance` contract. This will involve increasing the number of signers and raising the threshold for transaction execution (e.g., to 3-of-5).
2.  **Transition to DAO Governance:** In the medium term, the goal is to transition control from the multisig to a more decentralized autonomous organization (DAO) structure. This will enable broader community participation in governance decisions.
3.  **Fully Permissionless Operation:** The long-term vision is a fully permissionless protocol where critical operations are automated by smart contracts and require no centralized control, or are governed by a robust, on-chain voting mechanism.

## 5. How Users Can Verify Ownership On-Chain

Users can verify the ownership of Vaultfire Protocol contracts on [BaseScan](https://basescan.org/) (Base) or [Snowtrace](https://snowtrace.io/) (Avalanche). For any contract, navigate to its address and check the "Contract" tab. The owner address is typically visible in the contract's read functions (e.g., `owner()` function). For contracts owned by `MultisigGovernance`, users can inspect the `MultisigGovernance` contract itself to view its current signers and threshold by calling `getSigners()` and `threshold()` functions.

## 6. Timelock on ZK Image Changes

The `ProductionBeliefAttestationVerifier` contract includes a **48-hour timelock** on changes to the ZK image ID. This means that any proposed change to the core ZK verification logic will only take effect after a 48-hour delay, providing a window for the community to review and react to potential malicious updates. This timelock can be verified by calling the `getTimelockDelay()` and `getPendingImageIdChange()` functions on the contract.

## 7. Cross-Chain Security

The `VaultfireTeleporterBridge` enables trust portability between Base and Avalanche. Security measures include:

*   **Authorized Relayers:** Only whitelisted relayer addresses can submit cross-chain messages.
*   **Gas Limit Enforcement:** A minimum gas limit is enforced for cross-chain message execution.
*   **Owner-controlled Pause:** The bridge can be paused by the owner (MultisigGovernance) in case of emergency.

## References

[1] BaseScan: [MultisigGovernance Contract](https://basescan.org/)
[2] VAULTFIRE_SECURITY_AUDIT_REPORT.md (attached to this repository)
