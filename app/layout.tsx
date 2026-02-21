import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Embris — Powered by Vaultfire Protocol',
  description: 'Your ethical AI companion. Decentralized trust infrastructure across Base and Avalanche.',
  icons: {
    icon: '/favicon.ico',
  },
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
        {children}
      </body>
    </html>
  );
}
