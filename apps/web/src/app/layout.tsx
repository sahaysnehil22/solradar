import './globals.css';
import React from 'react';

export const metadata = {
  title: 'SolRadar — Real-Time Solana Memecoin Intelligence Terminal',
  description: 'Pro screener, live launch pulse, deterministic rug audit flags, and smart-money signals.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Test Mode Notification Banner */}
        <div style={{
          background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
          borderBottom: '1px solid #334155',
          padding: '6px 16px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#94a3b8'
        }}>
          <div>
            <span className="badge badge-demo" style={{ marginRight: '8px' }}>Test Billing Active</span>
            <span>Zero charges during MVP testing • Pluggable Stripe architecture active</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
            <span>Solana Mainnet: <strong style={{ color: '#10b981' }}>Connected (Helius)</strong></span>
            <span>RPC Budget: <strong style={{ color: '#00f2fe' }}>Healthy</strong></span>
          </div>
        </div>

        {/* Terminal Header */}
        <header className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #00f2fe 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
                fontWeight: '900',
                fontSize: '18px'
              }}>
                ⚡
              </div>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>
                Sol<span style={{ color: '#00f2fe' }}>Radar</span>
              </span>
            </a>

            <nav style={{ display: 'flex', gap: '6px' }}>
              <a href="/" className="nav-link active">Discover</a>
              <a href="/pulse" className="nav-link">Pulse Feed</a>
              <a href="/wallets" className="nav-link">Smart Wallets</a>
              <a href="/portfolio" className="nav-link">Portfolio</a>
              <a href="/billing" className="nav-link">Plans & Billing</a>
              <a href="/referrals" className="nav-link">Referrals</a>
              <a href="/admin" className="nav-link">Admin</a>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-hunter">Hunter Tier Active</span>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#1e293b',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ST
            </div>
          </div>
        </header>

        {/* Main Terminal Body */}
        <main style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
