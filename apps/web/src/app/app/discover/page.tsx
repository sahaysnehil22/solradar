'use client';

import React, { useState, useEffect } from 'react';
import { getTokens, getTradeDeepLinks } from '../../../lib/api';
import {
  SparklineSvg,
  SearchIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
} from '../../../components/icons';
import { PriceChart } from '../../../components/PriceChart';

/**
 * Reusable Token Avatar with IPFS normalization & fallback
 */
function TokenAvatar({
  imageUrl,
  symbol,
  size = 32,
}: {
  imageUrl?: string | null;
  symbol: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  let src = imageUrl;
  if (src && src.startsWith('ipfs://')) {
    src = src.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={symbol}
        onError={() => setImgError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size > 32 ? '13px' : '11px',
        color: 'var(--accent)',
        flexShrink: 0,
        textTransform: 'uppercase',
      }}
    >
      {symbol.substring(0, 3)}
    </div>
  );
}

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
  const [copiedHolder, setCopiedHolder] = useState<string | null>(null);

  const fetchTokensList = async () => {
    try {
      const sortBy =
        timeRange === '24h' ? 'volume_24h' : timeRange === '1h' ? 'volume_1h' : 'volume_5m';
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

  const copyToClipboard = (text: string, isHolder = false) => {
    navigator.clipboard.writeText(text);
    if (isHolder) {
      setCopiedHolder(text);
      setTimeout(() => setCopiedHolder(null), 2000);
    } else {
      setCopiedMint(text);
      setTimeout(() => setCopiedMint(null), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Filter and Timeframe Bar */}
      <div className="panel" style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
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
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-sub)',
                marginRight: '4px',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
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
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-sub)',
                marginRight: '4px',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-sub)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--up)',
                display: 'inline-block',
              }}
            />
            <span className="mono">LIVE • {lastUpdated.toLocaleTimeString()}</span>
            <span className="badge badge-scout">{totalCount} tokens</span>
          </div>
        </div>

        {/* Second Row: Security & Liquidity Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            fontSize: '12px',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <input
              type="checkbox"
              checked={mintRevokedOnly}
              onChange={(e) => setMintRevokedOnly(e.target.checked)}
            />
            <span>Mint Revoked Only</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
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

      {/* Main Discover Screener Table (Axiom Layout & Row Density) */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
          <table className="screener-table">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Pair / Token</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Market Cap</th>
                <th style={{ textAlign: 'right' }}>Liquidity</th>
                <th style={{ textAlign: 'right' }}>Volume ({timeRange})</th>
                <th style={{ textAlign: 'right' }}>TXNS (5m)</th>
                <th>Top 10 / Dev</th>
                <th>Security</th>
                <th style={{ textAlign: 'center' }}>Trend</th>
                <th style={{ textAlign: 'center' }}>Risk Score</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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

                  // Risk score badge: green <30, yellow 30-69, red 70+
                  const isSafe = risk.riskScore < 30;
                  const isModerate = risk.riskScore >= 30 && risk.riskScore < 70;
                  const riskBadgeClass = isSafe ? 'badge-safe' : isModerate ? 'badge-demo' : 'badge-risk';

                  return (
                    <tr
                      key={token.id}
                      onClick={() => setSelectedToken({ token, snapshot, risk, sparkline })}
                      style={{ cursor: 'pointer', height: '64px' }}
                    >
                      {/* Fix 1 & 4: Axiom-Style Pair/Token Cell (32px rounded image + bold symbol + muted name) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <TokenAvatar imageUrl={token.imageUrl} symbol={token.symbol} size={32} />
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                                ${token.symbol}
                              </span>
                              <span
                                className={`badge ${
                                  snapshot.stage === 'migrated'
                                    ? 'badge-safe'
                                    : snapshot.stage === 'curve'
                                    ? 'badge-hunter'
                                    : 'badge-demo'
                                }`}
                                style={{ fontSize: '9px', padding: '1px 5px' }}
                              >
                                {snapshot.stage}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-sub)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '130px',
                              }}
                            >
                              {token.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price (Tabular, right-aligned) */}
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        ${snapshot.price < 0.001 ? snapshot.price.toFixed(6) : snapshot.price.toFixed(4)}
                      </td>

                      {/* Market Cap (Tabular, right-aligned) */}
                      <td className="num-mono" style={{ textAlign: 'right' }}>
                        ${snapshot.mcap >= 1e6
                          ? `${(snapshot.mcap / 1e6).toFixed(2)}M`
                          : `${(snapshot.mcap / 1e3).toFixed(1)}k`}
                      </td>

                      {/* Liquidity (Tabular, right-aligned) */}
                      <td className="num-mono" style={{ textAlign: 'right' }}>
                        ${(snapshot.liquidityUsd / 1e3).toFixed(1)}k
                      </td>

                      {/* Dynamic Volume based on timeRange (Tabular, right-aligned) */}
                      <td className="num-mono" style={{ textAlign: 'right' }}>
                        ${timeRange === '24h'
                          ? (snapshot.volume24h / 1e3).toFixed(1) + 'k'
                          : timeRange === '1h'
                          ? (snapshot.volume1h / 1e3).toFixed(1) + 'k'
                          : (snapshot.volume5m / 1e3).toFixed(1) + 'k'}
                      </td>

                      {/* TXNS buys / sells (Green for buys, red for sells, NO parentheses) */}
                      <td className="num-mono" style={{ textAlign: 'right', fontSize: '12px' }}>
                        <span className="num-up">{snapshot.buys}B</span>
                        <span style={{ color: 'var(--text-sub)', margin: '0 4px' }}>/</span>
                        <span className="num-down">{snapshot.sells}S</span>
                      </td>

                      {/* Top 10 & Dev holding */}
                      <td>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>
                            T10:{' '}
                            <strong className={snapshot.top10Pct > 50 ? 'num-down' : ''}>
                              {snapshot.top10Pct.toFixed(1)}%
                            </strong>
                          </span>
                          <span style={{ marginLeft: '6px', color: 'var(--text-sub)' }}>
                            Dev: {snapshot.devHoldingPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Security Flags */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span
                            className={`badge ${snapshot.mintAuthRevoked ? 'badge-safe' : 'badge-risk'}`}
                            title={snapshot.mintAuthRevoked ? 'Mint Revoked' : 'Mint Active (Danger)'}
                          >
                            {snapshot.mintAuthRevoked ? 'M:Rev' : 'M:Active'}
                          </span>
                          <span
                            className={`badge ${snapshot.freezeAuthRevoked ? 'badge-safe' : 'badge-risk'}`}
                            title={snapshot.freezeAuthRevoked ? 'Freeze Revoked' : 'Freeze Active (Danger)'}
                          >
                            {snapshot.freezeAuthRevoked ? 'F:Rev' : 'F:Active'}
                          </span>
                        </div>
                      </td>

                      {/* Fix 3: Real Price History Sparkline (green for gain, red for loss) */}
                      <td style={{ textAlign: 'center' }}>
                        <SparklineSvg data={sparkline} width={68} height={20} />
                      </td>

                      {/* Fix 4: Risk Score Badge (green <30, yellow 30-69, red 70+) */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${riskBadgeClass}`}
                          style={{ fontWeight: 800, padding: '3px 8px' }}
                        >
                          {risk.riskScore}/100
                        </span>
                      </td>

                      {/* Non-Custodial Actions: Copy CA & External Deep-Links */}
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => copyToClipboard(token.mint)}
                            className="btn btn-ghost btn-sm"
                            title="Copy Contract Address"
                            style={{ padding: '4px 6px' }}
                          >
                            {copiedMint === token.mint ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                          </button>

                          <a
                            href={links.jupiter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            title="Trade in external wallet"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
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

      {/* Fix 5: Token Detail Drawer Modal (Opens on row click) */}
      {selectedToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setSelectedToken(null)}
        >
          <div
            className="panel"
            style={{
              width: '520px',
              maxWidth: '94vw',
              height: '100%',
              borderRadius: 0,
              borderLeft: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header: Real Image, Name, Symbol, Stage, Close button */}
            <div className="panel-header" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TokenAvatar
                  imageUrl={selectedToken.token.imageUrl}
                  symbol={selectedToken.token.symbol}
                  size={42}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '17px' }}>
                      ${selectedToken.token.symbol}
                    </span>
                    <span
                      className={`badge ${
                        selectedToken.snapshot.stage === 'migrated'
                          ? 'badge-safe'
                          : selectedToken.snapshot.stage === 'curve'
                          ? 'badge-hunter'
                          : 'badge-demo'
                      }`}
                    >
                      {selectedToken.snapshot.stage}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                    {selectedToken.token.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedToken(null)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div
              className="panel-body"
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
              {/* Contract Address (CA) with Copy Button */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Contract Address (CA)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    background: 'var(--bg-secondary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span className="mono" style={{ fontSize: '12px', wordBreak: 'break-all', flex: 1 }}>
                    {selectedToken.token.mint}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedToken.token.mint)}
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, padding: '4px 10px', fontSize: '11px' }}
                  >
                    {copiedMint === selectedToken.token.mint ? 'Copied!' : 'Copy CA'}
                  </button>
                </div>
              </div>

              {/* Price Chart (Rendered from real price_history) */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-sub)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  Real Price History
                </div>
                <PriceChart
                  data={selectedToken.token.priceHistory || selectedToken.sparkline}
                  symbol={selectedToken.token.symbol}
                  height={150}
                />
              </div>

              {/* Key Diagnostics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Market Cap</div>
                  <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                    ${selectedToken.snapshot.mcap >= 1e6
                      ? `${(selectedToken.snapshot.mcap / 1e6).toFixed(2)}M`
                      : `${(selectedToken.snapshot.mcap / 1e3).toFixed(1)}k`}
                  </div>
                </div>

                <div className="panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Liquidity USD</div>
                  <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                    ${(selectedToken.snapshot.liquidityUsd / 1e3).toFixed(1)}k
                  </div>
                </div>

                <div className="panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>5m Volume</div>
                  <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                    ${(selectedToken.snapshot.volume5m / 1e3).toFixed(1)}k
                  </div>
                </div>

                <div className="panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Holder Count</div>
                  <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                    {selectedToken.snapshot.holderCount > 0 ? selectedToken.snapshot.holderCount.toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* Full Risk Audit: Each flag with detailed explanation */}
              <div className="panel" style={{ padding: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>Deterministic Risk Audit</div>
                  <span
                    className={`badge ${
                      selectedToken.risk.riskScore < 30
                        ? 'badge-safe'
                        : selectedToken.risk.riskScore < 70
                        ? 'badge-demo'
                        : 'badge-risk'
                    }`}
                    style={{ fontWeight: 800, padding: '3px 8px' }}
                  >
                    {selectedToken.risk.riskScore}/100 Risk
                  </span>
                </div>

                {/* Audit Flags List with Explanations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedToken.risk.flags && selectedToken.risk.flags.length > 0 ? (
                    selectedToken.risk.flags.map((flag: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-secondary)',
                          borderLeft: `3px solid ${
                            flag.severity === 'CRITICAL'
                              ? 'var(--down)'
                              : flag.severity === 'WARNING'
                              ? 'var(--warning)'
                              : 'var(--accent)'
                          }`,
                          padding: '8px 12px',
                          borderRadius: '0 var(--radius) var(--radius) 0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '12px' }}>{flag.title}</span>
                          <span
                            className={`badge ${
                              flag.severity === 'CRITICAL'
                                ? 'badge-risk'
                                : flag.severity === 'WARNING'
                                ? 'badge-demo'
                                : 'badge-scout'
                            }`}
                            style={{ fontSize: '9px' }}
                          >
                            {flag.severity} (-{flag.deductionPoints} pts)
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.4 }}>
                          {flag.description}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--up)', padding: '6px 0' }}>
                      ✓ Clean audit: No critical or warning rug vectors identified.
                    </div>
                  )}

                  {/* Core Metrics Breakdown */}
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-sub)' }}>Mint Authority:</span>
                      <strong className={selectedToken.snapshot.mintAuthRevoked ? 'num-up' : 'num-down'}>
                        {selectedToken.snapshot.mintAuthRevoked ? 'Revoked (Safe)' : 'Active (High Risk)'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-sub)' }}>Freeze Authority:</span>
                      <strong className={selectedToken.snapshot.freezeAuthRevoked ? 'num-up' : 'num-down'}>
                        {selectedToken.snapshot.freezeAuthRevoked ? 'Revoked (Safe)' : 'Active (Blacklist Risk)'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-sub)' }}>LP Burned / Locked:</span>
                      <strong className={selectedToken.snapshot.lpBurnedOrLockedPct >= 90 ? 'num-up' : ''}>
                        {selectedToken.snapshot.stage === 'curve' && selectedToken.snapshot.lpBurnedOrLockedPct === 0
                          ? '0% (Bonding curve — LP not yet created)'
                          : `${selectedToken.snapshot.lpBurnedOrLockedPct.toFixed(1)}%`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-sub)' }}>Top 10 Holder Share:</span>
                      <strong className={selectedToken.snapshot.top10Pct > 50 ? 'num-down' : ''}>
                        {selectedToken.snapshot.top10Pct.toFixed(1)}%
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-sub)' }}>Dev Allocation:</span>
                      <strong>{selectedToken.snapshot.devHoldingPct.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Holder Distribution (Top 10 List if available) */}
              <div className="panel" style={{ padding: '16px' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '10px' }}>
                  Holder Distribution (Top 10 Largest Accounts)
                </div>
                {selectedToken.snapshot.topHolders && selectedToken.snapshot.topHolders.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedToken.snapshot.topHolders.slice(0, 10).map((h: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          padding: '4px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-secondary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-sub)', width: '20px' }}>#{idx + 1}</span>
                          <span className="mono">
                            {h.address.length > 12
                              ? `${h.address.slice(0, 4)}...${h.address.slice(-4)}`
                              : h.address}
                          </span>
                          <button
                            onClick={() => copyToClipboard(h.address, true)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '1px 4px', fontSize: '10px' }}
                            title="Copy Address"
                          >
                            {copiedHolder === h.address ? '✓' : '⧉'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '50px',
                              height: '4px',
                              borderRadius: '2px',
                              background: 'var(--border-color)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, (h.pct || 0) * 2)}%`,
                                height: '100%',
                                background: (h.pct || 0) > 20 ? 'var(--down)' : 'var(--accent)',
                              }}
                            />
                          </div>
                          <span className="num-mono" style={{ fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                            {(h.pct || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-sub)', textAlign: 'center', padding: '12px' }}>
                    Top 10 concentration: {selectedToken.snapshot.top10Pct.toFixed(1)}% of supply.
                  </div>
                )}
              </div>

              {/* External Execution Deep Links (Axiom, BullX, Photon, Jupiter) */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-sub)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '8px',
                  }}
                >
                  External Execution (Trade in external terminal):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).axiom}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', justifyContent: 'center' }}
                  >
                    Axiom Terminal ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).bullx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', justifyContent: 'center' }}
                  >
                    BullX ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).photon}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', justifyContent: 'center' }}
                  >
                    Photon ↗
                  </a>
                  <a
                    href={getTradeDeepLinks(selectedToken.token.mint).jupiter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: '12px', justifyContent: 'center' }}
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
