import React from 'react';
import { TerminalHeader } from '../../components/TerminalHeader';
import { AppGuard } from '../../components/AppGuard';
import { AxiomBottomDock } from '../../components/AxiomBottomDock';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '44px' }}>
      <TerminalHeader />
      <main style={{ maxWidth: '1440px', margin: '0 auto', width: '100%', padding: '16px 20px 48px', flex: 1 }}>
        <AppGuard>{children}</AppGuard>
      </main>
      <AxiomBottomDock />
    </div>
  );
}
