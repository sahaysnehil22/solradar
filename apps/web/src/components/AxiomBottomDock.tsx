'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AxiomBottomDock() {
  const pathname = usePathname();

  return (
    <div className="axiom-dock">
      {/* Left controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            fontSize: '10px',
            letterSpacing: '0.04em',
          }}
        >
          SET 1
        </span>

        <button
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Presets"
        >
          <span>🗂</span>
          <span className="mono" style={{ color: 'var(--text-muted)' }}>1</span>
          <span>🗃</span>
          <span className="mono" style={{ color: 'var(--text-muted)' }}>0 ▾</span>
        </button>

        <button
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          title="Terminal Settings"
        >
          ⚙
        </button>
      </div>

      {/* Center tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <Link
          href="/app/wallets"
          className={`axiom-dock-tab ${pathname === '/app/wallets' ? 'active' : ''}`}
        >
          <span>💼</span>
          <span>Wallet</span>
        </Link>

        <span
          className="axiom-dock-tab"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://twitter.com', '_blank')}
        >
          <span>𝕏</span>
          <span>Social</span>
        </span>

        <Link
          href="/app/discover"
          className={`axiom-dock-tab ${pathname === '/app/discover' ? 'active' : ''}`}
        >
          <span>🧭</span>
          <span>Discover</span>
        </Link>

        <Link
          href="/app/pulse"
          className={`axiom-dock-tab ${pathname === '/app/pulse' ? 'active' : ''}`}
        >
          <span>⚡</span>
          <span>Pulse</span>
        </Link>

        <Link
          href="/app/portfolio"
          className={`axiom-dock-tab ${pathname === '/app/portfolio' ? 'active' : ''}`}
        >
          <span>📊</span>
          <span>PnL</span>
        </Link>

        <Link
          href="/app/referrals"
          className={`axiom-dock-tab ${pathname === '/app/referrals' ? 'active' : ''}`}
        >
          <span>👥</span>
          <span>Friends</span>
        </Link>

        <span className="axiom-dock-tab" style={{ opacity: 0.6 }}>
          <span>📺</span>
          <span>Streams</span>
        </span>

        <Link
          href="/app/snipe"
          className={`axiom-dock-tab ${pathname === '/app/snipe' ? 'active' : ''}`}
        >
          <span>📢</span>
          <span>Callouts</span>
        </Link>

        <span className="axiom-dock-tab" style={{ opacity: 0.6 }}>
          <span>🗗</span>
          <span>Pop-out</span>
        </span>
      </nav>

      {/* Right status & balances */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span title="Pump.fun" style={{ fontSize: '11px', cursor: 'pointer' }}>💊</span>
          <span title="Raydium" style={{ fontSize: '11px', cursor: 'pointer' }}>⚡</span>
          <span title="Jupiter" style={{ fontSize: '11px', cursor: 'pointer' }}>🪐</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }} className="mono">
          <span style={{ color: '#10b981', fontWeight: 700 }}>$102.59</span>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>$717</span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>$78.08</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#10b981',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>AUTO ▾</span>
        </div>

        <span style={{ color: 'var(--text-sub)', cursor: 'pointer', fontSize: '12px' }} title="Split View">
          🗔
        </span>
      </div>
    </div>
  );
}
