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
| PrivacyGuarantees | `0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e` |
| MissionEnforcement | `0x6EC0440e1601558024f285903F0F4577B109B609` |
| AntiSurveillance | `0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac` |
| ERC8004IdentityRegistry | `0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD` |
| BeliefAttestationVerifier | `0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a` |
| ERC8004ReputationRegistry | `0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C` |
| ERC8004ValidationRegistry | `0x50E4609991691D5104016c4a2F6D2875234d4B06` |
| AIPartnershipBondsV2 | `0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855` |
| AIAccountabilityBondsV2 | `0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140` |
| VaultfireERC8004Adapter | `0x02Cb2bFBeC479Cb1EA109E4c92744e08d5A5B361` |
| MultisigGovernance | `0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D` |
| FlourishingMetricsOracle | `0xb751abb1158908114662b254567b8135C460932C` |
| ProductionBeliefAttestationVerifier | `0xBDB5d85B3a84C773113779be89A166Ed515A7fE2` |

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
