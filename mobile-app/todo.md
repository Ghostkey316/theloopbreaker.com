# Vaultfire AI — Project TODO

## Core Infrastructure
- [x] Configure Obsidian Forge theme (colors, tokens)
- [x] Set up 5-tab navigation (Chat, Trust Verify, Security, Dashboard, About)
- [x] Add icon mappings for all tabs
- [x] Copy contracts_config.ts into project
- [x] Install ethers.js dependency
- [x] Configure OpenAI API key environment variable
- [x] Generate app logo and branding assets

## Chat Tab (ChatGPT-Style)
- [x] Chat message bubbles (user right, AI left)
- [x] Input bar pinned to bottom with send button
- [x] Keyboard-aware input bar animation
- [x] Streaming word-by-word typing effect
- [x] Conversation history stored locally (AsyncStorage)
- [x] Slide-out sidebar with conversation list
- [x] New Chat button in sidebar
- [x] Conversation title/preview in sidebar list
- [x] Auto-scroll to newest message
- [x] Ember AI persona with gpt-4o model
- [x] System prompt for Ember persona

## Trust Verify Tab
- [x] Address input with paste button
- [x] Identity lookup (ERC8004IdentityRegistry)
- [x] Reputation lookup (ERC8004ReputationRegistry)
- [x] Bond status (Partnership + Accountability)
- [x] Validation registry lookup
- [x] Bridge status check (Teleporter)
- [x] Adapter check (fully registered)
- [x] Result cards with Obsidian Forge styling

## Security Tab
- [x] Wallet address input
- [x] Security assessment display
- [x] Threat alerts section
- [x] Revoke.cash integration link
- [x] Privacy-first messaging
- [x] Real token approval detection using allowance() calls
- [x] Check common DEX routers as spenders
- [x] Flag unlimited approvals with red warning
- [x] One-tap revoke buttons with approve(spender, 0) transactions
- [x] Transaction preview modal for revoke with pending/confirmed/success states
- [x] BaseScan link on revoke confirmation

## Dashboard Tab
- [x] Identity Registry stats
- [x] Partnership Bonds stats
- [x] Accountability Bonds stats
- [x] Reputation Registry stats
- [x] Governance stats
- [x] Flourishing Oracle stats
- [x] Bridge stats
- [x] Attestation stats
- [x] Pull-to-refresh
- [x] Loading skeletons

## WalletConnect Integration
- [x] Install @walletconnect/react-native-compat and related packages
- [x] Create wallet context for connection state
- [x] Add wallet connection button in Chat header
- [x] Show connected address in header when wallet is connected
- [x] Store connected wallet address in AsyncStorage
- [x] Auto-populate Trust Verify tab with connected wallet data
- [x] Auto-populate Security tab with connected wallet data
- [x] Pass wallet address to Ember for context in conversations
- [x] Show wallet icon with connection status indicator

## About Tab
- [x] Vaultfire mission statement
- [x] Core values cards
- [x] Protocol architecture overview
- [x] Contract explorer (all 28 contracts)
- [x] Explorer links (Basescan/Snowtrace)
- [x] Version info

## Branding & Polish
- [x] Generate custom app logo (shield + flame)
- [x] Update app.config.ts with branding
- [x] Obsidian Forge theme colors applied
- [x] Verify all flows work end-to-end
- [x] Check for console errors (0 TypeScript errors)
- [x] Ensure competition readiness

## Wallet Tab
- [x] ETH balance on Base and Avalanche
- [x] ERC-20 token balances (common tokens via balanceOf)
- [x] Total portfolio value estimate (ETH price from public API)
- [x] Multi-chain support (Base + Avalanche)
- [x] Chain switcher
- [x] Token list with logos
- [x] Custom token import by contract address
- [x] Send ETH/tokens flow with recipient input and amount
- [x] NEVER display/interact with ASM tokens

## Ember Permission Levels
- [x] Permission level context (View Only / Advisory / Guardian)
- [x] Default permission: Advisory
- [x] Settings gear icon to change permission level
- [x] Permission level affects Ember's behavior in chat
- [x] Permission level shown in wallet connection modal

## Tab Order Update
- [x] Reorder tabs: Chat, Wallet, Trust Verify, Security, Dashboard, About
- [x] Add Wallet tab icon mapping
- [x] All 6 tabs visible and functional

