'use client';

import React, { useState } from 'react';

interface ScreenerToken {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  mcap: number;
  liquidity: number;
  vol5m: number;
  vol1h: number;
  vol24h: number;
  buys: number;
  sells: number;
  holders: number;
  top10Pct: number;
  devHoldingPct: number;
  mintRevoked: boolean;
  freezeRevoked: boolean;
  lpBurned: number;
  riskScore: number;
  momentumScore: number;
  stage: 'new' | 'curve' | 'migrated';
}

const INITIAL_TOKENS: ScreenerToken[] = [
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    price: 0.0000214,
    mcap: 1450000000,
    liquidity: 18500000,
    vol5m: 125000,
    vol1h: 1800000,
    vol24h: 34000000,
    buys: 420,
    sells: 310,
    holders: 780000,
    top10Pct: 18.5,
    devHoldingPct: 0.1,
    mintRevoked: true,
    freezeRevoked: true,
    lpBurned: 100,
    riskScore: 0,
    momentumScore: 82,
    stage: 'migrated',
  },
  {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    price: 2.38,
    mcap: 2380000000,
    liquidity: 32000000,
    vol5m: 280000,
    vol1h: 3100000,
    vol24h: 85000000,
    buys: 680,
    sells: 590,
    holders: 195000,
    top10Pct: 22.1,
    devHoldingPct: 0.0,
    mintRevoked: true,
    freezeRevoked: true,
    lpBurned: 100,
    riskScore: 0,
    momentumScore: 89,
    stage: 'migrated',
  },
  {
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'Popcat',
    price: 1.42,
    mcap: 1390000000,
    liquidity: 14200000,
    vol5m: 95000,
    vol1h: 1200000,
    vol24h: 22000000,
    buys: 310,
    sells: 280,
    holders: 92000,
    top10Pct: 26.4,
    devHoldingPct: 0.0,
    mintRevoked: true,
    freezeRevoked: true,
    lpBurned: 100,
    riskScore: 0,
    momentumScore: 74,
    stage: 'migrated',
  },
  {
    mint: 'CurveLaunchPulseTest1111111111111111111111111',
    symbol: 'SOLPEPE',
    name: 'Solana Pepe',
    price: 0.00041,
    mcap: 410000,
    liquidity: 38000,
    vol5m: 14500,
    vol1h: 88000,
    vol24h: 195000,
    buys: 110,
    sells: 42,
    holders: 890,
    top10Pct: 38.2,
    devHoldingPct: 2.5,
    mintRevoked: true,
    freezeRevoked: true,
    lpBurned: 75,
    riskScore: 15,
    momentumScore: 88,
    stage: 'curve',
  },
  {
    mint: 'DangerousRugRiskTest2222222222222222222222222',
    symbol: 'HONEYPOT',
    name: 'Fake Pump Token',
    price: 0.000012,
    mcap: 12000,
    liquidity: 1800,
    vol5m: 400,
    vol1h: 800,
    vol24h: 1200,
    buys: 2,
    sells: 12,
    holders: 14,
    top10Pct: 78.5,
    devHoldingPct: 15.0,
    mintRevoked: false,
    freezeRevoked: false,
    lpBurned: 0,
    riskScore: 85,
    momentumScore: 12,
    stage: 'new',
  },
];

