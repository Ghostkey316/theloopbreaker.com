# Vaultfire Protocol Dashboard

A real-time on-chain dashboard for the Vaultfire protocol, reading live data from 13 smart contracts deployed on **Base mainnet** (Chain ID 8453).

## Features

- **Protocol Overview** — Total contracts, registered agents, bonds, attestations, and feedbacks
- **Registered AI Agents** — Sovereign identities from ERC-8004 Identity Registry with agent IDs, registration dates, and status
- **Active Bonds** — Partnership bonds (AIPartnershipBondsV2) and accountability bonds (AIAccountabilityBondsV2) with details
- **Belief Attestations** — History from BeliefAttestationVerifier and ProductionBeliefAttestationVerifier
- **Reputation Scores** — Data from ERC8004ReputationRegistry
- **Governance** — MultisigGovernance proposals, signer count, threshold, pending timelock changes
- **Oracle Status** — FlourishingMetricsOracle registered oracles, latest submissions, consensus values
- **Contract Health** — All 13 contracts with verification status, owner addresses, and BaseScan links

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS 4** with shadcn/ui components
- **ethers.js v6** for on-chain data reading
- **Framer Motion** for animations
- Dark "Obsidian Forge" theme with embris-to-purple accents

## Contracts Monitored

| Contract | Address |
|----------|---------|
| PrivacyGuarantees | `0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045` |
| MissionEnforcement | `0x8568F4020FCD55915dB3695558dD6D2532599e56` |
| AntiSurveillance | `0x722E37A7D6f27896C688336AaaFb0dDA80D25E57` |
| ERC8004IdentityRegistry | `0x35978DB675576598F0781dA2133E94cdCf4858bC` |
| BeliefAttestationVerifier | `0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba` |
| ERC8004ReputationRegistry | `0xdB54B8925664816187646174bdBb6Ac658A55a5F` |
| ERC8004ValidationRegistry | `0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55` |
| AIPartnershipBondsV2 | `0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4` |
| AIAccountabilityBondsV2 | `0xf92baef9523BC264144F80F9c31D5c5C017c6Da8` |
| VaultfireERC8004Adapter | `0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0` |
| MultisigGovernance | `0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92` |
| FlourishingMetricsOracle | `0x83dd216449B3F0574E39043ECFE275946fa492e9` |
| ProductionBeliefAttestationVerifier | `0xa5CEC47B48999EB398707838E3A18dd20A1ae272` |

## Getting Started

```bash
cd dashboard
pnpm install
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

## RPC Configuration

The dashboard reads data from Base mainnet using the public RPC endpoint:
- **RPC URL**: `https://mainnet.base.org`
- **Chain ID**: `8453`
- **Block Explorer**: [BaseScan](https://basescan.org)

No wallet connection is required — the dashboard is read-only.

## Architecture

```
dashboard/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── dashboard/     # All 8 dashboard section components
│   │   ├── hooks/
│   │   │   └── useVaultfireData.ts  # On-chain data fetching hooks
│   │   ├── lib/
│   │   │   └── contracts.ts   # Contract addresses, ABIs, utilities
│   │   └── pages/
│   │       └── Home.tsx       # Main dashboard page
│   └── index.html
├── package.json
└── README.md
```

## License

MIT
