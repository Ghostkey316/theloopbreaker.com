import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Vaultfire | Prove Your Beliefs on Base',
  description: 'Privacy-first belief attestation with zero-knowledge proofs on Base blockchain',
  keywords: ['Base', 'blockchain', 'zero-knowledge', 'privacy', 'beliefs', 'attestation'],
  openGraph: {
    title: 'Vaultfire | Prove Your Beliefs on Base',
    description: 'Privacy-first belief attestation with zero-knowledge proofs',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
