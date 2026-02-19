# Vaultfire Teleporter Bridge: Cross-Chain Trust Portability

**Project for Build Games 2026**

This repository contains the smart contracts, tests, and deployment scripts for the Vaultfire Teleporter Bridge, a production-ready cross-chain solution that enables trust portability for AI agents between **Base mainnet** and **Avalanche C-Chain**. It is the first protocol to use Avalanche Teleporter for cross-chain trust synchronization, giving Vaultfire a significant competitive advantage.

When an AI agent is registered, bonded, or reviewed on one chain, this bridge relays the agent's updated trust state to the other chain. This ensures that an agent's identity and reputation are seamlessly recognized across the entire Vaultfire ecosystem.

## Key Features

*   **Seamless Trust Sync:** Synchronizes key trust state across Base and Avalanche for AI agents, including identity, bonds, reputation, and validation status.
*   **Hybrid Architecture:** Combines native Avalanche Teleporter (ICM) for inter-Avalanche communication with a secure, authorized relayer pattern for Base ↔ Avalanche communication.
*   **Production-Ready:** Includes comprehensive security features, extensive testing (84+ tests), and robust deployment scripts.
*   **Gas Efficient:** Optimized for low gas usage on both chains.
*   **Extensible:** Designed to easily support additional chains and message types in the future.

## Architecture

The bridge uses a hybrid architecture to handle the different cross-chain communication capabilities of Base (an Ethereum L2) and Avalanche (an Avalanche L1).

```
┌─────────────┐   Teleporter / Relayer   ┌─────────────┐
│  Base Bridge │ ◄─────────────────────► │  Avax Bridge │
│  (relayer)   │                          │  (ICM native)│
└──────┬───────┘                          └──────┬───────┘
        │                                         │
   Local Vaultfire                           Local Vaultfire
   Contracts (Base)                          Contracts (Avax)
```

*   **Avalanche C-Chain:** The bridge implements `ITeleporterReceiver` for native compatibility with Avalanche Teleporter. This allows it to receive messages directly from any other Avalanche L1 chain without a custom relayer.
*   **Base ↔ Avalanche:** Since Base is not an Avalanche L1, a custom off-chain relayer is used. This relayer listens for `MessageSent` events on one chain, constructs a valid `BridgeMessage`, and submits it to the peer bridge on the other chain via the `relayMessage()` function.
*   **Unified Message Format:** All cross-chain messages, regardless of the transport layer (Teleporter or relayer), use the same ABI-encoded `BridgeMessage` struct. This ensures consistency and simplifies message handling.

### Security

Security is paramount. The bridge incorporates several layers of protection:

*   **Owner-Controlled Relayer Whitelist:** Only authorized addresses can relay messages, preventing unauthorized state changes.
*   **Nonce-Based Replay Protection:** Each message has a unique, monotonic nonce to prevent replay attacks.
*   **Source Chain & Sender Verification:** The bridge verifies that messages originate from the configured remote chain and peer bridge address.
*   **Pausable:** The bridge owner can pause all activity in case of an emergency.
*   **Message Hash Deduplication:** The bridge stores a hash of every processed message to prevent duplicate processing.

## Contracts

*   `VaultfireTeleporterBridge.sol`: The core bridge contract, deployed on both chains.
*   `ITeleporterMessenger.sol`: Interface for the official Avalanche Teleporter contract.
*   `ITeleporterReceiver.sol`: Interface for receiving Teleporter messages.
*   `MockTeleporterMessenger.sol`: A mock contract used for testing the Teleporter integration.

## Getting Started

### Prerequisites

*   Node.js >= 18.x
*   npm
*   Hardhat

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
    cd ghostkey-316-vaultfire-init
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Testing

The project includes a comprehensive test suite with over 80 tests covering all aspects of the bridge's functionality.

To run the tests:

```bash
npx hardhat test test/VaultfireTeleporterBridge.test.js
```

### Deployment

The `deploy-teleporter-bridge.js` script handles deploying and configuring the bridge on both Base and Avalanche.

1.  Set the `PRIVATE_KEY` environment variable with the deployer's private key.
    ```bash
    export PRIVATE_KEY="your-private-key"
    ```

2.  Run the deployment script:
    ```bash
    node scripts/deploy-teleporter-bridge.js
    ```

The script will deploy the bridge to both chains and configure each to point to its peer. The resulting deployment addresses will be saved in `teleporter-bridge-deployment.json`.

### Running the Relayer

The off-chain relayer is responsible for bridging messages between Base and Avalanche.

1.  Ensure the `teleporter-bridge-deployment.json` file exists (it's created by the deployment script).

2.  Set the `PRIVATE_KEY` environment variable with the relayer's private key. This key must be authorized as a relayer on both bridge contracts.

3.  Start the relayer:
    ```bash
    node scripts/relayer.js
    ```

The relayer will start polling both chains for `MessageSent` events and relay them to the corresponding destination chain.

## Message Types

The bridge supports the following message types for synchronizing trust state:

| Type ID | Message Type                 | Payload Struct                |
| :------ | :--------------------------- | :---------------------------- |
| 0       | `SYNC_AGENT_REGISTRATION`    | `AgentRegistrationPayload`    |
| 1       | `SYNC_PARTNERSHIP_BOND`      | `PartnershipBondPayload`      |
| 2       | `SYNC_ACCOUNTABILITY_BOND`   | `AccountabilityBondPayload`   |
| 3       | `SYNC_REPUTATION`            | `ReputationPayload`           |
| 4       | `SYNC_VALIDATION`            | `ValidationPayload`           |

## References

1.  [Avalanche Teleporter Documentation](https://build.avax.network/docs/cross-chain/icm-contracts/overview)
2.  [Avalanche Teleporter GitHub](https://github.com/ava-labs/icm-contracts)
