import React from 'react';
import { TerminalHeader } from '../../components/TerminalHeader';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TerminalHeader />
      <main style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', padding: '16px 20px 48px', flex: 1 }}>
        {children}
      </main>
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        color: 'var(--text-sub)',
        fontSize: '11px',
      }}>
        <span className="mono">SOLRADAR — Non-custodial signals only. Trade in your own wallet.</span>
        <span>Not financial advice. Never input private keys.</span>
      </footer>
    </div>
  );
}
