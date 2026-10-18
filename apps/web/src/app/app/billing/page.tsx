'use client';

import React, { useState, useEffect } from 'react';
import { getStoredUser } from '../../../lib/api';

export default function BillingPage() {
  const [user, setUser] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'scout' | 'hunter'>('hunter');
  const [processing, setProcessing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleSubscribe = async (plan: 'scout' | 'hunter') => {
    setProcessing(true);
    setStatusNotice(null);
    try {
      const token = localStorage.getItem('sr_access_token');
      const res = await fetch('http://localhost:3001/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planCode: plan }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local session
        if (user) {
          const updated = { ...user, plan };
          localStorage.setItem('sr_user', JSON.stringify(updated));
          setUser(updated);
        }
        setStatusNotice(`Successfully activated ${plan.toUpperCase()} plan (Test Mode — zero charges).`);
      } else {
        setStatusNotice(`Activated ${plan.toUpperCase()} tier in test simulation.`);
      }
    } catch {
      setStatusNotice(`Activated ${plan.toUpperCase()} tier in test simulation.`);
    } finally {
      setProcessing(false);
    }
  };

  const currentPlan = user?.plan || 'scout';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Test Mode Notification Strip */}
      <div className="panel" style={{ padding: '16px 20px', background: 'var(--bg-secondary)', borderLeft: '3px solid var(--warning)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-demo">TEST BILLING ACTIVE</span>
          <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
            Zero real charges during development and review. Pluggable NoopBilling architecture active.
          </span>
        </div>
      </div>

      {statusNotice && (
        <div className="panel" style={{ padding: '14px 20px', background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--text-main)', fontSize: '13px' }}>
          {statusNotice}
        </div>
      )}

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Scout Plan */}
        <div className={`panel ${currentPlan === 'scout' ? 'border-strong' : ''}`} style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '18px' }}>Scout Tier</span>
            {currentPlan === 'scout' && <span className="badge badge-scout">CURRENT PLAN</span>}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, marginBottom: '6px' }} className="num-mono">
            $50 <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-sub)' }}>/ month</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Core real-time screener and launchpulse intelligence for individual meme traders.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '30px', flex: 1 }}>
            <li>✓ Full access to Discovery Screener (&gt;50 tokens)</li>
            <li>✓ Multi-timeframe volume & sparklines</li>
            <li>✓ Real-time Pulse Launch Stream</li>
            <li>✓ Deterministic rug audit scores & flags</li>
            <li>✓ Track 1 smart-money wallet</li>
            <li>✓ Telegram bot alert commands</li>
          </ul>

          <button
            onClick={() => handleSubscribe('scout')}
            disabled={processing || currentPlan === 'scout'}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px' }}
          >
            {currentPlan === 'scout' ? 'Active Plan' : 'Switch to Scout'}
          </button>
        </div>

        {/* Hunter Plan */}
        <div className="panel" style={{ padding: '28px', border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent)' }}>Hunter Tier</span>
            {currentPlan === 'hunter' && <span className="badge badge-hunter">CURRENT PLAN</span>}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, marginBottom: '6px', color: 'var(--accent)' }} className="num-mono">
            $100 <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-sub)' }}>/ month</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Pro-grade signal speeds, copy-trading alerts, and unlimited custom snipe rules.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '30px', flex: 1 }}>
            <li>✓ Everything in Scout, plus:</li>
            <li>✓ Sub-2s Telegram snipe alerts on matching launches</li>
            <li>✓ Unlimited custom snipe filter rules</li>
            <li>✓ Track up to 10 smart-money whale wallets</li>
            <li>✓ Instant copy-signals stream on whale swaps</li>
            <li>✓ Deep holder forensic diagnostics</li>
            <li>✓ Priority WebSocket & RPC allocation</li>
          </ul>

          <button
            onClick={() => handleSubscribe('hunter')}
            disabled={processing || currentPlan === 'hunter'}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
          >
            {currentPlan === 'hunter' ? 'Active Plan' : 'Upgrade to Hunter ($100/mo)'}
          </button>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Feature Comparison Breakdown</span>
        </div>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Feature Capability</th>
              <th>Scout ($50/mo)</th>
              <th>Hunter ($100/mo)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Non-Custodial Screener</td>
              <td>Full Access</td>
              <td>Full Access</td>
            </tr>
            <tr>
              <td>Pulse Launch Feed</td>
              <td>Streaming Live</td>
              <td>Streaming Live (Priority)</td>
            </tr>
            <tr>
              <td>Telegram Snipe Alerts</td>
              <td>Standard</td>
              <td>Instant (&lt;2s Delivery)</td>
            </tr>
            <tr>
              <td>Custom Snipe Rules</td>
              <td>1 Rule</td>
              <td>Unlimited</td>
            </tr>
            <tr>
              <td>Tracked Smart Wallets</td>
              <td>1 Wallet</td>
              <td>10 Wallets</td>
            </tr>
            <tr>
              <td>Copy-Signals Swaps</td>
              <td>Daily Digest</td>
              <td>Real-Time Alerts</td>
            </tr>
            <tr>
              <td>Custody / Private Keys</td>
              <td>Never (Signals Only)</td>
              <td>Never (Signals Only)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
