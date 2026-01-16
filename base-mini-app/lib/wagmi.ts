import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required. ' +
    'Get your project ID from https://cloud.walletconnect.com'
  );
}

export const config = getDefaultConfig({
  appName: 'Vaultfire Base Mini App',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [base, baseSepolia],
  ssr: true,
});
