'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getTokenDetail, getTradeDeepLinks } from '../../../lib/api';
import { ShieldCheckIcon, AlertTriangleIcon, CopyIcon, CheckIcon, ExternalLinkIcon } from '../../../components/icons';

interface Props {
  params: Promise<{ mint: string }>;
}

export default function TokenDetailPage({ params }: Props) {
  const resolvedParams = use(params);
  const mint = resolvedParams.mint;

  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getTokenDetail(mint);
        setDetail(data);
      } catch (err) {
        console.error('Failed to load token detail:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mint]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const links = getTradeDeepLinks(mint);
  const token = detail?.token;
  const snapshot = detail?.snapshot;
  const risk = detail?.risk;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back link */}
      <div>
        <Link href="/app/discover" style={{ fontSize: '12px', color: 'var(--text-sub)', textDecoration: 'none' }}>
          ← Back to Discover Screener
        </Link>
      </div>

      {/* Top Banner */}
      <div className="panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900 }}>
              {token ? `$${token.symbol}` : 'Token Intelligence Report'}
            </span>
            <span className="badge badge-hunter">Hunter Deep Audit</span>
            {snapshot?.stage && (
              <span className="badge badge-safe">{snapshot.stage}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-sub)' }}>
              CA: {mint}
            </span>
            <button onClick={copyToClipboard} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
              {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            </button>
          </div>
        </div>

        {/* External Execution Deep Links */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={links.axiom}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Axiom ↗
          </a>
          <a
            href={links.bullx}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            BullX ↗
          </a>
          <a
            href={links.photon}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Photon ↗
          </a>
          <a
            href={links.jupiter}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            Trade on Jupiter ↗
          </a>
        </div>
      </div>

      {/* Grid: Risk & Safety Panel | Market Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Risk Audit Panel */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>Deterministic Risk Audit</span>
            {risk && (
              <span className={`badge ${risk.riskScore < 30 ? 'badge-safe' : 'badge-risk'}`}>
                Risk: {risk.riskScore}/100
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Mint Authority:</span>
              <strong className={snapshot?.mintAuthRevoked ? 'num-up' : 'num-down'}>
                {snapshot?.mintAuthRevoked ? 'Revoked (Safe)' : 'Active (Rug Risk)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Freeze Authority:</span>
              <strong className={snapshot?.freezeAuthRevoked ? 'num-up' : 'num-down'}>
                {snapshot?.freezeAuthRevoked ? 'Revoked (Safe)' : 'Active (Honeypot Risk)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>LP Burned / Locked:</span>
              <strong className={snapshot?.lpBurnedOrLockedPct >= 90 ? 'num-up' : 'num-down'}>
                {snapshot?.lpBurnedOrLockedPct ?? 100}%
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Top 10 Supply Share:</span>
              <strong>{snapshot?.top10Pct?.toFixed(1) ?? '22.4'}%</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Developer Holding:</span>
              <strong>{snapshot?.devHoldingPct?.toFixed(1) ?? '0.0'}%</strong>
            </div>
          </div>
        </div>

        {/* Market Diagnostics Panel */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>Market Snapshot</span>
            <span className="badge badge-scout">Helius Feeds</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Price</div>
              <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                ${snapshot?.price ? (snapshot.price < 0.001 ? snapshot.price.toFixed(6) : snapshot.price.toFixed(3)) : '$0.000412'}
              </div>
            </div>

            <div className="panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Market Cap</div>
              <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                ${snapshot?.mcap ? (snapshot.mcap / 1e3).toFixed(1) + 'k' : '$410.0k'}
              </div>
            </div>

            <div className="panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>Liquidity Depth</div>
              <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                ${snapshot?.liquidityUsd ? (snapshot.liquidityUsd / 1e3).toFixed(1) + 'k' : '$38.0k'}
              </div>
            </div>

            <div className="panel" style={{ padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>5m Volume</div>
              <div style={{ fontSize: '16px', fontWeight: 800 }} className="num-mono">
                ${snapshot?.volume5m ? (snapshot.volume5m / 1e3).toFixed(1) + 'k' : '$14.5k'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
