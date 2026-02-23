import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WalletAuthProvider } from './lib/WalletAuthContext';

export const metadata: Metadata = {
  title: 'Embris by Vaultfire — Decentralized AI Trust Protocol',
  description: 'Embris by Vaultfire: The unified AI trust protocol. XMTP messaging, x402 payments, VNS identity, and ZK proofs across Ethereum, Base, and Avalanche.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#09090B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#09090B', color: '#F4F4F5' }}>
        <WalletAuthProvider>
          {children}
        </WalletAuthProvider>
      </body>
    </html>
  );
}
