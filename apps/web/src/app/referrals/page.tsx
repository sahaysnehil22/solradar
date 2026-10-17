'use client';

import React, { useState } from 'react';

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'RADAR-ALPHA20';
  const referralLink = 'https://solradar.io/signup?ref=RADAR-ALPHA20';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Referral Program</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Give 20% off. Get 20% off. Both you and your friend receive 20% off for 3 months.
        </p>
      </div>

      {/* Share Box */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '8px' }}>
          Your Shareable Link
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            readOnly
            value={referralLink}
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button onClick={handleCopy} className="btn btn-primary">
            {copied ? 'Copied! ✓' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Credit Status Ledger */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>
          💳 Active Discount Ledger
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Current Discount</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-emerald)', marginTop: '4px' }}>
              20% OFF
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Months Remaining</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginTop: '4px' }}>
              3 / 3 Months
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Estimated Monthly Savings</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-cyan)', marginTop: '4px' }}>
              $20.00 / mo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
