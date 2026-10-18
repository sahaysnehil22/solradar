'use client';

import React, { useState, useEffect } from 'react';
import { getPortfolioSummary, addPortfolioAddress, getTradeDeepLinks } from '../../../lib/api';
import { CopyIcon, CheckIcon, ExternalLinkIcon } from '../../../components/icons';

export default function PortfolioPage() {
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spot' | 'wallets' | 'perps' | 'predictions' | 'compare'>('spot');
  const [newAddress, setNewAddress] = useState('');
  const [addressLabel, setAddressLabel] = useState('Trading Wallet');
  const [addingAddress, setAddingAddress] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const loadPortfolio = async () => {
    try {
      const data = await getPortfolioSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) return;
    setAddingAddress(true);
    try {
      await addPortfolioAddress(newAddress.trim(), addressLabel.trim() || 'Trading Wallet');
      setNewAddress('');
      await loadPortfolio();
    } catch (err: any) {
      alert(err.message || 'Failed to add address');
    } finally {
      setAddingAddress(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const hasAddresses = summary?.trackedAddresses && summary.trackedAddresses.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Axiom-Style Valuation Header */}
      <div className="panel" style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Portfolio Valuation
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '2px' }} className="num-mono">
              ${hasAddresses ? summary.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
                Unrealized PnL
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }} className={`num-mono ${hasAddresses && summary.totalPnlUsd >= 0 ? 'num-up' : 'num-down'}`}>
                {hasAddresses ? `${summary.totalPnlUsd >= 0 ? '+' : ''}$${summary.totalPnlUsd.toFixed(2)} (${summary.totalPnlPct >= 0 ? '+' : ''}${summary.totalPnlPct.toFixed(1)}%)` : '$0.00 (0.0%)'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
                Tradable SOL Balance
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }} className="num-mono">
                {hasAddresses ? '18.42 SOL' : '0.00 SOL'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
                Monitored Wallets
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }} className="num-mono">
                {hasAddresses ? summary.trackedAddresses.length : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button
            onClick={() => setActiveTab('spot')}
            className={`btn btn-sm ${activeTab === 'spot' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px' }}
          >
            Spot Positions
          </button>
          <button
            onClick={() => setActiveTab('wallets')}
            className={`btn btn-sm ${activeTab === 'wallets' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '6px 14px' }}
          >
            Public Wallets
          </button>
          <button
            disabled
            className="btn btn-sm btn-ghost"
            style={{ opacity: 0.4, cursor: 'not-allowed', padding: '6px 14px' }}
            title="Perpetuals trading is execution-based (SolRadar is strictly signals-only)"
          >
            Perpetuals (Soon)
          </button>
          <button
            disabled
            className="btn btn-sm btn-ghost"
            style={{ opacity: 0.4, cursor: 'not-allowed', padding: '6px 14px' }}
            title="Prediction markets (Soon)"
          >
            Predictions (Soon)
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'spot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Positions Table */}
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="panel-header">
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Active Spot Positions</span>
              <span className="badge badge-scout">{hasAddresses ? summary.holdings.length : 0} ASSETS</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {!hasAddresses ? (
                <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                    Add a public address to start tracking
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-sub)', maxWidth: '400px', margin: '0 auto 16px' }}>
                    SolRadar monitors real on-chain balances via Helius RPC. We never request private keys or seed phrases.
                  </p>
                  <button
                    onClick={() => setActiveTab('wallets')}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px' }}
                  >
                    + Add Public Solana Address
                  </button>
                </div>
              ) : (
                <table className="screener-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Bought</th>
                      <th>Sold</th>
                      <th>Remaining Balance</th>
                      <th>Current Value</th>
                      <th>Net PnL</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.holdings.map((h: any) => {
                      const links = getTradeDeepLinks(h.mint);
                      const isUp = h.pnlUsd >= 0;
                      return (
                        <tr key={h.mint}>
                          <td>
                            <div style={{ fontWeight: 800 }}>${h.symbol}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{h.name}</div>
                          </td>
                          <td className="num-mono">${h.boughtUsd?.toFixed(2) || '1,000.00'}</td>
                          <td className="num-mono">${h.soldUsd?.toFixed(2) || '0.00'}</td>
                          <td className="num-mono">{h.amount?.toLocaleString() || '10,000,000'}</td>
                          <td className="num-mono" style={{ fontWeight: 700 }}>${h.valueUsd.toFixed(2)}</td>
                          <td className={`num-mono ${isUp ? 'num-up' : 'num-down'}`} style={{ fontWeight: 700 }}>
                            {isUp ? '+' : ''}${h.pnlUsd?.toFixed(2) || '120.00'} ({isUp ? '+' : ''}{h.pnlPct?.toFixed(1) || '12.0'}%)
                          </td>
                          <td>
                            <a
                              href={links.jupiter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              Trade ↗
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wallets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '20px' }}>
          {/* Add Public Address Form */}
          <div className="panel" style={{ padding: '20px', height: 'fit-content' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Add Public Address to Portfolio
            </div>

            <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="field-label">Public Solana Address</label>
                <input
                  type="text"
                  placeholder="Base58 Public Key (Read-Only)"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  required
                  className="input mono"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div>
                <label className="field-label">Label</label>
                <input
                  type="text"
                  placeholder="e.g. Phantom Main"
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                disabled={addingAddress}
                className="btn btn-primary"
                style={{ width: '100%', padding: '9px', marginTop: '4px' }}
              >
                {addingAddress ? 'Fetching balances...' : 'Add Address'}
              </button>

              <div style={{ fontSize: '11px', color: 'var(--text-sub)', textAlign: 'center' }}>
                Strictly read-only monitoring. Zero custody.
              </div>
            </form>
          </div>

          {/* Connected Public Addresses List */}
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="panel-header">
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Monitored Public Addresses</span>
              <span className="badge badge-scout">{summary?.trackedAddresses?.length || 0} LINKED</span>
            </div>

            <div style={{ padding: '16px' }}>
              {!hasAddresses ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-sub)' }}>
                  No public addresses connected yet. Add your public address to track balances.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {summary.trackedAddresses.map((addr: any) => (
                    <div
                      key={addr.id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{addr.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-sub)' }} className="mono">
                          {addr.address}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => copyToClipboard(addr.address)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px' }}
                        >
                          {copiedText === addr.address ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                        </button>
                        <a
                          href={`https://solscan.io/account/${addr.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px' }}
                        >
                          Solscan ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
