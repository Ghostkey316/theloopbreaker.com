# Vaultfire Wallet Feature Report

**Project:** Ember Mobile App — Vaultfire Protocol  
**Date:** February 21, 2026  
**Commit:** `5bb6ed4` on `main` branch  
**CI Status:** Node.js CI ✓ | CI (Hardhat/Slither) ✓  
**Tests:** 243 passing (105 audit + 70 design + 30 upgrades + 38 wallet)

---

## Executive Summary

The Ember mobile app now includes a native Vaultfire wallet built with ethers.js for keypair generation and Expo SecureStore for encrypted on-device storage. The wallet supports three EVM chains (Ethereum mainnet, Base, and Avalanche) with a modular architecture designed for easy expansion to additional chains. Ember AI guides users through wallet creation conversationally, and the wallet context is automatically passed to Ember's chat for personalized responses referencing the user's address and balances.

---

## Architecture

### Core Module: `lib/wallet-core.ts`

The wallet core module is the foundation of the wallet system. It handles all cryptographic operations, secure storage, and blockchain interactions.

| Component | Implementation | Details |
|-----------|---------------|---------|
| **Keypair Generation** | `ethers.Wallet.createRandom()` | Generates BIP-39 mnemonic + HD wallet |
| **Mnemonic Import** | `ethers.Wallet.fromPhrase()` | Restores wallet from 12-word seed phrase |
| **Private Key Import** | `new ethers.Wallet(key)` | Imports from raw private key |
| **Secure Storage** | Expo SecureStore | Encrypted keychain (iOS) / keystore (Android) |
| **Web Fallback** | AsyncStorage with `secure_` prefix | Development-only fallback for web preview |
| **Balance Fetching** | JSON-RPC `eth_getBalance` | Direct RPC calls to each chain |

### Multi-Chain Configuration

The `SUPPORTED_CHAINS` array is designed for easy expansion. Each chain entry contains all the information needed to interact with it:

```typescript
export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    name: "Ethereum",
    chainId: 1,
    rpc: "https://eth.llamarpc.com",
    symbol: "ETH",
    color: "#627EEA",
    decimals: 18,
  },
  {
    name: "Base",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    symbol: "ETH",
    color: "#0052FF",
    decimals: 18,
  },
  {
    name: "Avalanche",
    chainId: 43114,
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    symbol: "AVAX",
    color: "#E84142",
    decimals: 18,
  },
  // Add Solana, Arbitrum, Polygon here when ready
];
```

Adding a new EVM chain requires only adding a new entry to this array — no other code changes needed.

### Secure Storage Architecture

The wallet uses a layered storage approach:

| Data | Storage Method | Encryption |
|------|---------------|------------|
| Private Key | SecureStore (native) / AsyncStorage (web) | Hardware-backed encryption on native |
| Mnemonic | SecureStore (native) / AsyncStorage (web) | Hardware-backed encryption on native |
| Wallet Address | SecureStore (native) / AsyncStorage (web) | Hardware-backed encryption on native |
| Wallet Created Flag | AsyncStorage | Not encrypted (boolean flag only) |

The private key **never leaves the device**. There is no cloud backup, no server-side storage, and no network transmission of private key material.

---

## Wallet Creation Flow

The wallet creation follows a 5-step Ember-guided flow:

### Step 1: Welcome
Ember greets the user: *"Welcome! I'm Ember, your AI companion in the Vaultfire ecosystem. Let's set up your wallet together."*

The user sees two options: **Create New Wallet** and **Import Existing Wallet**.

### Step 2: Wallet Generation
When the user taps "Create New Wallet":
1. `ethers.Wallet.createRandom()` generates a new keypair
2. The 12-word mnemonic is displayed in a numbered grid
3. Ember warns: *"Write these 12 words down in order. Store them somewhere safe. I can't recover them for you."*
4. A copy button allows copying the full phrase

### Step 3: Seed Phrase Verification
The app selects 3 random word positions and asks the user to enter them:
- Each word must match exactly (case-insensitive)
- All 3 must be correct to proceed
- Ember provides encouragement during verification

### Step 4: Secure Storage
On successful verification:
1. Private key stored via `SecureStore.setItemAsync()`
2. Mnemonic stored via `SecureStore.setItemAsync()`
3. Address stored via `SecureStore.setItemAsync()`
4. Creation flag set in AsyncStorage

### Step 5: Confirmation
Ember congratulates the user: *"Your wallet is ready! I'll always be here to help you navigate the Vaultfire ecosystem."*

The user transitions to the main wallet view.

---

## Import Wallet Flow

Users can import an existing wallet via two methods:

