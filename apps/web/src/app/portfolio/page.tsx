'use client';

import React, { useState } from 'react';

export default function PortfolioPage() {
  const [addresses, setAddresses] = useState([
    { id: '1', address: 'PublicSolanaAddressTest11111111111111111111', label: 'Phantom Main' },
  ]);
  const [inputAddress, setInputAddress] = useState('');
  const [inputLabel, setInputLabel] = useState('');

  const holdings = [
    { symbol: 'BONK', balance: '150,000,000', price: '$0.0000214', value: '$3,210.00', change: '+4.8%' },
    { symbol: 'WIF', balance: '1,200', price: '$2.38', value: '$2,856.00', change: '-1.2%' },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAddress) return;
    setAddresses([...addresses, { id: String(Date.now()), address: inputAddress, label: inputLabel || 'Trading Wallet' }]);
    setInputAddress('');
    setInputLabel('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Read-Only Portfolio Tracker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Monitor your balances across multiple public addresses. SolRadar never asks for or stores private keys.
          </p>
        </div>
        <span className="badge badge-hunter">Hunter Feature</span>
      </div>

      {/* Portfolio Value Summary Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Total Estimated Net Worth</div>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#fff', marginTop: '4px' }}>
            $6,066.00 <span style={{ fontSize: '14px', color: 'var(--accent-emerald)' }}>+2.1% (24h)</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Active Public Addresses</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginTop: '4px' }}>
            {addresses.length} Wallets
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <span className="badge badge-safe">Read-Only RPC Sync</span>
        </div>
      </div>

      {/* Add Public Address Form */}
      <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Public Solana Address"
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
          placeholder="Label (e.g. Ledger Cold Storage)"
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
          + Add Public Address
        </button>
      </form>

      {/* Holdings Table */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Quantity</th>
              <th>Current Price</th>
              <th>Value (USD)</th>
              <th>24h Change</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol}>
                <td style={{ fontWeight: '700', color: '#fff' }}>${h.symbol}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{h.balance}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{h.price}</td>
                <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{h.value}</td>
                <td style={{ color: h.change.startsWith('+') ? 'var(--accent-emerald)' : 'var(--accent-danger)' }}>
                  {h.change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
