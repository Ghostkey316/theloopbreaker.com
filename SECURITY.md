# Vaultfire Protocol Security Model

This document outlines the current security posture, ownership model, and decentralization roadmap for the Vaultfire Protocol smart contracts deployed on **Base Mainnet** and **Avalanche C-Chain**.

## 1. Current Ownership Model

As of February 20, 2026, the Vaultfire Protocol is deployed across two chains. On each chain, critical contracts are owned by a `MultisigGovernance` contract configured as a **1-of-1 multisig**. This configuration, while providing a single point of control, ensures that all critical protocol operations are channeled through a single, auditable governance contract.

### Base Mainnet (Canonical — Chain ID 8453)

Contract addresses will be populated after deployment. The deployer wallet `0xA054f831B562e729F8D268291EBde1B2EDcFb84F` is the initial owner of all contracts prior to ownership transfer to `MultisigGovernance`.

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
| `PrivacyGuarantees` | `0xc09F0e06690332eD9b490E1040BdE642f11F3937` | |
| `MissionEnforcement` | `0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB` | |
| `AntiSurveillance` | `0x281814eF92062DA8049Fe5c4743c4Aef19a17380` | |
| `ERC8004IdentityRegistry` | `0x57741F4116925341d8f7Eb3F381d98e07C73B4a3` | |
| `BeliefAttestationVerifier` | `0x227e27e7776d3ee14128BC66216354495E113B19` | |
| `AIPartnershipBondsV2` | `0xea6B504827a746d781f867441364C7A732AA4b07` | |
| `FlourishingMetricsOracle` | `0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695` | |
| `AIAccountabilityBondsV2` | `0xaeFEa985E0C52f92F73606657B9dA60db2798af3` | |
| `ERC8004ReputationRegistry` | `0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24` | |
| `ERC8004ValidationRegistry` | `0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b` | |
| `VaultfireERC8004Adapter` | `0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053` | |
| `MultisigGovernance` | `0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee` | |
| `ProductionBeliefAttestationVerifier` | `0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F` | |
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

The Embris chat API endpoints implement rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|---|---|---|
| `embris.sendMessage` | 20 requests | per minute per user |
| `embris.quickSend` | 10 requests | per minute per IP |

Rate limiting is enforced server-side using an in-memory sliding window counter. Exceeding the limit returns a `429 Too Many Requests` error.

### Authentication

All Embris chat endpoints (except `quickSend`) require authentication via session cookies. The `protectedProcedure` middleware validates the session before processing any request.

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

The `VaultfireTeleporterBridge` enables trust portability between Ethereum, Base, and Avalanche. Security measures include:

*   **Authorized Relayers:** Only whitelisted relayer addresses can submit cross-chain messages.
*   **Gas Limit Enforcement:** A minimum gas limit is enforced for cross-chain message execution.
*   **Owner-controlled Pause:** The bridge can be paused by the owner (MultisigGovernance) in case of emergency.

## References

[1] BaseScan: [MultisigGovernance Contract](https://basescan.org/)
[2] VAULTFIRE_SECURITY_AUDIT_REPORT.md (attached to this repository)
