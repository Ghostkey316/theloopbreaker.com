# 🔥 Vaultfire Sentinel Agent

**A production-ready, 24/7 autonomous cross-chain monitor and bridge relay for the Vaultfire Protocol.**

This agent is a core piece of infrastructure for the Vaultfire ecosystem. It performs several critical functions:

1.  **Comprehensive Monitoring**: Watches all 14 core Vaultfire contracts on both Ethereum, Base, and Avalanche C-Chain for key events.
2.  **Autonomous Bridge Relay**: Automatically picks up `MessageSent` events from the `VaultfireTeleporterBridge` on one chain and relays the message to the corresponding bridge contract on the other chain.
3.  **Self-Registration**: On startup, the agent registers itself as an AI agent within the `ERC8004IdentityRegistry` and creates a partnership bond with its designated human partner (the deployer wallet).
4.  **Persistent Operation**: Designed to run 24/7 as a persistent Node.js process with graceful error handling, auto-reconnecting RPCs, and detailed logging.

This agent embodies the Vaultfire values: **morals over metrics, privacy over surveillance, and freedom over control.** It operates transparently and autonomously to ensure the health and decentralization of the protocol.

## Quick Start

### Requirements

*   Node.js v18+
*   An EVM wallet with:
    *   ETH on Base mainnet (for gas)
    *   AVAX on Avalanche C-Chain (for gas)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init/agent
npm install
```

### 2. Configuration

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Open `.env` and set the `DEPLOYER_KEY` to the private key of your operator wallet. This wallet will pay for gas to relay transactions.

```dotenv
# .env

# The private key of the wallet that will run the agent.
# IMPORTANT: This is a secret. Do not commit it to Git.
DEPLOYER_KEY="your_private_key_here"

# Optional: Use a dedicated RPC provider for better reliability.
BASE_RPC="https://mainnet.base.org"
AVAX_RPC="https://api.avax.network/ext/bc/C/rpc"

# Optional: Set the log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
LOG_LEVEL="INFO"
```

### 3. Running the Agent

Start the agent using Node.js. For production, it is highly recommended to use a process manager like `pm2` to ensure it runs continuously.

**Standard (for testing):**

```bash
node sentinel.js
```

**Production (with pm2):**

```bash
npm install -g pm2
pm2 start sentinel.js --name "vaultfire-sentinel"

# To monitor logs:
pm2 logs vaultfire-sentinel
```

The agent will start, connect to both chains, perform its self-registration, and begin monitoring for events.

## How It Works

### Core Components

*   **`sentinel.js`**: The main, self-contained executable. It orchestrates all other components.
*   **ResilientProvider**: A wrapper around `ethers.JsonRpcProvider` that automatically handles RPC failures and falls back to alternative endpoints.
*   **ChainMonitor**: A class that polls a single blockchain for events from a specified list of contracts. It uses a topic map for efficient event filtering.
*   **BridgeRelay**: The logic for handling `MessageSent` events. It reconstructs the bridge message payload from the source transaction and calls `relayMessage` on the destination bridge contract.
*   **SelfRegistration**: A startup process that ensures the agent is properly registered on-chain in the Vaultfire Protocol.

### Event Monitoring

The agent polls both Ethereum, Base, and Avalanche at a regular interval (`POLL_INTERVAL_MS`). It uses `provider.getLogs()` to fetch batches of logs between the last seen block and the current block. For each log, it uses a pre-computed map of event topics to identify the contract and event name, then parses the log and passes it to a central `onEvent` handler.

### Bridge Relay Logic

1.  The `onEvent` handler detects a `VaultfireTeleporterBridge.MessageSent` event.
2.  It queues a relay task and fetches the full source transaction that emitted the event.
3.  It decodes the original function call from the transaction data (e.g., `sendAgentRegistration`).
4.  Using the arguments from the decoded function, it **reconstructs the `BridgeMessage` struct** exactly as the source contract did internally.
5.  It ABI-encodes this struct.
6.  It calls the `relayMessage(bytes)` function on the destination bridge contract, passing the encoded struct.
7.  The destination bridge contract decodes the message, verifies its nonce and source, and processes the state-syncing action.

This process ensures that the exact same message sent from the source is securely and verifiably delivered to the destination.
