# Vaultfire AI — Mobile App Interface Design

## Orientation & Usage
- **Portrait only (9:16)**
- **One-handed usage** optimized
- Follows Apple Human Interface Guidelines (HIG)
- Dark-first design — "Obsidian Forge" theme

---

## Color System — "Obsidian Forge"

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0A0F` | Deep black, all screen backgrounds |
| Surface | `#1A1A2E` | Cards, panels, sidebar |
| Surface Elevated | `#252540` | Hover/active states, input fields |
| Foreground | `#FFFFFF` | Primary text |
| Muted | `#9CA3AF` | Secondary text, timestamps |
| Primary (Ember) | `#F97316` | Accent, buttons, active states |
| Secondary (Purple) | `#8B5CF6` | Gradient end, secondary accents |
| Border | `#2A2A3E` | Subtle card/section borders |
| Success | `#22C55E` | Verified, active, healthy |
| Warning | `#F59E0B` | Caution states |
| Error | `#EF4444` | Threats, revoked, danger |

---

## Screen List

### 1. Chat (Tab 1 — Default)
ChatGPT-style conversational interface with Ember AI.

**Layout:**
- **Header bar**: "Ember" title centered, hamburger menu (left) to open sidebar, "New Chat" icon (right)
- **Message area**: Full-screen scrollable list
  - User messages: Right-aligned, ember-tinted bubble (`#1A1A2E` with `#F97316` left border)
  - AI messages: Left-aligned, dark surface bubble (`#1A1A2E`)
  - Typing indicator: Animated dots in AI bubble
  - Timestamps below each message cluster
- **Input bar**: Pinned to bottom, rises with keyboard
  - Dark input field (`#252540`) with rounded corners
  - Send button (ember orange) on right, disabled when empty
  - Placeholder: "Ask Ember anything..."

**Sidebar (Slide-out from left):**
- Dark overlay + panel from left edge
- "New Chat" button at top (ember accent)
- Conversation list: Title preview + timestamp for each
- Swipe-to-delete on conversations
- Vaultfire shield logo at bottom of sidebar

### 2. Trust Verify (Tab 2)
On-chain identity and reputation lookup.

**Layout:**
- **Header**: "Trust Verify" title with shield icon
- **Search bar**: Address input with paste button and search icon
- **Results card stack** (appears after search):
  - Identity Card: Agent address, type, URI, registration date, active status
  - Reputation Card: Average rating (star display), total feedbacks, verified count
  - Bonds Card: Partnership bonds count, accountability bonds, total staked
  - Validation Card: Request count, response count
  - Bridge Status Card: Synced on Avalanche, recognized status
- Each card: Surface background, ember accent headers, data in rows
- Empty state: Shield illustration + "Enter an address to verify"

### 3. Security (Tab 3)
Wallet security scanner and threat alerts.

**Layout:**
- **Header**: "Security" title with lock icon
- **Wallet input**: Address field with scan button
- **Security Score**: Large circular gauge (0-100) with color gradient
- **Threat Alerts section**: Cards for each detected issue
  - Red border for critical, yellow for warnings
  - Icon + description + action link
- **Approval Scanner**: List of token approvals with revoke links
- **Quick Actions**: "Check on Revoke.cash" button (opens in-app browser)
- Empty state: Shield + "Enter a wallet to scan"

### 4. Dashboard (Tab 4)
Live protocol stats from Base contracts.

**Layout:**
- **Header**: "Dashboard" title with chart icon
- **Protocol Overview Card**: Total agents, total bonds, governance signers
- **Stats Grid** (2-column):
  - Identity Registry: Total agents, active count
  - Partnership Bonds: Next bond ID, yield pool, total active value
  - Accountability Bonds: Next bond ID, yield pool, total active value
  - Reputation: Total feedbacks
  - Governance: Signer count, threshold, transaction count
  - Flourishing Oracle: Oracle count, next round
  - Bridge: Message count, synced agents, paused status
  - Attestation: Attestation count, proof system
- Each stat card: Surface bg, ember accent number, muted label
- Pull-to-refresh to reload all stats
- Loading skeletons while fetching

### 5. About (Tab 5)
Vaultfire values, architecture, and contract explorer.

**Layout:**
- **Header**: Vaultfire shield + flame logo, "Vaultfire Protocol"
- **Mission Statement**: Privacy, freedom, accountability, human dignity
- **Values Cards**: 4 cards for core values with icons
- **Architecture Section**: Brief protocol overview
- **Contract Explorer**: Expandable list of all 28 contracts
  - Each shows: Name, short address, chain badge (Base/Avalanche)
  - Tap to open on Basescan/Snowtrace
- **Links**: Website, docs, social
- **Version info** at bottom

---

## Key User Flows

### Chat Flow
1. User opens app → Chat tab (default)
2. Empty state shows "Ask Ember anything..." prompt
3. User types message → taps send
4. Message appears in right bubble
5. AI response streams in word-by-word in left bubble
6. User can continue conversation
7. Swipe from left edge → sidebar opens
8. Tap "New Chat" → clears current, starts fresh
9. Tap existing conversation → loads that history

### Trust Verify Flow
1. User taps Trust Verify tab
2. Enters/pastes Ethereum address
3. Taps search → loading skeletons appear
4. Results cards populate with on-chain data
5. User scrolls through identity, reputation, bonds, validation, bridge status

### Security Flow
1. User taps Security tab
2. Enters wallet address
3. App queries approval data and shows security assessment
4. User sees threat alerts and approval list
5. Tap "Check on Revoke.cash" → opens browser

### Dashboard Flow
1. User taps Dashboard tab
2. Stats load from all Base contracts
3. Pull down to refresh
4. Cards show live protocol metrics

### About Flow
1. User taps About tab
2. Scrolls through mission, values, architecture
3. Taps contract → opens explorer in browser

---

## Typography
- Headers: Bold, 24-28px
- Subheaders: Semibold, 18-20px
- Body: Regular, 14-16px
- Captions/timestamps: Regular, 12px, muted color
- Monospace for addresses and hashes

## Spacing
- Screen padding: 16px horizontal
- Card padding: 16px
- Card gap: 12px
- Section gap: 24px

## Interactions
- All tappable elements: opacity feedback on press
- Primary buttons: scale 0.97 + haptic light
- Cards: subtle opacity on press
- Sidebar: gesture-driven slide from left edge
- Keyboard: input bar animates up smoothly with KeyboardAvoidingView
