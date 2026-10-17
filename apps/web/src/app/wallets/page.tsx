'use client';

import React, { useState } from 'react';

interface Wallet {
  id: string;
  address: string;
  label: string;
  winRate: number;
  pnl7d: number;
  rugTouchRate: number;
}

const INITIAL_WALLETS: Wallet[] = [
  {
    id: '1',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'Whale Alpha 1',
    winRate: 68.5,
    pnl7d: 14200,
    rugTouchRate: 2.1,
  },
  {
    id: '2',
    address: '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
    label: 'Pump Sniper Lead',
    winRate: 72.0,
    pnl7d: 28450,
    rugTouchRate: 1.5,
  },
];

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [inputAddress, setInputAddress] = useState('');
  const [inputLabel, setInputLabel] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAddress) return;
    const newWallet: Wallet = {
      id: String(Date.now()),
      address: inputAddress,
      label: inputLabel || 'Smart Trader',
      winRate: 64.0,
      pnl7d: 8200,
      rugTouchRate: 3.2,
    };
    setWallets([...wallets, newWallet]);
    setInputAddress('');
    setInputLabel('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Smart-Money Tracking & Copy Signals</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Follow top-performing Solana wallets. Receive instant alert signals on every swap. No auto-trading custody.
          </p>
        </div>
        <span className="badge badge-hunter">Hunter Tier: {wallets.length} / 10 Wallets</span>
      </div>

      {/* Add Wallet Form */}
      <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Solana Wallet Address (e.g. 7xKX...)"
          value={inputAddress}
          onChange={(e) => setInputAddress(e.target.value)}
          style={{
            flex: 2,
            minWidth: '280px',
            background: 'var(--bg-secondary)',
            color: '#fff',
            border: '1px solid var(--border-color)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <input
          type="text"
          placeholder="Label (e.g. Pump Sniper)"
          value={inputLabel}
          onChange={(e) => setInputLabel(e.target.value)}
          style={{
            flex: 1,
            minWidth: '160px',
            background: 'var(--bg-secondary)',
            color: '#fff',
            border: '1px solid var(--border-color)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        />
        <button type="submit" className="btn btn-primary">
          + Track Wallet
        </button>
      </form>

      {/* Tracked Wallets Table */}
      <div className="glass-panel" style={{ overflowX: 'auto', marginBottom: '30px' }}>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Wallet Label</th>
              <th>Address</th>
              <th>7d Win Rate</th>
              <th>7d Realized PnL</th>
              <th>Rug-Touch Rate</th>
              <th>Signals Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id}>
                <td style={{ fontWeight: '700', color: '#fff' }}>{w.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-sub)' }}>
                  {w.address.slice(0, 6)}...{w.address.slice(-6)}
                </td>
                <td style={{ fontWeight: '600', color: w.winRate >= 65 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                  {w.winRate}%
                </td>
                <td style={{ fontWeight: '700', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  +${w.pnl7d.toLocaleString()}
                </td>
                <td style={{ color: w.rugTouchRate < 3 ? 'var(--accent-emerald)' : 'var(--accent-warning)' }}>
                  {w.rugTouchRate}%
                </td>
                <td>
                  <span className="badge badge-safe">Active Stream</span>
                </td>
                <td>
                  <button
                    onClick={() => setWallets(wallets.filter((x) => x.id !== w.id))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Untrack
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Signals Stream */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>
          📡 Live Copy-Trade Signals Feed
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="badge badge-safe" style={{ marginRight: '8px' }}>🟢 BUY SIGNAL</span>
              <strong>Whale Alpha 1</strong> bought <strong>$5,000 USD</strong> of <strong>$BONK</strong> @ $0.0000214
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>2m ago</span>
          </div>

          <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="badge badge-risk" style={{ marginRight: '8px' }}>🔴 SELL SIGNAL</span>
              <strong>Pump Sniper Lead</strong> sold <strong>$12,500 USD</strong> of <strong>$SOLPEPE</strong> @ $0.000410
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>14m ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
