import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

// In simulation/build mode, use a placeholder project ID.
// The wallet connection UI will still render but won't connect without a real ID.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'SIMULATION_MODE';

export const config = getDefaultConfig({
  appName: 'Vaultfire Base Mini App',
  projectId,
  chains: [base, baseSepolia],
  ssr: true,
});
