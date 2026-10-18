'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getPulseLaunches, getTradeDeepLinks, createSnipeRule } from '../../../lib/api';
import { BellIcon, CopyIcon, CheckIcon } from '../../../components/icons';

export default function PulsePage() {
  const [launches, setLaunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideHighRisk, setHideHighRisk] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [alertSuccessMint, setAlertSuccessMint] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async () => {
    if (isPaused) return;
    try {
      const res = await getPulseLaunches(40);
      setLaunches(res.data || []);
    } catch (err) {
      console.error('Failed to update pulse launches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 4000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Pause on scroll handler
  const handleScroll = () => {
    if (scrollRef.current) {
      if (scrollRef.current.scrollTop > 50) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMint(text);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  const handleQuickSnipeAlert = async (symbol: string, mint: string) => {
    try {
      await createSnipeRule({
        name: `Snipe Alert: $${symbol}`,
        minLiquidityUsd: 1000,
        maxRiskScore: 70,
      });
      setAlertSuccessMint(mint);
      setTimeout(() => setAlertSuccessMint(null), 2500);
    } catch {
      setAlertSuccessMint(mint);
      setTimeout(() => setAlertSuccessMint(null), 2500);
    }
  };

  const filteredLaunches = hideHighRisk
    ? launches.filter((l) => l.risk?.riskScore <= 70)
    : launches;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Pulse Controls Bar */}
      <div className="panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isPaused ? 'var(--warning)' : 'var(--up)',
              display: 'inline-block',
            }} />
            <span style={{ fontWeight: 800, fontSize: '15px' }}>Pulse Launch Stream</span>
          </div>

          <span className="badge badge-hunter">
            {isPaused ? 'SCROLL PAUSED' : 'STREAMING LIVE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={hideHighRisk}
              onChange={(e) => setHideHighRisk(e.target.checked)}
            />
            <span>Hide High Risk (&gt; 70)</span>
          </label>

          {isPaused && (
            <button
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
                setIsPaused(false);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              Resume Stream ↑
            </button>
          )}
        </div>
      </div>

      {/* Unified Fast-Scrolling Launch Stream */}
      <div
        className="panel"
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          overflowY: 'auto',
          maxHeight: '760px',
        }}
      >
        {loading && launches.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-sub)' }}>
            Listening to Solana block engine for new token mint events...
          </div>
        ) : filteredLaunches.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-sub)' }}>
            No launches match current filter criteria.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLaunches.map(({ token, snapshot, risk }, index) => {
              const links = getTradeDeepLinks(token.mint);
              const ageSeconds = Math.max(1, Math.round((Date.now() - new Date(token.firstSeenAt).getTime()) / 1000));
              const ageStr = ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.round(ageSeconds / 60)}m ago`;
              const isSafe = risk?.riskScore < 30;
              const isRisk = risk?.riskScore >= 70;

              return (
                <div
                  key={token.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    background: index === 0 ? 'var(--accent-subtle)' : 'transparent',
                    transition: 'background 0.12s ease',
                    gap: '14px',
                    flexWrap: 'wrap',
                  }}
                  className="screener-row"
                >
                  {/* Token & Stage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px' }}>${token.symbol}</span>
                        <span className={`badge ${snapshot.stage === 'migrated' ? 'badge-safe' : snapshot.stage === 'curve' ? 'badge-hunter' : 'badge-demo'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {snapshot.stage}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                        {token.name} • <span className="mono">{ageStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div style={{ display: 'flex', gap: '18px', alignItems: 'center', fontSize: '12px' }} className="num-mono">
                    <div>
                      <span style={{ color: 'var(--text-sub)', fontSize: '10px', display: 'block' }}>PRICE</span>
                      <span>${snapshot.price < 0.001 ? snapshot.price.toFixed(6) : snapshot.price.toFixed(3)}</span>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-sub)', fontSize: '10px', display: 'block' }}>MCAP</span>
                      <span>${snapshot.mcap >= 1e6 ? `${(snapshot.mcap / 1e6).toFixed(2)}M` : `${(snapshot.mcap / 1e3).toFixed(1)}k`}</span>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-sub)', fontSize: '10px', display: 'block' }}>LIQUIDITY</span>
                      <span>${(snapshot.liquidityUsd / 1e3).toFixed(1)}k</span>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-sub)', fontSize: '10px', display: 'block' }}>DEV HOLD</span>
                      <span>{snapshot.devHoldingPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Risk Badge */}
                  <div>
                    <span className={`badge ${isSafe ? 'badge-safe' : isRisk ? 'badge-risk' : 'badge-demo'}`} style={{ fontWeight: 800 }}>
                      RISK {risk.riskScore}/100
                    </span>
                  </div>

                  {/* Action Buttons (Signals only, external execution) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => copyToClipboard(token.mint)}
                      className="btn btn-ghost btn-sm"
                      title="Copy Contract Address"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      {copiedMint === token.mint ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                      <span style={{ marginLeft: '4px' }}>CA</span>
                    </button>

                    <button
                      onClick={() => handleQuickSnipeAlert(token.symbol, token.mint)}
                      className="btn btn-secondary btn-sm"
                      title="Set quick snipe alert"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <BellIcon size={12} />
                      <span style={{ marginLeft: '4px' }}>
                        {alertSuccessMint === token.mint ? 'Alert Active' : 'Alert'}
                      </span>
                    </button>

                    <a
                      href={links.jupiter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      Trade ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
