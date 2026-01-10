import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Vaultfire | The Trust Layer for Base',
  description: 'The complete trust infrastructure for reputation, identity, credibility, and governance. Verify any claim with zero-knowledge proofs on Base. Production-ready SDK. Post-quantum secure.',
  keywords: [
    'Base',
    'blockchain',
    'zero-knowledge',
    'privacy',
    'attestation',
    'RISC Zero',
    'STARK',
    'trust layer',
    'reputation',
    'identity',
    'governance',
    'DeFi',
    'credentials',
    'SDK',
    'TypeScript',
    'post-quantum',
  ],
  authors: [{ name: 'Vaultfire Protocol' }],
  creator: 'Vaultfire Protocol',
  publisher: 'Vaultfire Protocol',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Vaultfire | The Trust Layer for Base',
    description: 'The complete trust infrastructure for reputation, identity, credibility, and governance. Verify any claim with zero-knowledge proofs. ~61k gas. <2s proofs. Post-quantum secure.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Vaultfire',
    url: 'https://vaultfire.base.org',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vaultfire - The Trust Layer for Base',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaultfire | The Trust Layer for Base',
    description: 'Verify any claim with zero-knowledge proofs. ~61k gas. <2s proofs. Post-quantum secure. Production SDK for Base.',
    images: ['/og-image.png'],
    creator: '@Vaultfire',
    site: '@Vaultfire',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vaultfire',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add Google Search Console verification when available
    // google: 'verification-code',
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
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
