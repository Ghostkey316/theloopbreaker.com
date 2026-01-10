# Vaultfire SDK API Reference

Complete reference for the Vaultfire TypeScript SDK and REST API.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [TypeScript SDK](#typescript-sdk)
  - [VaultfireSDK](#vaultfiresdk)
  - [Methods](#methods)
  - [Types](#types)
- [REST API](#rest-api)
  - [Endpoints](#endpoints)
  - [Authentication](#authentication)
  - [Rate Limits](#rate-limits)
- [Integration Examples](#integration-examples)
- [Error Handling](#error-handling)

---

## Installation

### TypeScript/JavaScript

```bash
npm install @vaultfire/sdk ethers
```

### REST API

No installation needed - use any HTTP client.

```bash
curl https://api.vaultfire.io/v1/modules
```

---

## Quick Start

### TypeScript

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

console.log('TX Hash:', result.txHash);
```

### REST API

```bash
curl -X POST https://api.vaultfire.io/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "statement": "I contribute to open source",
    "moduleId": 1
  }'
```

---

## TypeScript SDK

### VaultfireSDK

Main SDK class for integrating Vaultfire trust layer.

#### Constructor

```typescript
new VaultfireSDK(config?: VaultfireConfig)
```

**Parameters:**

- `config` (optional): Configuration object
  - `chain`: `'base'` | `'base-sepolia'` | `'base-goerli'` (default: `'base'`)
  - `rpcUrl`: Custom RPC URL (optional)
  - `contracts`: Custom contract addresses (optional)
  - `apiKey`: API key for rate limiting (optional)
  - `analytics`: Enable analytics (default: `true`)

**Example:**

```typescript
const sdk = new VaultfireSDK({
  chain: 'base',
  apiKey: 'your-api-key',
});
```

---

### Methods

#### `connect(signer: Signer): void`

Connect an Ethers signer for write operations.

**Parameters:**
- `signer`: Ethers `Signer` instance (Wallet, JsonRpcSigner, etc.)

**Example:**

```typescript
import { Wallet } from 'ethers';

const wallet = new Wallet('0x...');
sdk.connect(wallet);
```

---

#### `verifyBelief(attestation: BeliefAttestation): Promise<VerificationResult>`

Verify a belief with ZK proof and submit to Base.

**Parameters:**

```typescript
interface BeliefAttestation {
  beliefHash: string;          // Keccak256 hash of belief
  moduleId: number;            // Module type (0-7)
  zkProofBundle?: string;      // Optional ZK proof
  metadata?: Record<string, unknown>; // Off-chain metadata
}
```

**Returns:**

```typescript
interface VerificationResult {
  verified: boolean;
  txHash?: string;
  gasUsed?: bigint;
  attestationId?: string;
  error?: string;
}
```

**Example:**

```typescript
const result = await sdk.verifyBelief({
  beliefHash: sdk.hashBelief('I believe in decentralization'),
  moduleId: ModuleType.GENERIC,
});

if (result.verified) {
  console.log('Success! TX:', result.txHash);
}
```

---

#### `isSovereign(beliefHash: string): Promise<boolean>`

Check if a belief has been attested.

**Parameters:**
- `beliefHash`: Keccak256 hash of the belief

**Returns:** `boolean` - Whether the belief is sovereign

**Example:**

```typescript
const hash = sdk.hashBelief('My belief');
const isSovereign = await sdk.isSovereign(hash);
console.log('Attested:', isSovereign);
```

---

#### `getAttestations(address: string, limit?: number): Promise<Attestation[]>`

Get attestations for an address.

**Parameters:**
- `address`: Ethereum address
- `limit`: Maximum results (default: 100)

**Returns:** Array of `Attestation` objects

```typescript
interface Attestation {
  id: string;
  beliefHash: string;
  prover: string;
  moduleId: number;
  zkVerified: boolean;
  timestamp: number;
  txHash: string;
}
```

**Example:**

```typescript
const attestations = await sdk.getAttestations(
  '0x1234...',
  50
);

attestations.forEach(a => {
  console.log(`Belief: ${a.beliefHash}, Verified: ${a.zkVerified}`);
});
```

---

#### `getModules(): Promise<ModuleInfo[]>`

Get available verification modules.

**Returns:** Array of `ModuleInfo` objects

```typescript
interface ModuleInfo {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
}
```

**Example:**

```typescript
const modules = await sdk.getModules();
modules.forEach(m => {
  console.log(`${m.name}: ${m.description}`);
});
```

---

#### `hashBelief(statement: string): string`

Hash a belief statement using Keccak256.

**Parameters:**
- `statement`: Plain text belief

**Returns:** `string` - Hex-encoded hash

**Example:**

```typescript
const hash = sdk.hashBelief('I value privacy');
// Returns: '0x...'
```

---

#### `estimateGas(attestation: BeliefAttestation): Promise<bigint>`

Estimate gas cost for verification.

**Parameters:**
- `attestation`: Belief attestation parameters

**Returns:** `bigint` - Estimated gas units

**Example:**

```typescript
const gas = await sdk.estimateGas({
  beliefHash: '0x...',
  moduleId: ModuleType.GITHUB,
});
console.log(`Estimated: ${gas} gas`);
```

---

#### `getChainConfig(): object`

Get current chain configuration.

**Returns:** Object with chain info

**Example:**

```typescript
const config = sdk.getChainConfig();
console.log('Chain:', config.chain);
console.log('Contracts:', config.contracts);
```

---

### Types

#### ModuleType Enum

```typescript
enum ModuleType {
  GENERIC = 0,      // Generic belief
  GITHUB = 1,       // GitHub contributions
  NS3 = 2,          // NS3 ownership
  BASE = 3,         // Base transactions
  CREDENTIAL = 4,   // Professional credentials
  REPUTATION = 5,   // On-chain reputation
  IDENTITY = 6,     // Identity verification
  GOVERNANCE = 7,   // DAO governance
}
```

---

## REST API

Base URL: `https://api.vaultfire.io`

All endpoints return JSON with this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": "..." // if success = false
}
```

---

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "chain": "base",
  "timestamp": "2026-01-10T..."
}
```

---

#### `GET /api/v1/config`

Get chain configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "chain": "base",
    "chainId": 8453,
    "contracts": {
      "dilithiumAttestor": "0x...",
      "beliefVerifier": "0x..."
    }
  }
}
```

---

#### `GET /api/v1/modules`

Get available modules.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "GitHub",
      "description": "Verify GitHub contributions",
      "enabled": true
    }
  ]
}
```

---

#### `POST /api/v1/verify`

Verify a belief statement.

**Request:**

```json
{
  "statement": "I contribute to open source",
  "moduleId": 1,
  "metadata": {
    "repo": "vaultfire/core"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "beliefHash": "0x...",
    "verified": true,
    "gasUsed": "61234",
    "attestationId": "0x...-12345"
  }
}
```

---

#### `GET /api/v1/sovereign/:beliefHash`

Check if belief is attested.

**Response:**

```json
{
  "success": true,
  "data": {
    "beliefHash": "0x...",
    "isSovereign": true
  }
}
```

---

#### `GET /api/v1/attestations/:address?limit=100`

Get attestations by address.

**Query Parameters:**
- `limit`: Max results (default: 100)

**Response:**

```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "count": 5,
    "attestations": [
      {
        "id": "0x...-12345",
        "beliefHash": "0x...",
        "prover": "0x...",
        "moduleId": 1,
        "zkVerified": true,
        "timestamp": 1704931200,
        "txHash": "0x..."
      }
    ]
  }
}
```

---

#### `POST /api/v1/estimate-gas`

Estimate gas for verification.

**Request:**

```json
{
  "statement": "My belief",
  "moduleId": 0
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "beliefHash": "0x...",
    "estimatedGas": "61000",
    "estimatedGwei": "~61000"
  }
}
```

---

#### `POST /api/v1/hash`

Hash a statement.

**Request:**

```json
{
  "statement": "I value privacy"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "statement": "I value privacy",
    "hash": "0x..."
  }
}
```

---

### Authentication

API keys are optional for public endpoints. For production use with higher rate limits:

```bash
curl -H "X-API-Key: your-key-here" \
  https://api.vaultfire.io/v1/verify
```

---

### Rate Limits

**Free Tier:**
- 100 requests per 15 minutes
- No API key required

**Pro Tier ($99/month):**
- 10,000 requests per hour
- API key required
- Priority proof generation
- Webhook support

**Enterprise:**
- Custom limits
- Dedicated infrastructure
- SLA guarantees
- Contact: enterprise@vaultfire.io

---

## Integration Examples

### DeFi: Prove Trading History

```typescript
const sdk = new VaultfireSDK({ chain: 'base' });
sdk.connect(wallet);

// Prove profitable trading without revealing positions
const result = await sdk.verifyBelief({
  beliefHash: sdk.hashBelief('Profitable trader Q1 2026'),
  moduleId: ModuleType.REPUTATION,
  metadata: { pnl: '+15%', trades: 47 } // stays off-chain
});
```

### DAO: Reputation-Weighted Voting

```typescript
// Verify member contributions before voting
const attestations = await sdk.getAttestations(memberAddress);
const reputationScore = attestations.filter(a => a.zkVerified).length;

if (reputationScore >= 10) {
  // Allow proposal submission
}
```

### Gaming: Anti-Cheat Verification

```typescript
// Prove achievement without revealing game state
const result = await sdk.verifyBelief({
  beliefHash: sdk.hashBelief('Level 50 achieved legitimately'),
  moduleId: ModuleType.GENERIC,
  zkProofBundle: gameStateProof,
});
```

---

## Error Handling

All methods return errors gracefully:

```typescript
const result = await sdk.verifyBelief({ ... });

if (!result.verified) {
  console.error('Verification failed:', result.error);
  // Handle error:
  // - "SDK not connected" → Call connect()
  // - "Invalid beliefHash" → Check format
  // - "Insufficient funds" → Add ETH to wallet
}
```

REST API errors:

```json
{
  "success": false,
  "error": "Missing required field: statement"
}
```

HTTP Status Codes:
- `200`: Success
- `400`: Bad request (invalid input)
- `429`: Rate limit exceeded
- `500`: Server error
- `503`: Service unavailable (signer not configured)

---

## Support

- **Documentation**: https://docs.vaultfire.io
- **GitHub**: https://github.com/Ghostkey316/ghostkey-316-vaultfire-init
- **Discord**: https://discord.gg/vaultfire
- **Email**: support@vaultfire.io

---

**Built with ❤️ for Base. Powered by RISC Zero STARKs.**
