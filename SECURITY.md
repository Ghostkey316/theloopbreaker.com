# Vaultfire Protocol Security Model

This document outlines the current security posture, ownership model, and decentralization roadmap for the Vaultfire Protocol smart contracts deployed on Base Mainnet.

## 1. Current Ownership Model

As of February 19, 2026, the majority of critical Vaultfire Protocol contracts are owned by the `MultisigGovernance` contract at address `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` [1]. This `MultisigGovernance` contract is currently configured as a **1-of-1 multisig**, meaning a single signer (the deployer wallet `0xf6A677de83C407875C9A9115Cf100F121f9c4816`) can propose and execute transactions. This configuration, while providing a single point of control, ensures that all critical protocol operations are channeled through a single, auditable governance contract.

| Contract | Owner | Notes |
|---|---|---|
| `AIPartnershipBondsV2` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `AIAccountabilityBondsV2` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `FlourishingMetricsOracle` | `MultisigGovernance` | Single-step ownership transfer mechanism. |
| `ProductionBeliefAttestationVerifier` | `MultisigGovernance` | Single-step ownership transfer mechanism. Includes a 48-hour timelock for ZK image changes. |
| `MissionEnforcement` | `MultisigGovernance` | Two-step ownership transfer mechanism. |
| `AntiSurveillance` | `MultisigGovernance` | Single-step ownership transfer mechanism. |
| `VaultfireTeleporterBridge` | `MultisigGovernance` | Single-step ownership transfer mechanism. (Transferred on Feb 19, 2026) |

## 2. Owner Powers

The `MultisigGovernance` contract, through its current 1-of-1 configuration, holds significant control over the protocol. The powers it can exercise, as identified in a recent security audit [2], include:

*   **Yield Pool Management:** The owner can withdraw ETH from the `BaseYieldPoolBond` (inherited by `AIPartnershipBondsV2` and `AIAccountabilityBondsV2`) and adjust the `minimumYieldPoolBalance`. While checks are in place to prevent withdrawal below the minimum, the owner can set this minimum to zero, effectively draining the pool.
*   **Oracle Manipulation:** In `FlourishingMetricsOracle`, the owner can add or remove oracles, which allows for control over data submission and consensus, potentially influencing the reported 
metrics for personal gain.
*   **Protocol Halting:** Contracts inheriting from `BaseDignityBond` (e.g., `AIPartnershipBondsV2`, `AIAccountabilityBondsV2`) can be paused by the owner, effectively halting bond creation and distributions.
*   **ZK Image Changes:** In `ProductionBeliefAttestationVerifier`, the owner can propose changes to the Zero-Knowledge (ZK) image ID. Although this is subject to a 48-hour timelock, it still grants the owner the ability to alter the fundamental verification logic of the protocol.
*   **Relayer Management:** In `VaultfireTeleporterBridge`, the owner can add or remove authorized relayers and pause the bridge, which can impact cross-chain trust portability.

## 3. Decentralization Roadmap

The Vaultfire Protocol is committed to progressive decentralization. The current 1-of-1 `MultisigGovernance` is an interim step. The roadmap for decentralization includes:

1.  **Multi-Signer Expansion:** The immediate next step is to identify and onboard independent, trusted signers to the `MultisigGovernance` contract. This will involve increasing the number of signers and raising the threshold for transaction execution (e.g., to 3-of-5).
2.  **Transition to DAO Governance:** In the medium term, the goal is to transition control from the multisig to a more decentralized autonomous organization (DAO) structure. This will enable broader community participation in governance decisions.
3.  **Fully Permissionless Operation:** The long-term vision is a fully permissionless protocol where critical operations are automated by smart contracts and require no centralized control, or are governed by a robust, on-chain voting mechanism.

## 4. How Users Can Verify Ownership On-Chain

Users can verify the ownership of Vaultfire Protocol contracts on BaseScan. For any contract, navigate to its address on [BaseScan](https://basescan.org/) and check the "Contract" tab. The owner address is typically visible in the contract's read functions (e.g., `owner()` function) or in the constructor arguments if it's an immutable owner. For contracts owned by `MultisigGovernance`, users can then inspect the `MultisigGovernance` contract itself to view its current signers and threshold by calling `getSigners()` and `threshold()` functions.

## 5. Timelock on ZK Image Changes

The `ProductionBeliefAttestationVerifier` contract includes a **48-hour timelock** on changes to the ZK image ID. This means that any proposed change to the core ZK verification logic will only take effect after a 48-hour delay, providing a window for the community to review and react to potential malicious updates. This timelock can be verified by calling the `getTimelockDelay()` and `getPendingImageIdChange()` functions on the `ProductionBeliefAttestationVerifier` contract on BaseScan.

## References

[1] BaseScan: [MultisigGovernance Contract](https://basescan.org/address/0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D)
[2] VAULTFIRE_SECURITY_AUDIT_REPORT.md (attached to this task) 