| Method | Input | Validation |
|--------|-------|-----------|
| **Seed Phrase** | 12-word BIP-39 mnemonic | `ethers.Wallet.fromPhrase()` — throws on invalid |
| **Private Key** | 64-character hex string (with or without 0x) | `new ethers.Wallet(key)` — throws on invalid |

Both methods derive the same address and store credentials identically to the creation flow.

---

## Main Wallet View

After wallet creation/import, the main wallet screen displays:

### Portfolio Header
- Total portfolio value (sum of all chain balances in USD placeholder)
- Wallet address with truncation (`0x1234...5678`)
- Copy address button

### Chain Balance Cards
Each chain gets a card with:
- Chain name and color indicator
- Native token balance (formatted from wei)
- Chain-specific color accent

### Action Buttons
- **Receive** — Shows full address with copy-to-clipboard functionality
- **Send** — Placeholder with "Coming Soon" message

### Transaction History
- Placeholder section for future implementation

### Pull-to-Refresh
- Swipe down refreshes all chain balances simultaneously

---

## Ember Chat Integration

The wallet is deeply integrated with Ember AI:

### Context Passing
When a wallet exists, `getWalletContextForEmber()` generates a context string:

```
User's Vaultfire wallet address: 0x1234...
Balances: Ethereum: 0.5 ETH, Base: 1.2 ETH, Avalanche: 10.5 AVAX
```

This context is automatically appended to Ember's memory when the user sends a message, enabling Ember to reference the user's wallet data in conversation.

### Personalized Responses
Ember can now say things like:
- "I see you have 1.2 ETH on Base — that's enough to interact with the governance contracts."
- "Your Avalanche balance of 10.5 AVAX can be used with the bridge."

---

## Tab Navigation

The app now has 6 tabs:

| Position | Tab | Icon | Screen |
|----------|-----|------|--------|
| 1 | Home | house.fill | Vaultfire branding, network status, quick actions |
| 2 | Ember | bubble.left.fill | AI chat with SSE streaming |
| 3 | Wallet | wallet.pass.fill | Native wallet management |
| 4 | Verify | shield.checkered | Trust verification, contract reads |
| 5 | Bridge | arrow.left.arrow.right | Cross-chain bridge status |
| 6 | Dashboard | chart.bar.fill | Protocol health dashboard |

---

## Security Audit

| Check | Status | Details |
|-------|--------|---------|
| Private key stored in SecureStore | **PASS** | Uses hardware-backed encryption on native |
| No private key in AsyncStorage | **PASS** | Only via `secureSet()` which routes to SecureStore on native |
| No private key transmitted over network | **PASS** | No fetch/upload calls with private key |
| No hardcoded keys in source | **PASS** | No 64-char hex strings in source code |
| Mnemonic shown only during creation | **PASS** | Not displayed after initial backup |
| Seed phrase verification required | **PASS** | 3 random words must be confirmed |
| Delete wallet clears all secure data | **PASS** | Removes from SecureStore + AsyncStorage |
| No cloud backup | **PASS** | All storage is local-only |

---

## Test Coverage

38 wallet-specific tests covering:

| Category | Tests | Status |
|----------|-------|--------|
| Wallet Core Module | 14 | All PASS |
| Wallet Screen UI | 13 | All PASS |
| Tab Navigation | 4 | All PASS |
| Ember Integration | 3 | All PASS |
| Security | 4 | All PASS |

---

## Files Added/Modified

| File | Action | Purpose |
|------|--------|---------|
| `lib/wallet-core.ts` | **Added** | Wallet generation, import, storage, balance fetching |
| `app/(tabs)/wallet.tsx` | **Added** | Wallet screen with onboarding and main view |
| `app/(tabs)/_layout.tsx` | **Modified** | Added 6th tab (Wallet) |
| `app/(tabs)/chat.tsx` | **Modified** | Integrated wallet-core context for Ember |
| `components/ui/icon-symbol.tsx` | **Modified** | Added wallet icon mapping |
| `__tests__/wallet.test.ts` | **Added** | 38 wallet feature tests |
| `__tests__/audit.test.ts` | **Modified** | Updated to expect 6 tabs |
| `package.json` | **Modified** | Added ethers.js and expo-clipboard dependencies |

---

## Future Enhancements

1. **Transaction Signing** — Use the stored private key to sign and broadcast transactions directly from the app.
2. **Token Balances** — Add ERC-20 token balance reads for Vaultfire-specific tokens.
3. **WalletConnect v2** — Enable connection to dApps and external signing requests.
4. **Transaction History** — Use Etherscan/Basescan/Snowtrace APIs to display past transactions.
5. **Biometric Lock** — Require Face ID/fingerprint before accessing wallet or signing.
6. **Multi-Wallet Support** — Allow users to create/import multiple wallets and switch between them.
