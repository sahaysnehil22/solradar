'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, getMe, logoutUser, UserSession } from '../lib/api';
import { RadarIcon } from './icons';
import { TelegramLoginWidget } from './TelegramLoginWidget';

export function TerminalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial cached state
    setUser(getStoredUser());

    // 2. Validate session against backend /api/auth/me
    getMe().then((verifiedUser) => {
      setUser(verifiedUser);
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setMenuOpen(false);
    router.push('/');
  };

  const initials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'ST';

  return (
    <>
      {/* Top System Status Strip */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        padding: '5px 18px',
        fontSize: '11px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-demo">Test Mode</span>
          <span>Zero charges • Non-custodial signals only</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }} className="mono">
          <span>SOL <strong className="num-up">CONNECTED</strong></span>
          <span>HELIUS RPC <strong className="num-up">HEALTHY</strong></span>
          <span>QUEUE <strong className="num-up">IDLE</strong></span>
        </div>
      </div>

      {/* Main Terminal Header */}
      <header className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Logo strictly navigates to marketing landing page / */}
          <Link href="/" className="wordmark" title="SolRadar Home">
            <span className="wordmark-mark">
              <RadarIcon size={14} />
            </span>
            <span>SolRadar</span>
          </Link>

          <nav style={{ display: 'flex', gap: '2px' }}>
            <Link href="/app/discover" className={`nav-link ${pathname === '/app/discover' ? 'active' : ''}`}>
              Discover
            </Link>
            <Link href="/app/pulse" className={`nav-link ${pathname === '/app/pulse' ? 'active' : ''}`}>
              Pulse
            </Link>
            <Link href="/app/snipe" className={`nav-link ${pathname === '/app/snipe' ? 'active' : ''}`}>
              Snipe Alerts
            </Link>
            <Link href="/app/wallets" className={`nav-link ${pathname === '/app/wallets' ? 'active' : ''}`}>
              Smart Wallets
            </Link>
            <Link href="/app/portfolio" className={`nav-link ${pathname === '/app/portfolio' ? 'active' : ''}`}>
              Portfolio
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/app/referrals" className={`nav-link ${pathname === '/app/referrals' ? 'active' : ''}`}>
            Referrals
          </Link>

          <Link href="/app/billing" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            {user?.plan === 'hunter' ? 'Hunter Active' : 'Go Hunter'}
          </Link>

          {/* Account Profile Dropdown (Active & Functional) */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => {
                if (!user) {
                  setLoginModalOpen(true);
                } else {
                  setMenuOpen(!menuOpen);
                }
              }}
              className="btn btn-secondary"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: '12px',
                background: user ? 'var(--accent-dim)' : 'var(--bg-card)',
                borderColor: user ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-color)',
                color: user ? '#c4b5fd' : 'var(--text-main)',
              }}
              title={user ? `${user.username || user.email} (${user.plan.toUpperCase()})` : 'Connect / Sign In'}
            >
              {initials}
            </button>

            {menuOpen && user && (
              <div className="dropdown-menu">
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                    {user.username || 'Trader'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }} className="mono">
                    {user.email}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`badge badge-${user.plan === 'hunter' ? 'hunter' : 'scout'}`}>
                      {user.plan} tier
                    </span>
                  </div>
                </div>

                <Link
                  href="/app/portfolio"
                  className="dropdown-item"
                  onClick={() => setMenuOpen(false)}
                >
                  My Portfolio
                </Link>

                <Link
                  href="/app/referrals"
                  className="dropdown-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Referral Discounts
                </Link>

                <Link
                  href="/app/billing"
                  className="dropdown-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Subscription & Billing
                </Link>

                <div className="divider" style={{ margin: '4px 0' }} />

                <button
                  onClick={handleLogout}
                  className="dropdown-item"
                  style={{ color: 'var(--down)' }}
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Telegram Quick-Login Modal */}
      {loginModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="panel" style={{ width: '400px', maxWidth: '90vw' }}>
            <div className="panel-header">
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Sign in to SolRadar</span>
              <button
                onClick={() => setLoginModalOpen(false)}
                className="btn btn-ghost"
                style={{ padding: '2px 6px', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Connect via Telegram for instant alerts and synced watchlist signals. No passwords required.
              </p>

              <TelegramLoginWidget
                onSuccess={(authedUser) => {
                  setUser(authedUser);
                  setLoginModalOpen(false);
                }}
              />

              <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-sub)' }}>
                Non-custodial intelligence. We never request private keys.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
