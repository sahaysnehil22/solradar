'use client';

import React, { useState, useEffect } from 'react';
import { getReferralsData, getReferralHistory } from '../../../lib/api';
import { CopyIcon, CheckIcon } from '../../../components/icons';

export default function ReferralsPage() {
  const [data, setData] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [refData, histData] = await Promise.all([
          getReferralsData(),
          getReferralHistory(),
        ]);
        setData(refData);
        setHistory(histData || []);
      } catch (err) {
        console.error('Failed to load referral ledger:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const copyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <span className="mono" style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '12px' }}>
              {data?.referralCode || 'SOL20'}
            </span>
            <button onClick={copyLink} className="btn btn-primary" style={{ padding: '8px 14px' }}>
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              <span style={{ marginLeft: '4px' }}>{copied ? 'Copied Link' : 'Copy Share Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discount Ledger Cards (Fed from Real Backend API) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active Discount Rate
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }} className="num-mono num-up">
            {data ? `${data.effectiveDiscountPercent}% OFF` : '0% OFF'}
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
            {data ? `${data.monthsRemaining} Months` : '0 Months'}
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
            ${data ? data.estimatedSavingsUsd.toFixed(2) : '0.00'}
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
            {data ? data.totalReferrals : 0}
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
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono" style={{ fontSize: '12px' }}>{h.id.substring(0, 12)}...</td>
                    <td>{new Date(h.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${h.status === 'applied' ? 'badge-safe' : 'badge-demo'}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="num-mono num-up">+20% / Month</td>
                    <td>3 Months from activation</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
