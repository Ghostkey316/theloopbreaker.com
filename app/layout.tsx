import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vaultfire Protocol — Powered by Ember AI',
  description: 'Decentralized blockchain protocol management with Ember AI guidance. Morals over metrics. Privacy over surveillance. Freedom over control.',
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
      <body className="bg-ember-bg text-ember-text">
        {children}
      </body>
    </html>
  );
}