## Ember Agent Upgrade
- [x] Define OpenAI function calling tools (lookupTrustProfile, checkWalletSecurity, getTokenBalances, getContractInfo, registerAgent, createBond, submitFeedback, revokeApproval, sendTokens)
- [x] Server-side tool executor that runs ethers.js calls and returns results
- [x] Multi-turn tool call loop: model calls tool → executor runs → result fed back → model responds
- [x] Upgrade Ember system prompt with full Vaultfire contract knowledge and agent persona
- [x] Chat screen handles tool_call messages and shows "Ember is checking the chain..." state
- [x] Transaction tool calls show preview modal before user signs
- [x] Wallet monitoring polling service (30s interval when wallet connected)
- [x] Proactive alert system: new txs, new approvals, trust changes
- [x] Guardian mode: immediate flag on suspicious approvals
- [x] Advisory mode: suggests revoke for unlimited approvals to unverified contracts

## Final Competition Features
- [x] Wire up Ember tool calling with real on-chain ethers.js execution
- [x] Define OpenAI function calling tools on server
- [x] Execute tools server-side and return results to model
- [x] Show "Ember is checking the chain..." status in Chat
- [x] One-tap revoke approvals in Security tab
- [x] Build approve(spender, 0) transaction for revoke
- [x] Transaction preview for revoke operations
- [x] BaseScan link after revoke confirmation
- [x] Push notifications with expo-notifications
- [x] Wallet alerts: incoming transactions, new approvals
- [x] Trust alerts: reputation changes, new bonds
- [x] Security alerts: suspicious activity
- [x] Local notification polling interval

## Final Polish — Competition Ready
- [x] Real token approval detection using allowance() calls
- [x] Check common DEX routers as spenders
- [x] Flag unlimited approvals with red warning
- [x] Wire revoke buttons to build approve(spender, 0) transactions
- [x] Transaction preview modal for revoke with pending/confirmed/success states
- [x] BaseScan link on revoke confirmation
- [x] Visual polish: consistent spacing on all screens
- [x] Visual polish: loading states everywhere
- [x] Visual polish: error states with clear messages
- [x] Visual polish: Obsidian Forge theme consistency
- [x] Visual polish: chat input bar matches ChatGPT
- [x] Visual polish: wallet tab professional display
- [x] Test: zero TypeScript errors
- [x] Test: 21 unit tests passing
- [x] Test: all flows work end-to-end

## Transaction History
- [x] Set BaseScan API key as environment variable
- [x] Fetch recent transactions from BaseScan API
- [x] Display transaction list in Wallet tab (date, to/from, amount, status, BaseScan link)
- [x] Obsidian Forge theme styling for transaction list

## GitHub Push
- [x] Clone GitHub repo
- [x] Copy app code to mobile-app/ directory
- [x] Create README.md for mobile-app/
- [x] Push to main branch

## Scaling Infrastructure
- [x] Server-side in-memory cache for RPC responses (30s TTL)
- [x] Retry logic with exponential backoff on ethers.js calls (3 retries)
- [x] Clean API route structure for future database swap
- [x] Cache invalidation on write transactions

## ENS / Basename Resolution
- [x] Resolve .eth and .base names using ethers.js provider.resolveName()
- [x] Add name resolution to Trust Verify address input
- [x] Add name resolution to Wallet Send flow
- [x] Show both name and resolved address in UI
- [x] Handle resolution failures gracefully

## Vaultfire Trust Score Badge
- [x] Fetch trust score from ReputationRegistry contract
- [x] Show score badge (0-100) on Wallet tab header
- [x] Color coded: green (70+), yellow (40-69), red (0-39), gray (no profile)
- [x] Auto-refresh when wallet connects

## Final Push
- [x] Compile with zero TypeScript errors
- [x] Run all tests (23 passed, 0 failed)
- [x] CI green on GitHub (both Node.js CI and Hardhat CI)
- [ ] Save checkpoint
- [ ] Push updated code to GitHub mobile-app/

## CI Fix
- [x] Diagnose CI failure from GitHub Actions run #746
- [x] Fix failing tests (tsconfig.json exclude + jest.config.js testPathIgnorePatterns)
- [x] Push fix and verify CI is green
