# @vaultfire/sdk

> Official TypeScript SDK for Vaultfire - The Trust Layer for Base

[![npm version](https://img.shields.io/npm/v/@vaultfire/sdk.svg)](https://www.npmjs.com/package/@vaultfire/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

Verify any claim with zero-knowledge proofs. Not just beliefs—reputation, identity, credentials, and governance. Built on Base. Powered by RISC Zero STARKs.

## Features

✅ **Post-Quantum Secure** - RISC Zero STARK proofs resist quantum attacks
✅ **Production-Ready** - ~61k gas per verification, <2s proof generation
✅ **Type-Safe** - Full TypeScript support with comprehensive types
✅ **Multi-Chain** - Supports Base Mainnet, Sepolia, and Goerli
✅ **REST API** - Use without Web3 wallets
✅ **Webhooks** - Real-time verification events
✅ **Zero-Knowledge** - Privacy by default

---

## Installation

```bash
npm install @vaultfire/sdk ethers
```

---

## Quick Start

### Recommended (safe defaults)

Use `VaultfireSafeSDK` to avoid accidentally leaking raw statements/PII and to keep analytics off by default.

```typescript
import { VaultfireSafeSDK, ModuleType } from '@vaultfire/sdk';
import { Wallet } from 'ethers';

const vaultfire = new VaultfireSafeSDK({
  chain: 'base',
  privacySalt: process.env.VAULTFIRE_PRIVACY_SALT,
});

vaultfire.connect(new Wallet('YOUR_PRIVATE_KEY'));

const result = await vaultfire.verifyStatement({
  statement: 'I contribute to open source',
  moduleId: ModuleType.GITHUB,
});

console.log('Verified:', result.verified);
console.log('TX Hash:', result.txHash);
```

See: [SAFE_DEFAULTS.md](./SAFE_DEFAULTS.md)

### Raw SDK (advanced)

```typescript
import { VaultfireSDK, ModuleType } from '@vaultfire/sdk';
import { Wallet } from 'ethers';

// Initialize SDK
const vaultfire = new VaultfireSDK({ chain: 'base' });

// Connect wallet
const wallet = new Wallet('YOUR_PRIVATE_KEY');
vaultfire.connect(wallet);

// Verify a belief
const result = await vaultfire.verifyBelief({
  beliefHash: vaultfire.hashBelief('I contribute to open source'),
  moduleId: ModuleType.GITHUB,
});

console.log('Verified:', result.verified);
console.log('TX Hash:', result.txHash);
```

**See [API_REFERENCE.md](./API_REFERENCE.md) for complete documentation.**
