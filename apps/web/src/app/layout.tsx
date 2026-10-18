import './globals.css';
import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SolRadar — Solana Memecoin Intelligence',
  description: 'Live screener, launch pulse, rug audits, and smart-money signals.',
};

function RadarMark() {
  return (
    <span className="wordmark-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="#0c0e12" stroke="none" />
        <line x1="12" y1="12" x2="18" y2="6" />
      </svg>
    </span>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Status strip */}
        <div style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '6px 20px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-demo">Test mode</span>
            <span>No charges while testing</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }} className="mono">
            <span>SOL <strong className="num-up">connected</strong></span>
            <span>RPC <strong className="num-up">healthy</strong></span>
          </div>
        </div>

        {/* Header */}
        <header className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <Link href="/" className="wordmark">
              <RadarMark />
              SolRadar
            </Link>
            <nav style={{ display: 'flex', gap: '4px' }}>
              <Link href="/" className="nav-link active">Discover</Link>
              <Link href="/pulse" className="nav-link">Pulse</Link>
              <Link href="/tokens" className="nav-link">Tokens</Link>
              <Link href="/wallets" className="nav-link">Wallets</Link>
              <Link href="/portfolio" className="nav-link">Portfolio</Link>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/referrals" className="nav-link">Referrals</Link>
            <Link href="/billing" className="btn btn-primary" style={{ padding: '7px 14px' }}>Go Hunter</Link>
          </div>
        </header>

        <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 64px' }}>
          {children}
        </main>

        <footer style={{
          borderTop: '1px solid var(--border-color)',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1440px',
          margin: '0 auto',
          color: 'var(--text-sub)',
          fontSize: '12px',
        }}>
          <span className="mono">SOLRADAR — signals only. You trade in your own wallet.</span>
          <span>Not financial advice.</span>
        </footer>
      </body>
    </html>
  );
}
