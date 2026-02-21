# Vaultfire Embris Web App

A Next.js web application that provides a ChatGPT-like interface for the Vaultfire Protocol. This is the web counterpart to the mobile app, sharing the same features, data, and Embris AI experience.

## Features

- **6 Main Sections**: Home, Embris Chat, Wallet, Trust Verification, Cross-Chain Bridge, Dashboard
- **Sidebar Navigation**: ChatGPT-style left sidebar for section navigation
- **Dark Embris Theme**: Premium dark interface with #FF6B35 accent on #0A0A0C background
- **SSE Streaming Chat**: Real-time word-by-word responses from Embris AI
- **Native Wallet**: Create, import, and manage wallets with seed phrase backup
- **Multi-Chain Support**: ETH mainnet, Base, and Avalanche with real balance reads
- **28 Contract Addresses**: All Vaultfire Protocol contracts with on-chain verification
- **Sync Layer**: Conversations and memories sync across web and mobile via wallet address
- **Real On-Chain Reads**: ABI-encoded eth_call to read actual contract state

## Tech Stack

- **Framework**: Next.js 15+ with React 19
- **Styling**: Tailwind CSS with custom dark theme
- **Blockchain**: ethers.js v6 for wallet and contract interaction
- **API**: Axios for HTTP requests, native fetch for SSE streams
- **Type Safety**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
# or
pnpm install
```

### Development

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
app/
  components/
    Sidebar.tsx          # Left navigation sidebar
  sections/
    Home.tsx             # Home screen
    Chat.tsx             # Embris AI chat
    Wallet.tsx           # Wallet management
    Verify.tsx           # Trust verification
    Bridge.tsx           # Cross-chain bridge
    Dashboard.tsx        # Protocol dashboard
  lib/
    contracts.ts         # 28 contract addresses
    wallet.ts            # Wallet utilities
    sync-service.ts      # Sync with mobile app
  layout.tsx             # Root layout
  page.tsx               # Main page with sidebar
  globals.css            # Global Tailwind styles
public/
  favicon.ico            # App icon
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For production (theloopbreaker.com), set:

```env
NEXT_PUBLIC_API_URL=https://api.theloopbreaker.com
```

## Deployment to Vercel

### Prerequisites

- Vercel account (free tier available)
- GitHub repository with this code

### Steps

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Vercel auto-detects Next.js and configures build settings

3. **Configure Environment Variables**:
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add `NEXT_PUBLIC_API_URL` pointing to your backend API

4. **Deploy**:
   - Vercel automatically deploys on push to `main`
   - Your app is live at `https://<project-name>.vercel.app`

### Connect Custom Domain (theloopbreaker.com)

1. **In Vercel Dashboard**:
   - Go to Settings → Domains
   - Click "Add Domain"
   - Enter `theloopbreaker.com`

2. **Update DNS Records**:
   - Vercel provides DNS records to add to your domain registrar
   - Add the CNAME or A records as shown
   - Wait for DNS propagation (5-30 minutes)

3. **Verify**:
   - Once DNS propagates, your app is live at `https://theloopbreaker.com`

## API Integration

The web app connects to the shared backend at `NEXT_PUBLIC_API_URL`:

- **Chat Streaming**: `POST /api/chat/stream` (SSE)
- **Sync Auth**: `POST /api/sync/auth`
- **Conversations**: `GET/POST /api/sync/conversations`
- **Memories**: `GET/POST /api/sync/memories`
- **Wallet Data**: `GET/PUT /api/sync/wallet`

## Sync with Mobile App

The web app shares data with the mobile app through the sync layer:

1. **User Identity**: Wallet address (no email/password)
2. **Conversations**: Stored server-side, synced across platforms
3. **Memories**: Embris's knowledge of the user, synced automatically
4. **Wallet Data**: Preferences and cached balances

To sync:
1. Create a wallet on web or mobile
2. Use the same wallet address on the other platform
3. Conversations and memories automatically appear

## Security Notes

- Private keys are **never** sent to the server
- Wallet addresses are used as user identity
- All blockchain interactions are client-side
- Seed phrases are shown only once during creation
- Use HTTPS in production

## Development Guidelines

### Adding a New Section

1. Create `app/sections/NewSection.tsx`:
   ```tsx
   'use client';

   export default function NewSection() {
     return (
       <div className="p-8">
         <h1 className="text-3xl font-bold text-embris-accent">New Section</h1>
       </div>
     );
   }
   ```

2. Add to `Sidebar.tsx` sections array

3. Update `app/page.tsx` to render the new section

### Styling

- Use Tailwind classes with `embris-*` color names
- Dark theme is always active (no light mode toggle)
- Responsive design: mobile-first approach
- Custom colors defined in `tailwind.config.js`

### API Calls

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Example: Fetch conversations
const response = await axios.get(`${API_URL}/api/sync/conversations`, {
  headers: {
    'x-wallet-address': walletAddress,
  },
});
```

## Testing

```bash
npm run type-check
```

## License

Proprietary — Vaultfire Protocol

## Support

For issues or questions, contact the Vaultfire team.
