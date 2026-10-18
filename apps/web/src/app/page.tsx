'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTokens, getTradeDeepLinks } from '../lib/api';
import { RadarIcon, ShieldCheckIcon, BellIcon, ExternalLinkIcon } from '../components/icons';

import { TELEGRAM_BOT_URL } from '../lib/config';
import { TelegramLoginWidget } from '../components/TelegramLoginWidget';
import { getStoredToken } from '../lib/api';

export default function MarketingLandingPage() {
  const [previewTokens, setPreviewTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'required') {
        setLoginRequired(true);
      }
    }

    async function loadPreview() {
      try {
        const res = await getTokens({ limit: 6, sortBy: 'volume_5m', sortDir: 'desc' });
        setPreviewTokens(res.data || []);
      } catch {
        setPreviewTokens([]);
      } finally {
        setLoading(false);
      }
    }
    loadPreview();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Login Required Notice Banner */}
      {loginRequired && !isLoggedIn && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.15)',
          borderBottom: '1px solid var(--accent)',
          padding: '10px 20px',
          textAlign: 'center',
          color: '#c4b5fd',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <span>🔒</span>
          <span>Authentication Required — Sign in via Telegram below to enter the terminal.</span>
        </div>
      )}

      {/* Public Top Navigation */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-secondary)',
      }}>
        <Link href="/" className="wordmark">
          <span className="wordmark-mark">
            <RadarIcon size={14} />
          </span>
          <span>SolRadar</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="#features" className="nav-link">Features</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <Link href="/app/discover" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
            {isLoggedIn ? 'Go to Terminal →' : 'Launch Terminal'}
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '80px 20px 40px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span className="badge badge-hunter">Non-Custodial Intelligence</span>
          <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Real-time Solana Helius feed</span>
        </div>

        <h1 style={{
          fontSize: '48px',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: 'var(--text-main)',
          maxWidth: '840px',
          margin: '0 auto 18px',
        }}>
          Solana memecoin intelligence — <br />
          <span style={{ color: 'var(--accent)' }}>see it first, ape it yourself.</span>
        </h1>

        <p style={{
          fontSize: '17px',
          color: 'var(--text-muted)',
          maxWidth: '640px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          Zero trade execution. Zero custody. No private keys. High-velocity screener, live launch pulse, deterministic rug audits, and instant Telegram snipe signals.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <Link href="/app/discover" className="btn btn-primary" style={{ padding: '10px 22px', fontSize: '14px' }}>
            Launch Terminal ↗
          </Link>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ padding: '10px 22px', fontSize: '14px' }}
          >
            Get Telegram Alerts ↗
          </a>
        </div>

        {/* Telegram Quick-Login Container on Landing Page */}
        {!isLoggedIn && (
          <div style={{
            maxWidth: '380px',
            margin: '0 auto',
            padding: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
              Sign in with Telegram to sync alerts & watchlists:
            </div>
            <TelegramLoginWidget
              size="medium"
              onSuccess={() => {
                setIsLoggedIn(true);
                window.location.href = '/app/discover';
              }}
            />
          </div>
        )}
      </section>

      {/* Live-Feel Preview Strip (Real Data from Live API, Never Fake) */}
      <section style={{ maxWidth: '1280px', margin: '20px auto 60px', width: '100%', padding: '0 20px' }}>
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-header" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-safe">LIVE FEED SNAPSHOT</span>
              <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Real-time memecoin market activity</span>
            </div>
            <Link href="/app/discover" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              View all 50+ tokens in terminal →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-sub)' }}>
                Connecting to SolRadar live ingest engine...
              </div>
            ) : previewTokens.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
                No active token launches detected yet on this node.
              </div>
            ) : (
              <table className="screener-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Stage</th>
                    <th>Price</th>
                    <th>Market Cap</th>
                    <th>Liquidity</th>
                    <th>5m Vol</th>
                    <th>Risk Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTokens.map(({ token, snapshot, risk }) => {
                    const links = getTradeDeepLinks(token.mint);
                    return (
                      <tr key={token.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {token.imageUrl ? (
                              <img
                                src={token.imageUrl.startsWith('ipfs://') ? token.imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/') : token.imageUrl}
                                alt={token.symbol}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                              />
                            ) : null}
                            <span style={{ fontWeight: 800 }}>${token.symbol}</span>
                            <span style={{ color: 'var(--text-sub)', fontSize: '11px' }}>{token.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${snapshot.stage === 'migrated' ? 'badge-safe' : snapshot.stage === 'curve' ? 'badge-hunter' : 'badge-demo'}`}>
                            {snapshot.stage}
                          </span>
                        </td>
                        <td className="num-mono">${snapshot.price < 0.01 ? snapshot.price.toFixed(6) : snapshot.price.toFixed(2)}</td>
                        <td className="num-mono">${(snapshot.mcap / 1e6).toFixed(2)}M</td>
                        <td className="num-mono">${(snapshot.liquidityUsd / 1e3).toFixed(1)}k</td>
                        <td className="num-mono">${(snapshot.volume5m / 1e3).toFixed(1)}k</td>
                        <td>
                          <span className={`badge ${risk.riskScore < 30 ? 'badge-safe' : risk.riskScore < 70 ? 'badge-demo' : 'badge-risk'}`}>
                            {risk.riskScore}/100 {risk.confidence}
                          </span>
                        </td>
                        <td>
                          <a
                            href={links.jupiter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            Trade ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto 80px', padding: '0 20px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="section-title" style={{ fontSize: '28px' }}>Engineered for Solana Traders</h2>
          <p className="section-sub">Axiom-grade data density with zero custody risks.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: '16px' }}>
              <RadarIcon size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Discover Screener</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Sortable, filterable real-time market scanner with multi-timeframe volume, sparklines, liquidity depth, and holder concentration analysis.
            </p>
          </div>

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: '16px' }}>
              <BellIcon size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Pulse Launch Feed</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Chronological live stream of new Pump.fun and Raydium launches. Pause-on-scroll ergonomics, relative age tickers, and instant safety pills.
            </p>
          </div>

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: '16px' }}>
              <ShieldCheckIcon size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Deterministic Rug Audits</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              On-chain mint authority revocation, freeze authority checks, LP burn verification, dev allocation tracking, and top-10 concentration flags.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" style={{ maxWidth: '960px', margin: '0 auto 80px', padding: '0 20px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 className="section-title" style={{ fontSize: '28px' }}>Simple, Non-Custodial Subscriptions</h2>
          <p className="section-sub">No trade execution fees. Signals and intelligence only.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Scout Tier */}
          <div className="panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 800, fontSize: '16px' }}>Scout</span>
              <span className="badge badge-scout">Core Tier</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>
              $50 <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-sub)' }}>/ month</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              For active traders screening trending memecoins.
            </p>
            <ul style={{ listStyle: 'none', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', flex: 1 }}>
              <li>✓ Full Discovery screener access</li>
              <li>✓ Real-time Pulse launch feed</li>
              <li>✓ Basic deterministic rug audits</li>
              <li>✓ Track 1 smart wallet</li>
            </ul>
            <Link href="/app/billing" className="btn btn-secondary" style={{ width: '100%', padding: '9px' }}>
              Select Scout Plan
            </Link>
          </div>

          {/* Hunter Tier */}
          <div className="panel" style={{ padding: '28px', border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--accent)' }}>Hunter</span>
              <span className="badge badge-hunter">Pro Signals</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>
              $100 <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-sub)' }}>/ month</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Maximum speed alerts and deep forensic diagnostics.
            </p>
            <ul style={{ listStyle: 'none', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', flex: 1 }}>
              <li>✓ Sub-2s Telegram snipe alerts</li>
              <li>✓ Unlimited custom snipe rules</li>
              <li>✓ Track up to 10 smart wallets</li>
              <li>✓ Copy-signals real-time alerts</li>
              <li>✓ Priority RPC streaming feed</li>
            </ul>
            <Link href="/app/billing" className="btn btn-primary" style={{ width: '100%', padding: '9px' }}>
              Go Hunter Plan
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '24px',
        background: 'var(--bg-secondary)',
        marginTop: 'auto',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-sub)',
        }}>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>SolRadar</strong> — Solana Memecoin Intelligence Terminal.
          </div>
          <div>
            Not financial advice. SolRadar never touches your keys.
          </div>
        </div>
      </footer>
    </div>
  );
}
