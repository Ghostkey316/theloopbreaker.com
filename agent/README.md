# Vaultfire Sentinel Agent

**The first living, accountable AI agent on the Vaultfire Protocol.**

This autonomous agent operates through Vaultfire's trust infrastructure on Base mainnet, demonstrating real human-AI partnership with full on-chain accountability.

## What It Does

The Vaultfire Sentinel is not just a registry record — it is a persistent, operating agent that:

1. **Self-Registers** — Registers itself in the ERC8004IdentityRegistry with proper capabilities, metadata, and identity
2. **Operates Under a Partnership Bond** — Discovers or awaits an AIPartnershipBondsV2 bond linking itself to its human partner
3. **Monitors Protocol Health** — Continuously checks contract states, yield pool health, reserve ratios, and bond statistics
4. **Reports Metrics** — Self-reports performance data to the FlourishingMetricsOracle for real accountability
5. **Maintains Transparency** — Every action is logged, every metric is verifiable, every cycle produces a structured report

## Architecture

```
agent/
├── package.json          — Dependencies and scripts
├── tsconfig.json         — TypeScript configuration
├── jest.config.js        — Test configuration
├── .env.example          — Environment variable template
├── .eslintrc.json        — Linting rules
├── README.md             — This file
└── src/
    ├── index.ts          — Main entry point and task loop
    ├── config.ts         — Configuration and contract addresses
    ├── wallet.ts         — Wallet initialization and management
    ├── registry.ts       — ERC8004IdentityRegistry interaction
    ├── bonds.ts          — AIPartnershipBondsV2 management
    ├── tasks.ts          — Protocol monitoring and health checks
    ├── metrics.ts        — FlourishingMetricsOracle reporting
    ├── logger.ts         — Structured logging
    ├── retry.ts          — Exponential backoff retry logic
    └── abi/
        └── index.ts      — Contract ABI fragments
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A funded wallet on Base mainnet (even a small amount of ETH for gas)
- Access to a Base mainnet RPC endpoint

### Setup

```bash
# Navigate to the agent directory
cd agent

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, set AGENT_PRIVATE_KEY
```

### Configuration

Edit `.env` with the following required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `AGENT_PRIVATE_KEY` | The agent's private key (never share this) | Yes |
| `BASE_RPC_URL` | Base mainnet RPC endpoint | No (defaults to public) |
| `HUMAN_PARTNER_ADDRESS` | Human partner's wallet address | No (defaults to deployer) |
| `DRY_RUN` | Set to `false` for live transactions | No (defaults to `true`) |
| `TASK_INTERVAL_SECONDS` | Seconds between task cycles | No (defaults to 300) |
| `LOG_LEVEL` | Logging verbosity (debug/info/warn/error) | No (defaults to info) |

### Run

```bash
# Build TypeScript
npm run build

# Start the agent
npm start

# Or run directly in development mode
npm run dev
```

### Dry Run Mode

By default, the agent starts in **dry run mode** (`DRY_RUN=true`). In this mode:

- All blockchain reads work normally (health checks, status queries)
- No transactions are sent (registration, metrics submission)
- All would-be transactions are logged with full details

Set `DRY_RUN=false` only when you are ready to operate on-chain.

## Contracts

The agent interacts with these deployed contracts on Base mainnet (Chain ID 8453):

| Contract | Address |
|----------|---------|
| ERC8004IdentityRegistry | `0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD` |
| AIPartnershipBondsV2 | `0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` |
| AIAccountabilityBondsV2 | `0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` |
| FlourishingMetricsOracle | `0xb751abb1158908114662b254567b8135C460932C` |
| ERC8004ReputationRegistry | `0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C` |
| ERC8004ValidationRegistry | `0x50E4609991691D5104016c4a92744e08d5A5B361` |

## Task Loop

Each cycle of the task loop performs:

1. **Protocol Health Check** — Calls `getProtocolHealth()` on AIPartnershipBondsV2
2. **Statistics Collection** — Gathers total agents, bonds, yield pool balance, reserve ratios
3. **Agent Self-Assessment** — Checks registration status, balance, oracle status, bond health
4. **Metrics Reporting** — Computes and reports performance metrics
5. **Bond Metrics** — Submits partnership metrics if an active bond exists
6. **Report Generation** — Produces a structured report for each cycle

## Creating the Partnership Bond

The Partnership Bond must be created by the **human partner**, not the agent. The human partner calls:

```solidity
AIPartnershipBondsV2.createBond(agentAddress, "trust-partnership")
```

The agent will automatically discover the bond on its next task cycle.

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Development

```bash
# Lint the codebase
npm run lint

# Build TypeScript
npm run build

# Clean build artifacts
npm run clean
```

## Security

- Private keys are loaded exclusively from environment variables
- The `.env` file is gitignored and must never be committed
- The agent operates with minimal permissions — it only calls functions it needs
- Dry run mode is the default to prevent accidental transactions
- All operations include retry logic with exponential backoff

## Mission Alignment

This agent is built in accordance with the Vaultfire Protocol mission:

> Technology must serve human flourishing, not replace it.

The agent exists to support its human partner, maintain protocol transparency, and demonstrate that AI accountability is not just possible — it is operational.
