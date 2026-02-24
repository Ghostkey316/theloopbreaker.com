# Vaultfire Protocol: Multichain Deployment Guide

This document outlines the architecture and procedures for deploying the Vaultfire Protocol to multiple blockchains. It covers the roles of different chains, deployment scripts, and contract verification.

## Multichain Architecture

The Vaultfire Protocol is designed with a primary/secondary chain architecture to ensure a canonical source of truth while allowing for expansion to other ecosystems.

### Primary Chain: Base Mainnet

**Base mainnet (Chain ID 8453) is the canonical and primary deployment of the Vaultfire Protocol.** All core governance, primary treasury functions, and the authoritative version of the protocol's state reside on Base. This provides a single, stable foundation for the entire ecosystem.

### Secondary Chain: Avalanche C-Chain

**Avalanche C-Chain (Chain ID 43114) is a supported secondary chain.** This deployment was established to participate in the Avalanche Build Games program and expand the protocol's reach. While it mirrors the full functionality of the Base deployment, it is considered a secondary instance. In the future, cross-chain communication mechanisms may be implemented to link the state between Ethereum, Base, and Avalanche.

### Key Architectural Decisions

- **Canonical Truth on Base:** All contracts are deployed to both chains, but the Base deployment is the ultimate source of truth.
- **Independent Deployments:** Each chain has a full, independent deployment of all 13 core protocol contracts.
- **Configuration-driven Deployment:** A master deployment script (`scripts/deploy-multichain.js`) handles deployments to any supported network, reading network-specific parameters from `hardhat.config.js`.
- **EVM Compatibility:** The protocol leverages the Cancun EVM version, which is supported on both Ethereum, Base, and Avalanche (since the Etna/Avalanche9000 upgrade, activated December 16, 2024) [1]. This allows for a unified Solidity codebase (`v0.8.25`) without requiring different EVM versions per chain.
- **Agent Chain Switching:** The Vaultfire Sentinel agent is designed to be chain-aware. It determines the target chain via the `VAULTFIRE_CHAIN` environment variable, defaulting to `base` if unset.

## Deployment Procedure

The `scripts/deploy-multichain.js` script is the master script for deploying the entire protocol to any supported chain.

### Prerequisites

1.  **Install Dependencies:** Ensure all project dependencies are installed by running `npm install` in the root directory.
2.  **Environment Variables:** Set the `PRIVATE_KEY` environment variable to the private key of the deployer wallet (`0xA054f831B562e729F8D268291EBde1B2EDcFb84F`).

    ```bash
    export PRIVATE_KEY="0x..."
    ```

### Deploying to Avalanche C-Chain Mainnet

To deploy the full protocol to the Avalanche C-Chain, use the `avalanche` Hardhat network.

```bash
npx hardhat run scripts/deploy-multichain.js --network avalanche
```

The script will perform the following steps:
1.  Verify the network and deployer wallet balance.
2.  Deploy all 13 contracts in the correct dependency order.
3.  Save a deployment manifest to the `deployments/` directory, containing the addresses of all newly deployed contracts.

### Deploying to Fuji Testnet (for Development)

For development and testing, you can deploy to the Avalanche Fuji testnet using the `avalancheFuji` network.

```bash
npx hardhat run scripts/deploy-multichain.js --network avalancheFuji
```

This process is identical to the mainnet deployment but targets the Fuji testnet endpoints.

## Contract Verification on Snowtrace

After deployment, the contract source code should be verified on the appropriate block explorer. For Avalanche, this is [Snowtrace](https://snowtrace.io/).

The `hardhat.config.js` is pre-configured to handle verification via the Routescan API, which powers the Snowtrace explorer. An API key is not required; a placeholder value is used.

### Verification Commands

Use the `npx hardhat verify` command with the appropriate network flag and the contract address from the deployment manifest. Constructor arguments must be provided if the contract has them.

**Example: Verifying a contract with no constructor arguments (e.g., `PrivacyGuarantees`) on Fuji:**

```bash
npx hardhat verify --network avalancheFuji <PrivacyGuarantees_ADDRESS>
```

**Example: Verifying a contract with constructor arguments (e.g., `ERC8004ReputationRegistry`) on Fuji:**

```bash
npx hardhat verify --network avalancheFuji <ReputationRegistry_ADDRESS> <IdentityRegistry_ADDRESS>
```

The `deploy-avalanche.js` script (a chain-specific version of the master script) prints the exact verification commands for all 13 contracts at the end of a successful deployment, which can be copied and executed.

---

### References

[1] Avalanche Builder Hub. *ACP-131: Cancun Eips*. Accessed Feb 17, 2026. [https://build.avax.network/docs/acps/131-cancun-eips](https://build.avax.network/docs/acps/131-cancun-eips)
