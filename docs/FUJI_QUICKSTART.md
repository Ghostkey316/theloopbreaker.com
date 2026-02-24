# Fuji Testnet Quickstart

This guide walks through deploying the full Vaultfire Protocol (all 13 contracts) to the Avalanche Fuji testnet. Fuji is used for the Avalanche Build Games program. Base mainnet remains the primary, canonical deployment.

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | v18 or later |
| npm | v9 or later |
| Wallet | Private key for the deployer wallet |
| Fuji AVAX | At least 1 AVAX (faucet provides 2) |

## Step 1: Get Fuji Testnet AVAX

Visit the official Avalanche faucet and request testnet AVAX for your deployer wallet:

> **Faucet URL:** [https://core.app/tools/testnet-faucet/](https://core.app/tools/testnet-faucet/)

Enter your wallet address (`0xA054f831B562e729F8D268291EBde1B2EDcFb84F`) and request AVAX. The faucet typically dispenses 2 AVAX, which is more than enough for a full deployment. If the faucet requires a coupon code, check the Avalanche Discord for community-shared codes.

You can verify your balance on the Fuji explorer:

```
https://testnet.snowtrace.io/address/0xA054f831B562e729F8D268291EBde1B2EDcFb84F
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the project root directory (or export the variables in your shell):

```bash
# Required — deployer wallet private key (with 0x prefix)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Optional — Snowtrace / Routescan API key for contract verification
SNOWTRACE_API_KEY=your_api_key_here
```

Alternatively, export directly:

```bash
export PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"
```

**Important:** Never commit your `.env` file or share your private key. The `.gitignore` already excludes `.env` files.

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Compile Contracts

```bash
npx hardhat compile
```

Ensure compilation succeeds with zero errors. The project uses Solidity 0.8.25 with `viaIR` enabled and the Cancun EVM version, which Avalanche supports since the Etna/Avalanche9000 upgrade (December 2024).

## Step 5: Run the Deployment

```bash
npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji
```

The script performs the following automatically:

1. **Pre-flight checks** — verifies the network is Fuji (Chain ID 43113), confirms the deployer address, and checks that the wallet has sufficient AVAX (minimum 0.5 AVAX).
2. **Phase 1 deployment** — deploys the 7 independent contracts that have no constructor dependencies.
3. **Phase 2 deployment** — deploys the 6 dependent contracts, passing the Phase 1 addresses as constructor arguments.
4. **Saves the deployment manifest** to `deployments/fuji-deployment.json`.
5. **Prints verification commands** for every contract.

### Deployment Order

The 13 contracts are deployed in strict dependency order:

| Phase | Contract | Constructor Arguments |
|---|---|---|
| 1 | PrivacyGuarantees | (none) |
| 1 | MissionEnforcement | (none) |
| 1 | AntiSurveillance | (none) |
| 1 | ERC8004IdentityRegistry | (none) |
| 1 | BeliefAttestationVerifier | (none) |
| 1 | AIPartnershipBondsV2 | (none) |
| 1 | FlourishingMetricsOracle | (none) |
| 2 | ERC8004ReputationRegistry | identityRegistry |
| 2 | ERC8004ValidationRegistry | identityRegistry, beliefVerifier |
| 2 | AIAccountabilityBondsV2 | humanTreasury |
| 2 | VaultfireERC8004Adapter | partnershipBonds, identity, reputation, validation |
| 2 | MultisigGovernance | [signers], threshold |
| 2 | ProductionBeliefAttestationVerifier | riscZeroVerifier, imageId |

## Step 6: Verify Contracts on Snowtrace

After deployment, the script prints verification commands. Run each one:

```bash
# Example for a no-arg contract
npx hardhat verify --network avalancheFuji 0xDEPLOYED_ADDRESS

# Example for a contract with constructor args
npx hardhat verify --network avalancheFuji 0xDEPLOYED_ADDRESS "0xCONSTRUCTOR_ARG_1"
```

Verification makes the source code readable on Snowtrace and builds trust with judges and users.

## Step 7: Run the Demo

After deployment, run the interactive demo to showcase the full Vaultfire trust loop:

```bash
npx hardhat run scripts/demo-vaultfire.js --network avalancheFuji
```

The demo registers an AI agent, creates a partnership bond, submits feedback, and checks reputation scores. See the demo script documentation for details.

## Expected Output

A successful deployment produces output similar to:

```
================================================================================
  PRE-FLIGHT CHECKS
================================================================================

  [OK] Network : avalancheFuji (Chain ID 43113)
  [OK] Deployer: 0xA054f831B562e729F8D268291EBde1B2EDcFb84F
  [OK] Balance : 2.0 AVAX

  All pre-flight checks passed.

================================================================================
  VAULTFIRE PROTOCOL — FUJI TESTNET DEPLOYMENT
  Deploying all 13 core contracts
  Base mainnet remains the PRIMARY / CANONICAL deployment.
================================================================================

------------------------------------------------------------
  Phase 1: Independent contracts (7 contracts)
------------------------------------------------------------

  [OK] PrivacyGuarantees
       Address : 0x...
       TX      : 0x...

  ... (12 more contracts) ...

================================================================================
  DEPLOYMENT COMPLETE — Avalanche Fuji Testnet
================================================================================

  Time: ~3.50 minutes
  Manifest saved: deployments/fuji-deployment.json

  ... (contract addresses and Snowtrace links) ...

================================================================================
  CONTRACT VERIFICATION (Snowtrace / Routescan)
================================================================================

  ... (verification commands for all 13 contracts) ...
```

## Deployment Manifest

The deployment saves a JSON manifest at `deployments/fuji-deployment.json`:

```json
{
  "protocol": "Vaultfire",
  "chain": "avalancheFuji",
  "chainId": 43113,
  "canonical": false,
  "deployer": "0xA054f831B562e729F8D268291EBde1B2EDcFb84F",
  "timestamp": "2026-02-20T...",
  "deploymentTimeMinutes": "3.50",
  "contracts": {
    "PrivacyGuarantees": "0x...",
    "MissionEnforcement": "0x...",
    "AntiSurveillance": "0x...",
    "ERC8004IdentityRegistry": "0x...",
    "BeliefAttestationVerifier": "0x...",
    "AIPartnershipBondsV2": "0x...",
    "FlourishingMetricsOracle": "0x...",
    "ERC8004ReputationRegistry": "0x...",
    "ERC8004ValidationRegistry": "0x...",
    "AIAccountabilityBondsV2": "0x...",
    "VaultfireERC8004Adapter": "0x...",
    "MultisigGovernance": "0x...",
    "ProductionBeliefAttestationVerifier": "0x..."
  }
}
```

## Troubleshooting

**"Insufficient AVAX"** — Request more AVAX from the faucet. Deployment requires approximately 0.3-0.5 AVAX for all 13 contracts.

**"Wrong network"** — Ensure you pass `--network avalancheFuji` to the Hardhat command. The script only runs on Fuji (Chain ID 43113).

**"Missing PRIVATE_KEY"** — Set the `PRIVATE_KEY` environment variable or add it to your `.env` file.

**Verification fails** — Snowtrace verification can be intermittent. Wait a few minutes and retry. Ensure the `SNOWTRACE_API_KEY` is set if required.

## Reference

| Resource | URL |
|---|---|
| Fuji Faucet | [https://core.app/tools/testnet-faucet/](https://core.app/tools/testnet-faucet/) |
| Fuji Explorer (Snowtrace) | [https://testnet.snowtrace.io](https://testnet.snowtrace.io) |
| Avalanche Docs | [https://docs.avax.network](https://docs.avax.network) |
| Vaultfire Dashboard | [https://theloopbreaker.com](https://theloopbreaker.com) |
| Vaultfire GitHub | [https://github.com/Ghostkey316/ghostkey-316-vaultfire-init](https://github.com/Ghostkey316/ghostkey-316-vaultfire-init) |
