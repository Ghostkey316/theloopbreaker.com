# Vaultfire Protocol: Post-Merge Checklist for Security Enhancements (PR #713)

**Date:** 2026-02-16
**Author:** Manus AI

## 1. Introduction

This document provides a comprehensive checklist and report for the deployment and integration of the three new security enhancement contracts introduced in PR #713. These contracts were recommended as part of the 2026 professional security audit to decentralize critical protocol functions and enhance resilience against oracle manipulation and malicious upgrades. The successful deployment and configuration of these contracts are critical for the continued security and integrity of the Vaultfire protocol.

This report covers the deployment scripts, step-by-step instructions, ownership transfers, and post-deployment configuration required to fully integrate these enhancements into the Base mainnet environment.

## 2. New Security Contract Overview

The three new contracts address key areas of centralization and security risk identified in the audit. The following table summarizes their purpose and constructor parameters.

| Contract | Purpose | Constructor Parameters |
|---|---|---|
| **MultisigGovernance.sol** | Replaces single-owner control with an M-of-N multisig for critical protocol operations. All major changes will require multiple signers to approve, significantly reducing the risk of a single point of failure or compromise. | `(address[] memory _signers, uint256 _threshold)` |
| **FlourishingMetricsOracle.sol** | Establishes a multi-oracle consensus mechanism for reporting flourishing metrics. It requires a quorum of independent oracles and uses median aggregation to determine the consensus value, making the system resistant to single-oracle manipulation or failure. | `()` |
| **ProductionBeliefAttestationVerifier.sol** | Implements a 48-hour timelock for any updates to the RISC Zero guest program's `imageId`. This delay provides a crucial window for the community and stakeholders to review and react to proposed changes, preventing malicious or rushed upgrades. | `(address _riscZeroVerifier, bytes32 _imageId)` |

## 3. Deployment Instructions

The deployment must be executed in a specific order to ensure that contract dependencies are met and ownership can be correctly configured. The deployer wallet must be funded with sufficient ETH for gas on the target network (Base Mainnet or Base Sepolia).

### Step 1: Configure Environment

Before running the deployment scripts, create a `.env` file in the root of the project with the following variables. The `PRIVATE_KEY` is for the deployer wallet.

```
# .env
PRIVATE_KEY="0x..."
BASESCAN_API_KEY="..."

# For MultisigGovernance deployment
MULTISIG_SIGNERS="0xSigner1Address,0xSigner2Address,0xSigner3Address"
MULTISIG_THRESHOLD=2

# For ProductionBeliefAttestationVerifier deployment
RISC_ZERO_VERIFIER_BASE="0x0b144e07a0826182b6b59788c34b32bfa86fb711"
BELIEF_CIRCUIT_IMAGE_ID="0x..." # Get this from the RISC Zero build output

# (Optional) For FlourishingMetricsOracle initial configuration
ORACLE_ADDRESSES="0xOracle1Address,0xOracle2Address,0xOracle3Address"
```

### Step 2: Deploy the Contracts

Run the newly created deployment scripts from the `scripts/` directory. It is recommended to deploy the `MultisigGovernance` contract first, as its address will be needed for subsequent ownership transfers.

1.  **Deploy MultisigGovernance:**
    ```bash
    npx hardhat run scripts/deploy-multisig-governance.js --network base
    ```
    Take note of the deployed `MultisigGovernance` address from the output. This will be the new owner for most protocol contracts.

2.  **Deploy FlourishingMetricsOracle:**
    ```bash
    npx hardhat run scripts/deploy-flourishing-oracle.js --network base
    ```

3.  **Deploy ProductionBeliefAttestationVerifier:**
    ```bash
    npx hardhat run scripts/deploy-production-belief-verifier.js --network base
    ```

After each deployment, the script will attempt to verify the contract on Basescan and will save a JSON file with the deployment details in the `deployments/` directory.

## 4. Ownership Transfers

After the `MultisigGovernance` contract is deployed, ownership of all critical protocol contracts must be transferred to it. This action centralizes control under the multisig, which is the primary goal of this security enhancement.