export default function DiscoverPage() {
  const [tokens] = useState<ScreenerToken[]>(INITIAL_TOKENS);
  const [stageFilter, setStageFilter] = useState<'all' | 'new' | 'curve' | 'migrated'>('all');
  const [minLiquidity, setMinLiquidity] = useState<number>(0);
  const [mintRevokedOnly, setMintRevokedOnly] = useState<boolean>(false);

  const filteredTokens = tokens.filter((t) => {
    if (stageFilter !== 'all' && t.stage !== stageFilter) return false;
    if (t.liquidity < minLiquidity) return false;
    if (mintRevokedOnly && !t.mintRevoked) return false;
    return true;
  });

  return (
    <div>
      {/* Title & Filter Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Discovery Screener
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Live token screener with real-time liquidity, volume velocity, and deterministic risk scoring.
          </p>
        </div>

        {/* Stage Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
          {(['all', 'new', 'curve', 'migrated'] as const).map((stage) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              style={{
                background: stageFilter === stage ? 'var(--bg-card)' : 'transparent',
                color: stageFilter === stage ? '#fff' : 'var(--text-muted)',
                border: stageFilter === stage ? '1px solid var(--border-color)' : 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {stage === 'all' ? 'All Tokens' : stage === 'curve' ? 'Bonding Curve' : stage}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Presets Bar */}
      <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '18px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Min Liquidity:</span>
          <select
            value={minLiquidity}
            onChange={(e) => setMinLiquidity(Number(e.target.value))}
            style={{
              background: 'var(--bg-secondary)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <option value="0">Any Liquidity</option>
            <option value="5000">&gt; $5,000</option>
            <option value="20000">&gt; $20,000</option>
            <option value="100000">&gt; $100,000</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mintRevokedOnly}
            onChange={(e) => setMintRevokedOnly(e.target.checked)}
          />
          <span>Mint Authority Revoked Only</span>
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }}></span>
          <span>Feed auto-updates live via Helius stream</span>
        </div>
      </div>

      {/* Screener Table */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Price</th>
              <th>5m Vol</th>
              <th>1h Vol</th>
              <th>Market Cap</th>
              <th>Liquidity</th>
              <th>Txns (B/S)</th>
              <th>Top 10 Supply</th>
              <th>Dev %</th>
              <th>Safety Flags</th>
              <th>Momentum</th>
              <th>Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredTokens.map((t) => (
              <tr key={t.mint} onClick={() => window.location.href = `/tokens/${t.mint}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1e293b 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '11px',
                    }}>
                      {t.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#fff' }}>${t.symbol}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{t.name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  ${t.price < 0.001 ? t.price.toFixed(7) : t.price.toFixed(3)}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>${t.vol5m.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>${t.vol1h.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                  ${t.mcap >= 1e9 ? `${(t.mcap / 1e9).toFixed(2)}B` : t.mcap >= 1e6 ? `${(t.mcap / 1e6).toFixed(1)}M` : `${(t.mcap / 1e3).toFixed(0)}K`}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  ${t.liquidity >= 1e6 ? `${(t.liquidity / 1e6).toFixed(1)}M` : `${(t.liquidity / 1e3).toFixed(0)}K`}
                </td>
                <td>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>{t.buys}</span> /{' '}
                  <span style={{ color: 'var(--accent-danger)' }}>{t.sells}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="top10-bar-container">
                      <div style={{
                        width: `${Math.min(100, t.top10Pct)}%`,
                        background: t.top10Pct >= 50 ? 'var(--accent-danger)' : t.top10Pct >= 35 ? 'var(--accent-warning)' : 'var(--accent-emerald)'
                      }}></div>
                    </div>
                    <span style={{ fontSize: '11px', color: t.top10Pct >= 50 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                      {t.top10Pct}%
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ color: t.devHoldingPct > 5 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                    {t.devHoldingPct.toFixed(1)}%
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span className={t.mintRevoked ? 'badge badge-safe' : 'badge badge-risk'}>
                      {t.mintRevoked ? 'Mint Revoked' : 'Mint Active'}
                    </span>
                    <span className={t.freezeRevoked ? 'badge badge-safe' : 'badge badge-risk'}>
                      {t.freezeRevoked ? 'Freeze Revoked' : 'Freeze Active'}
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: '700', color: t.momentumScore >= 70 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                    {t.momentumScore}/100
                  </div>
                </td>
                <td>
                  <span className={t.riskScore >= 70 ? 'badge badge-risk' : t.riskScore >= 30 ? 'badge badge-demo' : 'badge badge-safe'}>
                    {t.riskScore}/100
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
