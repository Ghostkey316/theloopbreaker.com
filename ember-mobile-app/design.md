# Ember - Vaultfire Protocol Mobile App Design

## Overview
Ember is the AI companion mobile app for the Vaultfire Protocol — a blockchain-based ethical AI governance framework deployed on Ethereum, Base, and Avalanche. The app provides trust verification, cross-chain bridging, contract monitoring, and an AI chat companion named Ember.

## Color Palette (Dark Ember/Fire Theme)
- **Background**: `#0D0D0D` (near-black)
- **Surface**: `#1A1210` (dark ember brown)
- **Primary**: `#FF6B35` (ember orange)
- **Foreground**: `#F5E6D3` (warm cream)
- **Muted**: `#8B7355` (warm gray-brown)
- **Border**: `#2D1F14` (dark brown border)
- **Success**: `#4ADE80` (green)
- **Warning**: `#FBBF24` (amber)
- **Error**: `#F87171` (red)
- **Accent**: `#FF4500` (fire red-orange)

## Screen List (5 Screens / 5 Tabs)

### 1. Home Screen
- Shield+flame Vaultfire logo at top
- "Vaultfire Protocol" title with tagline
- Core values: "Morals over metrics. Privacy over surveillance. Freedom over control."
- Network status cards for Ethereum, Base, and Avalanche (live connectivity indicators)
- Quick stats: total contracts monitored, active chains
- Link to theloopbreaker.com
- Quick action buttons to navigate to other screens

### 2. Ember Chat Screen
- AI chat interface with Ember (the AI companion)
- Ember has deep knowledge of Vaultfire Protocol, all 42 contracts (14 per chain × 3 chains), ERC-8004 standard
- System prompt includes core values and protocol knowledge
- Message bubbles with ember-themed styling
- Memory extraction from conversations persisted via AsyncStorage
- Text input with send button

### 3. Trust Verification Screen
- Contract verification interface
- Dropdown/selector for choosing a contract by name
- Displays contract address, chain, and verification status
- Can verify contracts on both Ethereum, Base, and Avalanche
- Shows ERC-8004 compliance status
- Lists all 42 contracts (14 per chain × 3 chains) organized by chain

### 4. Cross-Chain Bridge Screen
- Bridge interface between Ethereum, Base, and Avalanche
- Shows VaultfireTeleporterBridge contract addresses on both chains
- Chain selector (Base ↔ Avalanche)
- Bridge status and connectivity
- Transaction history placeholder
- Network info display

### 5. Dashboard Screen
- Overview of all protocol metrics
- Contract counts per chain (14 Base, 14 Avalanche)
- Network health indicators
- FlourishingMetrics and AIAccountability bond status
- Governance overview (MultisigGovernance)
- ERC-8004 registry stats

## Key User Flows
1. **Check Protocol Status**: Home → see network cards → tap for details → Dashboard
2. **Chat with Ember**: Ember Chat tab → ask about contracts/protocol → get intelligent responses
3. **Verify Contract**: Trust Verification → select contract → see verification details
4. **Bridge Assets**: Cross-Chain Bridge → select chains → view bridge status
5. **Monitor Dashboard**: Dashboard → view all metrics and contract statuses

## Tab Navigation
| Tab | Icon | Screen |
|-----|------|--------|
| Home | house.fill | Home Screen |
| Ember | chat bubble | Ember Chat |
| Verify | shield checkmark | Trust Verification |
| Bridge | arrow left-right | Cross-Chain Bridge |
| Dashboard | chart bar | Dashboard |

## Branding
- App name: "Vaultfire"
- Logo: Shield with flame motif
- Website: theloopbreaker.com
- Core identity: Ethical AI governance protocol
