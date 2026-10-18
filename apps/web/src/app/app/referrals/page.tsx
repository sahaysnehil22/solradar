'use client';

import React, { useState, useEffect } from 'react';
import { getReferralsData, getReferralHistory } from '../../../lib/api';
import { CopyIcon, CheckIcon } from '../../../components/icons';

export default function ReferralsPage() {
  const [data, setData] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [refData, histData] = await Promise.all([
          getReferralsData().catch(() => null),
          getReferralHistory().catch(() => []),
        ]);
        if (isMounted) {
          setData(refData || null);
          setHistory(Array.isArray(histData) ? histData : []);
        }
      } catch (err) {
        console.error('Failed to load referral ledger:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const copyLink = () => {
    const code = data?.referralCode || 'SOL20';
    const link =
      typeof window !== 'undefined'
        ? `${window.location.origin}/app/referrals?ref=${code}`
        : (data?.referralLink || `https://solradar.io/app/referrals?ref=${code}`);

    try {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyNotification(`Referral link copied: ${link}`);
      setTimeout(() => {
        setCopied(false);
        setCopyNotification(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

  const discountPercent = data?.effectiveDiscountPercent ?? data?.percentOff ?? 0;
  const monthsRemaining = data?.monthsRemaining ?? 0;
  const rawSavings = typeof data?.estimatedSavingsUsd === 'number' ? data.estimatedSavingsUsd : 0;
  const savingsDisplay = rawSavings.toFixed(2);
  const totalInvites = data?.totalReferrals ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Confirmation */}
      {copyNotification && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            borderRadius: 'var(--radius)',
            color: '#10b981',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckIcon size={14} />
          <span>{copyNotification}</span>
        </div>
      )}

      {/* Banner */}
      <div className="panel" style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800 }}>Referral Discount Program</span>
              <span className="badge badge-hunter">20% Off Each Month</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Share your link with fellow traders. Every friend who joins grants you and your friend 20% off for 3 months (up to 100% off).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="mono"
              style={{
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
              }}
            >
              {data?.referralCode || 'SOL20'}
            </span>
            <button
              onClick={copyLink}
              className="btn btn-primary"
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              <span>{copied ? 'Copied Link' : 'Copy Share Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discount Ledger Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active Discount Rate
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }} className="num-mono num-up">
            {discountPercent}% OFF
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Applied automatically to monthly invoice.
          </div>
        </div>

        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
            Months Remaining
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }} className="num-mono">
            {monthsRemaining} Months
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cumulative duration across valid referrals.
          </div>
        </div>

        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
            Estimated Monthly Savings
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }} className="num-mono num-up">
            ${savingsDisplay}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Calculated against active subscription tier.
          </div>
        </div>

        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
            Successful Invites
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }} className="num-mono">
            {totalInvites}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Traders joined via your unique link.
          </div>
        </div>
      </div>

      {/* Referral History Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Referral Activity Ledger</span>
          <span className="badge badge-scout">{history.length} RECORDS</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
              No referrals recorded yet. Share your link above to start earning subscription discounts.
            </div>
          ) : (
            <table className="screener-table">
              <thead>
                <tr>
                  <th>Referral ID</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th>Discount Earned</th>
                  <th>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const safeDate = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'Recent';
                  const safeId = typeof h.id === 'string' ? `${h.id.substring(0, 12)}...` : 'REF-KEY';
                  return (
                    <tr key={h.id || Math.random()}>
                      <td className="mono" style={{ fontSize: '12px' }}>{safeId}</td>
                      <td>{safeDate}</td>
                      <td>
                        <span className={`badge ${h.status === 'applied' ? 'badge-safe' : 'badge-demo'}`}>
                          {h.status || 'pending'}
                        </span>
                      </td>
                      <td className="num-mono num-up">+20% / Month</td>
                      <td>3 Months from activation</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
