import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Vaultfire | Prove Your Beliefs on Base',
  description: 'Privacy-first belief attestation with zero-knowledge proofs on Base blockchain',
  keywords: ['Base', 'blockchain', 'zero-knowledge', 'privacy', 'beliefs', 'attestation', 'RISC Zero', 'STARK'],
  authors: [{ name: 'Vaultfire Protocol' }],
  creator: 'Vaultfire Protocol',
  publisher: 'Vaultfire Protocol',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Vaultfire | Prove Your Beliefs on Base',
    description: 'Privacy-first belief attestation with zero-knowledge proofs',
    type: 'website',
    locale: 'en_US',
    siteName: 'Vaultfire',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaultfire | Prove Your Beliefs on Base',
    description: 'Privacy-first belief attestation with zero-knowledge proofs',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vaultfire',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
