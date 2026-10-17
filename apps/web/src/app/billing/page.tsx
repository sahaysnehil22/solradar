'use client';

import React, { useState } from 'react';

export default function BillingPage() {
  const [activePlan, setActivePlan] = useState<'scout' | 'hunter'>('hunter');
  const [activatedNotice, setActivatedNotice] = useState<string | null>(null);

  const handleSimulateCheckout = (plan: 'scout' | 'hunter') => {
    setActivePlan(plan);
    setActivatedNotice(
      `Plan switched to ${plan.toUpperCase()}! (BILLING PLACEHOLDER: No real charges were incurred. Plan gating updated across API & Bot.)`
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>
          Subscription & Plans
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
          Zero trading cuts. Flat transparent monthly intelligence subscription.
        </p>

        {/* Test Mode Honest Labeling */}
        <div style={{
          marginTop: '16px',
          display: 'inline-block',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#f59e0b',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          ⚠️ <strong>Test Billing Active:</strong> No credit card or paid Stripe keys are required during testing.
        </div>

        {activatedNotice && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
          }}>
            {activatedNotice}
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Scout Plan */}
        <div className="glass-panel" style={{
          padding: '30px',
          border: activePlan === 'scout' ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {activePlan === 'scout' && (
            <div style={{ position: 'absolute', top: '-12px', right: '20px' }}>
              <span className="badge badge-scout">Current Plan</span>
            </div>
          )}
          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Scout Tier</h2>
          <div style={{ fontSize: '36px', fontWeight: '900', marginTop: '12px', color: '#fff' }}>
            $50<span style={{ fontSize: '16px', color: 'var(--text-sub)', fontWeight: '500' }}>/month</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '6px' }}>
            Essential real-time screener and launch alerts for active traders.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px', fontSize: '13px' }}>
            <li>✅ Discovery Screener with Risk Scoring</li>
            <li>✅ 3-Stage Pulse Launch Feed</li>
            <li>✅ Standard Telegram Alerts</li>
            <li>✅ 1 Tracked Smart-Money Wallet</li>
            <li>✅ 25 Watchlist Slots</li>
            <li style={{ color: 'var(--text-sub)' }}>❌ Copy-Trade Signals</li>
            <li style={{ color: 'var(--text-sub)' }}>❌ Read-Only Portfolio Tracker</li>
          </ul>

          <button
            onClick={() => handleSimulateCheckout('scout')}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '30px', justifyContent: 'center' }}
          >
            {activePlan === 'scout' ? 'Active' : 'Switch to Scout (Test Mode)'}
          </button>
        </div>

        {/* Hunter Plan */}
        <div className="glass-panel" style={{
          padding: '30px',
          border: activePlan === 'hunter' ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
          background: 'linear-gradient(180deg, rgba(19, 25, 38, 0.9) 0%, rgba(13, 17, 26, 0.95) 100%)',
          position: 'relative'
        }}>
          {activePlan === 'hunter' && (
            <div style={{ position: 'absolute', top: '-12px', right: '20px' }}>
              <span className="badge badge-hunter">Current Plan</span>
            </div>
          )}
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>Hunter Tier</h2>
          <div style={{ fontSize: '36px', fontWeight: '900', marginTop: '12px', color: 'var(--accent-cyan)' }}>
            $100<span style={{ fontSize: '16px', color: 'var(--text-sub)', fontWeight: '500' }}>/month</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '6px' }}>
            Full intelligence weapon: priority alerts, copy-signals, and portfolio tracking.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px', fontSize: '13px' }}>
            <li>✅ Everything in Scout Tier</li>
            <li>✅ <strong>Priority Instant Alerts</strong> (&lt;2s delivery)</li>
            <li>✅ <strong>10 Tracked Smart-Money Wallets</strong></li>
            <li>✅ <strong>Copy-Trade SIGNALS</strong> (with 7d PnL stats)</li>
            <li>✅ <strong>Read-Only Portfolio Tracker</strong></li>
            <li>✅ X / Telegram Call Channel Scanner</li>
            <li>✅ Unlimited Watchlists & Webhook Export</li>
          </ul>

          <button
            onClick={() => handleSimulateCheckout('hunter')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '30px', justifyContent: 'center' }}
          >
            {activePlan === 'hunter' ? 'Active' : 'Upgrade to Hunter (Test Mode)'}
          </button>
        </div>
      </div>
    </div>
  );
}
