# Ember Mobile App — Vaultfire Protocol

A production-grade React Native + Expo mobile application for the Vaultfire Protocol. Ember is an AI-powered companion that helps users understand and interact with the ethical AI governance framework deployed across Base and Avalanche blockchains.

## Features

### 🤖 Ember AI Chat
- Conversational AI assistant with full Vaultfire Protocol knowledge
- Understands all 28 smart contracts and ERC-8004 standards
- Memory extraction and persistence (facts, preferences, context)
- Wallet integration for personalized responses

### 🔐 Trust Verification
- Real-time verification of all 28 contracts across Base and Avalanche
- Live on-chain status checks via JSON-RPC
- Contract deployment verification
- Per-chain and overall health metrics

### 🌉 Cross-Chain Bridge
- Vaultfire Teleporter Bridge status monitoring
- Message relay counts and relayer information
- Multi-chain network overview
- Live connectivity checks

### 📊 Dashboard
- Network health overview (100% operational)
- Per-chain contract status
- Core values display
- Protocol information

## Tech Stack

- **Framework:** React Native 0.81 with Expo SDK 54
- **Language:** TypeScript 5.9
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **State Management:** React Context + AsyncStorage
- **Animations:** React Native Reanimated 4.x
- **Blockchain:** JSON-RPC for direct chain connectivity
- **AI:** Server-side LLM integration via tRPC

## Installation

```bash
pnpm install
pnpm dev
```

## Core Values

> Morals over metrics. Privacy over surveillance. Freedom over control.

## Audit Reports

- `AUDIT_REPORT.md` — Initial comprehensive audit (104/104 tests passing)
- `DEEP_AUDIT_REPORT.md` — Infrastructure integration audit with real on-chain reads

## Website

https://theloopbreaker.com
