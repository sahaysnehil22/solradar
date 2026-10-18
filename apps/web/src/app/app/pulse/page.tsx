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
  const [pendingSnipeAlert, setPendingSnipeAlert] = useState<{
    symbol: string;
    mint: string;
    launchpad: string;
    minLiquidityUsd: number;
    maxRiskScore: number;
  } | null>(null);
  const [alertDeploying, setAlertDeploying] = useState(false);
  const [alertToast, setAlertToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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

  const handleOpenAlertModal = (token: any, snapshot: any) => {
    const launchpad = snapshot?.stage === 'migrated' ? 'Raydium' : 'Pump.fun';
    setPendingSnipeAlert({
      symbol: token?.symbol || 'TOKEN',
      mint: token?.mint || '',
      launchpad,
      minLiquidityUsd: 1000,
      maxRiskScore: 70,
    });
  };

  const confirmDeployAlert = async () => {
    if (!pendingSnipeAlert) return;
    setAlertDeploying(true);
    try {
      await createSnipeRule({
        name: `Snipe Alert: $${pendingSnipeAlert.symbol}`,
        launchpad: pendingSnipeAlert.launchpad.toLowerCase(),
        minLiquidityUsd: pendingSnipeAlert.minLiquidityUsd,
        maxRiskScore: pendingSnipeAlert.maxRiskScore,
        channel: 'telegram',
      });
      setAlertSuccessMint(pendingSnipeAlert.mint);
      setAlertToast({
        type: 'success',
        message: `Snipe rule for $${pendingSnipeAlert.symbol} deployed! Matching signals will alert via Telegram.`,
      });
      setPendingSnipeAlert(null);
      setTimeout(() => {
        setAlertSuccessMint(null);
        setAlertToast(null);
      }, 4000);
    } catch (err: any) {
      setAlertToast({ type: 'error', message: err.message || 'Failed to deploy snipe alert' });
    } finally {
      setAlertDeploying(false);
    }
  };

  const filteredLaunches = hideHighRisk
    ? launches.filter((l) => l.risk?.riskScore <= 70)
    : launches;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Toast Notification */}
      {alertToast && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${alertToast.type === 'success' ? '#10b981' : '#f43f5e'}`,
            background: alertToast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: alertToast.type === 'success' ? '#10b981' : '#f43f5e',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{alertToast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{alertToast.message}</span>
          </div>
          <button
            onClick={() => setAlertToast(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Alert Confirmation Modal */}
      {pendingSnipeAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0d0e15',
              border: '1px solid #1f2233',
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <BellIcon size={18} />
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                Deploy Snipe Alert for ${pendingSnipeAlert.symbol}?
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
              Deploy a live on-chain snipe rule. When matching launches or liquidity spikes occur, you will receive an instant signal via Telegram.
            </p>

            <div style={{ background: '#07080c', borderRadius: '8px', padding: '12px', border: '1px solid #161822', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Target Token:</span>
                <span className="mono" style={{ color: '#ffffff', fontWeight: 700 }}>
                  ${pendingSnipeAlert.symbol} ({pendingSnipeAlert.mint ? `${pendingSnipeAlert.mint.substring(0, 6)}...${pendingSnipeAlert.mint.slice(-4)}` : 'Mint'})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Launchpad:</span>
                <span style={{ color: '#ffffff' }}>{pendingSnipeAlert.launchpad}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Min Liquidity Filter:</span>
                <span className="num-mono" style={{ color: '#10b981' }}>&gt; ${pendingSnipeAlert.minLiquidityUsd.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Max Risk Cutoff:</span>
                <span className="num-mono" style={{ color: '#f59e0b' }}>&le; {pendingSnipeAlert.maxRiskScore}/100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Dispatch Channel:</span>
                <span style={{ color: '#4f75fe' }}>Telegram Instant Alert</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setPendingSnipeAlert(null)}
                disabled={alertDeploying}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeployAlert}
                disabled={alertDeploying}
                className="btn btn-primary"
                style={{ padding: '8px 14px', fontSize: '12px', background: '#4f75fe', borderColor: '#4f75fe' }}
              >
                {alertDeploying ? 'Deploying...' : 'Confirm & Deploy Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {token.imageUrl ? (
                      <img
                        src={token.imageUrl.startsWith('ipfs://') ? token.imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/') : token.imageUrl}
                        alt={token.symbol}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          (e.currentTarget as any).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '11px',
                        color: 'var(--accent)',
                        flexShrink: 0,
                      }}>
                        {token.symbol.substring(0, 3)}
                      </div>
                    )}
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
                      onClick={() => handleOpenAlertModal(token, snapshot)}
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
                      href={`https://jup.ag/swap/SOL-${token.mint}`}
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
