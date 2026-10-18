import './globals.css';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SolRadar — Solana Memecoin Intelligence Terminal',
  description: 'Live token screener, pulse launch feed, deterministic rug audits, and smart-money signals. Non-custodial intelligence only.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
