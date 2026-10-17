'use client';

import React from 'react';

const PULSE_STAGES = [
  {
    title: '🟢 New Pairs (Genesis)',
    subtitle: 'Tokens detected within seconds of creation',
    items: [
      {
        symbol: 'PEPEAI',
        name: 'Pepe AI Agent',
        mint: 'NewPairGenesisPulse111111111111111111111111',
        time: '12s ago',
        price: '$0.0000084',
        mcap: '$8.4K',
        liq: '$2.1K',
        riskScore: 65,
        riskBadge: 'MODERATE RISK',
        flags: ['LP Only Partially Locked (35%)', 'Fresh Dev Wallet'],
      },
      {
        symbol: 'HONEYPOT',
        name: 'Fake Pump Token',
        mint: 'DangerousRugRiskTest2222222222222222222222222',
        time: '45s ago',
        price: '$0.0000120',
        mcap: '$12K',
        liq: '$1.8K',
        riskScore: 85,
        riskBadge: 'HIGH RISK',
        flags: ['Mint Authority Active', 'Freeze Authority Active', 'Top 10 = 78%'],
      },
    ],
  },
  {
    title: '⚡ Bonding Curve Rush',
    subtitle: 'High velocity pump.fun tokens > 50% curve filled',
    items: [
      {
        symbol: 'SOLPEPE',
        name: 'Solana Pepe',
        mint: 'CurveLaunchPulseTest1111111111111111111111111',
        time: '3m ago',
        price: '$0.000410',
        mcap: '$410K',
        liq: '$38K',
        riskScore: 15,
        riskBadge: 'LOW RISK',
        flags: ['Clean Mint/Freeze', 'Healthy Distribution (T10: 38%)'],
      },
    ],
  },
  {
    title: '🚀 DEX Migrated',
    subtitle: 'Successfully migrated to Raydium / Meteora pools',
    items: [
      {
        symbol: 'POPCAT',
        name: 'Popcat',
        mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        time: '1h ago',
        price: '$1.42',
        mcap: '$1.39B',
        liq: '$14.2M',
        riskScore: 0,
        riskBadge: 'LOW RISK',
        flags: ['100% LP Burned', 'Mint Revoked', 'Freeze Revoked'],
      },
      {
        symbol: 'WIF',
        name: 'dogwifhat',
        mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        time: '2h ago',
        price: '$2.38',
        mcap: '$2.38B',
        liq: '$32.0M',
        riskScore: 0,
        riskBadge: 'LOW RISK',
        flags: ['100% LP Burned', 'Top 10 = 22.1%'],
      },
    ],
  },
];

export default function PulsePage() {
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Pulse Feed</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          3-Stage pipeline streaming token genesis, bonding curve momentum, and DEX pool migrations in real time.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {PULSE_STAGES.map((col, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700' }}>{col.title}</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '2px' }}>{col.subtitle}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {col.items.map((item) => (
                <div
                  key={item.mint}
                  onClick={() => window.location.href = `/tokens/${item.mint}`}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: '800', color: '#fff', fontSize: '15px' }}>${item.symbol}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-sub)', marginLeft: '6px' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.time}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    <div>Price: <strong style={{ color: '#fff' }}>{item.price}</strong></div>
                    <div>MC: <strong style={{ color: '#fff' }}>{item.mcap}</strong></div>
                    <div>Liq: <strong style={{ color: '#fff' }}>{item.liq}</strong></div>
                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={item.riskScore >= 70 ? 'badge badge-risk' : item.riskScore >= 30 ? 'badge badge-demo' : 'badge badge-safe'}>
                      Risk: {item.riskScore}/100 ({item.riskBadge})
                    </span>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {item.flags.map((f, i) => (
                      <div key={i}>• {f}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