The following table details the contracts that require ownership transfer and the mechanism for doing so.

| Contract to Secure | Address | Ownership Transfer Type | Action Required |
|---|---|---|---|
| **ProductionBeliefAttestationVerifier** | (New) | One-Step | `transferOwnership(multisigAddress)` |
| **FlourishingMetricsOracle** | (New) | One-Step | `transferOwnership(multisigAddress)` |
| **MissionEnforcement** | `0x6EC0440e1601558024f285903F0F4577B109B609` | Two-Step | 1. `transferOwnership(multisigAddress)`<br>2. Multisig must execute `acceptOwnership()` |
| **AntiSurveillance** | `0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac` | One-Step | `transferOwnership(multisigAddress)` |
| **AIPartnershipBondsV2** | `0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` | Two-Step | 1. `transferOwnership(multisigAddress)`<br>2. Multisig must execute `acceptOwnership()` |
| **AIAccountabilityBondsV2** | `0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` | Two-Step | 1. `transferOwnership(multisigAddress)`<br>2. Multisig must execute `acceptOwnership()` |

> **Note:** Contracts using the two-step `Ownable` pattern (`transferOwnership` followed by `acceptOwnership`) require an additional transaction to be executed by the `MultisigGovernance` contract to claim ownership. This is a security feature to prevent accidental loss of ownership.

## 5. Post-Deployment Configuration

### FlourishingMetricsOracle

Once deployed and owned by the multisig, the oracle must be configured.

1.  **Add Oracles:** The multisig must propose and execute transactions to add trusted oracle addresses. A minimum of 3 oracles are required to reach a quorum.
    ```javascript
    // Example calldata for a multisig proposal
    const flourishingOracle = await ethers.getContractAt("FlourishingMetricsOracle", oracleAddress);
    const calldata = flourishingOracle.interface.encodeFunctionData("addOracle", ["0xOracleAddressToAdd"]);
    // Propose this calldata to the MultisigGovernance contract.
    ```

2.  **Start a Round:** Once a sufficient number of oracles are registered, the multisig can start a consensus round for a specific metric.
    ```javascript
    // Example calldata for a multisig proposal
    const metricId = ethers.keccak256(ethers.toUtf8Bytes("human_flourishing_index"));
    const calldata = flourishingOracle.interface.encodeFunctionData("startRound", [metricId]);
    ```

### ProductionBeliefAttestationVerifier Timelock

The `imageId` of the guest program can only be updated via a 48-hour timelock. This process is initiated and executed through the `MultisigGovernance` contract.

1.  **Propose Image ID Change:** The multisig proposes a new `imageId`.
    ```javascript
    // Example calldata for a multisig proposal
    const newImageId = "0x..."; // The new image ID
    const verifier = await ethers.getContractAt("ProductionBeliefAttestationVerifier", verifierAddress);
    const calldata = verifier.interface.encodeFunctionData("proposeImageIdChange", [newImageId]);
    ```

2.  **Wait 48 Hours:** The timelock period must fully elapse before the change can be executed.

3.  **Execute Image ID Change:** After the delay, the multisig executes the change.
    ```javascript
    // Example calldata for a multisig proposal
    const calldata = verifier.interface.encodeFunctionData("executeImageIdChange");
    ```

## 6. Integration and Redeployment Considerations

-   **Integration:** The new `MultisigGovernance` contract becomes the central point of authority. All administrative functions on existing and new contracts that were previously managed by a single EOA will now be executed via proposals on this multisig.
-   **Redeployment:** If any of these three contracts need to be redeployed, the ownership of dependent contracts must be carefully re-assigned. For instance, if `MultisigGovernance` is redeployed, all owned contracts must have their ownership transferred to the new multisig address. This process will require a series of transactions signed by the old multisig.
-   **CI/CD:** The CI pipeline includes checks (`lint:privileged-surface`) that automatically verify the privileged function landscape. After this merge, these checks will need to be updated to reflect the new ownership patterns and ensure that no new `onlyOwner` functions are added without explicit approval.
