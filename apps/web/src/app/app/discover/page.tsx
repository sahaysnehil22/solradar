'use client';

import React, { useState, useEffect } from 'react';
import { getTokens, getTradeDeepLinks } from '../../../lib/api';
import { SparklineSvg, SearchIcon, ShieldCheckIcon, AlertTriangleIcon, ExternalLinkIcon, CopyIcon, CheckIcon } from '../../../components/icons';

export default function DiscoverPage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters & State
  const [stage, setStage] = useState<'all' | 'new' | 'curve' | 'migrated'>('all');
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '30m' | '1h' | '24h'>('5m');
  const [search, setSearch] = useState('');
  const [minLiquidity, setMinLiquidity] = useState<number | undefined>(undefined);
  const [maxRisk, setMaxRisk] = useState<number | undefined>(undefined);
  const [mintRevokedOnly, setMintRevokedOnly] = useState(false);
  const [freezeRevokedOnly, setFreezeRevokedOnly] = useState(false);

  // Selected Token for Detail Drawer
  const [selectedToken, setSelectedToken] = useState<any | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const fetchTokensList = async () => {
    try {
      const sortBy = timeRange === '24h' ? 'volume_24h' : timeRange === '1h' ? 'volume_1h' : 'volume_5m';
      const res = await getTokens({
        stage,
        sortBy,
        sortDir: 'desc',
        search: search.trim() || undefined,
        minLiquidity,
        maxRiskScore: maxRisk,
        mintAuthRevokedOnly: mintRevokedOnly || undefined,
        freezeAuthRevokedOnly: freezeRevokedOnly || undefined,
        limit: 100,
        offset: 0,
      });
      setTokens(res.data || []);
      setTotalCount(res.total || 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokensList();
    const interval = setInterval(fetchTokensList, 10000);
    return () => clearInterval(interval);
  }, [stage, timeRange, search, minLiquidity, maxRisk, mintRevokedOnly, freezeRevokedOnly]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMint(text);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Filter and Timeframe Bar */}
      <div className="panel" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-sub)' }}>
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Search symbol, name, or mint..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
          </div>

          {/* Timeframe selector (re-sorts volume) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginRight: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
              Timeframe:
            </span>
            {(['1m', '5m', '30m', '1h', '24h'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`btn btn-sm ${timeRange === t ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Stage Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginRight: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
              Stage:
            </span>
            {(['all', 'new', 'curve', 'migrated'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`btn btn-sm ${stage === s ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '11px', textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Live Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-sub)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--up)', display: 'inline-block' }} />
            <span className="mono">LIVE • {lastUpdated.toLocaleTimeString()}</span>
            <span className="badge badge-scout">{totalCount} tokens</span>
          </div>
        </div>

        {/* Second Row: Security & Liquidity Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', fontSize: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={mintRevokedOnly}
              onChange={(e) => setMintRevokedOnly(e.target.checked)}
            />
            <span>Mint Revoked Only</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={freezeRevokedOnly}
              onChange={(e) => setFreezeRevokedOnly(e.target.checked)}
            />
            <span>Freeze Revoked Only</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-sub)' }}>Min Liquidity:</span>
            <select
              value={minLiquidity ?? ''}
              onChange={(e) => setMinLiquidity(e.target.value ? Number(e.target.value) : undefined)}
              className="select"
              style={{ padding: '3px 8px', fontSize: '12px' }}
            >
              <option value="">Any Liquidity</option>
              <option value="5000">&gt; $5,000</option>
              <option value="20000">&gt; $20,000</option>
              <option value="50000">&gt; $50,000</option>
              <option value="100000">&gt; $100,000</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-sub)' }}>Max Risk:</span>
            <select
              value={maxRisk ?? ''}
              onChange={(e) => setMaxRisk(e.target.value ? Number(e.target.value) : undefined)}
              className="select"
              style={{ padding: '3px 8px', fontSize: '12px' }}
            >
              <option value="">Any Risk Score</option>
              <option value="30">&lt; 30 (Safe Only)</option>
              <option value="50">&lt; 50 (Moderate)</option>
              <option value="70">&lt; 70 (Exclude Degens)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Discover Screener Table (>=50 Tokens from Live API) */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
          <table className="screener-table">
            <thead>
              <tr>
                <th>Pair / Token</th>
                <th>Price</th>
                <th>Market Cap</th>
                <th>Liquidity</th>
                <th>Volume ({timeRange})</th>
                <th>TXNS (5m)</th>
                <th>Top 10 / Dev</th>
                <th>Security Flags</th>
                <th>Trend</th>
                <th>Risk Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && tokens.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
                    Loading token intelligence matrix...
                  </td>
                </tr>
              ) : tokens.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
                    No tokens match your filters.
                  </td>
                </tr>
              ) : (
                tokens.map(({ token, snapshot, risk, sparkline }) => {
                  const links = getTradeDeepLinks(token.mint);
                  const isSafe = risk.riskScore < 30;
                  const isModerate = risk.riskScore >= 30 && risk.riskScore < 70;

                  return (
                    <tr
                      key={token.id}
                      onClick={() => setSelectedToken({ token, snapshot, risk, sparkline })}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Pair Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--radius)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '11px',
                            color: 'var(--accent)',
                          }}>
                            {token.symbol.substring(0, 3)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '13px' }}>
                              ${token.symbol}
                              <span className={`badge ${snapshot.stage === 'migrated' ? 'badge-safe' : snapshot.stage === 'curve' ? 'badge-hunter' : 'badge-demo'}`} style={{ marginLeft: '6px', fontSize: '9px', padding: '1px 5px' }}>
                                {snapshot.stage}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                              {token.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="num-mono" style={{ fontWeight: 600 }}>
                        ${snapshot.price < 0.001 ? snapshot.price.toFixed(6) : snapshot.price.toFixed(3)}
                      </td>

                      {/* Market Cap */}
                      <td className="num-mono">
                        ${snapshot.mcap >= 1e6 ? `${(snapshot.mcap / 1e6).toFixed(2)}M` : `${(snapshot.mcap / 1e3).toFixed(1)}k`}
                      </td>

                      {/* Liquidity */}
                      <td className="num-mono">
                        ${(snapshot.liquidityUsd / 1e3).toFixed(1)}k
                      </td>

                      {/* Dynamic Volume based on timeRange */}
                      <td className="num-mono">
                        ${timeRange === '24h'
                          ? (snapshot.volume24h / 1e3).toFixed(1) + 'k'
                          : timeRange === '1h'
                          ? (snapshot.volume1h / 1e3).toFixed(1) + 'k'
                          : (snapshot.volume5m / 1e3).toFixed(1) + 'k'}
                      </td>

                      {/* TXNS buys / sells */}
                      <td className="num-mono" style={{ fontSize: '11px' }}>
                        <span className="num-up">{snapshot.buys}B</span> / <span className="num-down">{snapshot.sells}S</span>
                      </td>

                      {/* Top 10 & Dev holding */}
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>T10: <strong className={snapshot.top10Pct > 50 ? 'num-down' : ''}>{snapshot.top10Pct.toFixed(1)}%</strong></span>
                          <span style={{ marginLeft: '6px', color: 'var(--text-sub)' }}>Dev: {snapshot.devHoldingPct.toFixed(1)}%</span>
                        </div>
                      </td>

                      {/* Security Flags */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span className={`badge ${snapshot.mintAuthRevoked ? 'badge-safe' : 'badge-risk'}`} title="Mint Authority">
                            {snapshot.mintAuthRevoked ? 'M:Rev' : 'M:Active'}
                          </span>
                          <span className={`badge ${snapshot.freezeAuthRevoked ? 'badge-safe' : 'badge-risk'}`} title="Freeze Authority">
                            {snapshot.freezeAuthRevoked ? 'F:Rev' : 'F:Active'}
                          </span>
                        </div>
                      </td>

                      {/* Inline Sparkline */}
                      <td>
                        <SparklineSvg data={sparkline} width={64} height={18} isUp={snapshot.buys >= snapshot.sells} />
                      </td>

                      {/* Risk Score */}
                      <td>
                        <span className={`badge ${isSafe ? 'badge-safe' : isModerate ? 'badge-demo' : 'badge-risk'}`} style={{ fontWeight: 800 }}>
                          {risk.riskScore}/100
                        </span>
                      </td>

                      {/* Non-Custodial Actions: Copy CA & External Deep-Links */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => copyToClipboard(token.mint)}
                            className="btn btn-ghost btn-sm"
                            title="Copy Contract Address"
                            style={{ padding: '3px 6px' }}
                          >
                            {copiedMint === token.mint ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                          </button>

                          <a
                            href={links.jupiter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            title="Trade in external wallet"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            Trade ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Detail Drawer Modal (Opens on row click) */}
      {selectedToken && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000,
        }} onClick={() => setSelectedToken(null)}>
          <div
            className="panel"
            style={{
              width: '480px',
              maxWidth: '92vw',
              height: '100%',
              borderRadius: 0,
              borderLeft: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 800, fontSize: '16px' }}>${selectedToken.token.symbol}</span>
                <span className="badge badge-hunter">{selectedToken.snapshot.stage}</span>
              </div>
              <button onClick={() => setSelectedToken(null)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Contract Address (CA)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="mono" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {selectedToken.token.mint}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedToken.token.mint)}
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    {copiedMint === selectedToken.token.mint ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Key Diagnostics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="panel" style={{ padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Market Cap</div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }} className="num-mono">
                    ${(selectedToken.snapshot.mcap / 1e3).toFixed(1)}k
                  </div>
                </div>

                <div className="panel" style={{ padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Liquidity</div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }} className="num-mono">
                    ${(selectedToken.snapshot.liquidityUsd / 1e3).toFixed(1)}k
                  </div>
                </div>

                <div className="panel" style={{ padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>5m Volume</div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }} className="num-mono">
                    ${(selectedToken.snapshot.volume5m / 1e3).toFixed(1)}k
                  </div>
                </div>

                <div className="panel" style={{ padding: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Holders</div>
                  <div style={{ fontSize: '15px', fontWeight: 800 }} className="num-mono">
                    {selectedToken.snapshot.holderCount}
                  </div>
                </div>
              </div>

              {/* Deterministic Risk Flags */}
              <div className="panel" style={{ padding: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>
                  Deterministic Rug Audit ({selectedToken.risk.riskScore}/100)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mint Authority:</span>
                    <strong className={selectedToken.snapshot.mintAuthRevoked ? 'num-up' : 'num-down'}>
                      {selectedToken.snapshot.mintAuthRevoked ? 'Revoked (Safe)' : 'Active (High Risk)'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Freeze Authority:</span>
                    <strong className={selectedToken.snapshot.freezeAuthRevoked ? 'num-up' : 'num-down'}>
                      {selectedToken.snapshot.freezeAuthRevoked ? 'Revoked (Safe)' : 'Active (Blacklist Risk)'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>LP Status:</span>
                    <strong className={selectedToken.snapshot.lpBurnedOrLockedPct >= 90 ? 'num-up' : 'num-down'}>
                      {selectedToken.snapshot.lpBurnedOrLockedPct}% Burned / Locked
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Top 10 Supply Share:</span>
                    <strong>{selectedToken.snapshot.top10Pct.toFixed(1)}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Developer Allocation:</span>
                    <strong>{selectedToken.snapshot.devHoldingPct.toFixed(1)}%</strong>
                  </div>
                </div>
              </div>

              {/* External Execution Deep Links */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '8px' }}>
                  Manual Execution (Trade in your own wallet):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).axiom}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    Axiom Terminal ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).bullx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    BullX ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).photon}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    Photon ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).jupiter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '12px' }}
                  >
                    Jupiter ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
