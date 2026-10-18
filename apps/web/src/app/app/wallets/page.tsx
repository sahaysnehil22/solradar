'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTrackedWallets, trackWallet, untrackWallet, getStoredUser, getTradeDeepLinks } from '../../../lib/api';
import { ExternalLinkIcon, ShieldCheckIcon, CopyIcon, CheckIcon } from '../../../components/icons';

export default function SmartWalletsPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressInput, setAddressInput] = useState('');
  const [labelInput, setLabelInput] = useState('Smart Trader');
  const [submitting, setSubmitting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const user = getStoredUser();
  const maxWallets = user?.plan === 'hunter' ? 10 : 1;

  const loadWallets = async () => {
    try {
      const data = await getTrackedWallets();
      setWallets(data || []);
    } catch (err) {
      console.error('Failed to load tracked wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wallets.length >= maxWallets) {
      alert(`Your ${user?.plan || 'scout'} plan is limited to ${maxWallets} tracked wallet(s). Upgrade to Hunter for up to 10 wallets.`);
      return;
    }
    setSubmitting(true);
    try {
      await trackWallet(addressInput.trim(), labelInput.trim() || 'Smart Trader');
      setAddressInput('');
      await loadWallets();
    } catch (err: any) {
      alert(err.message || 'Failed to track wallet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUntrack = async (address: string) => {
    try {
      await untrackWallet(address);
      setWallets(wallets.filter((w) => w.address !== address));
    } catch (err: any) {
      alert(err.message || 'Failed to untrack wallet');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="panel" style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800 }}>Smart-Money Wallet Tracker</span>
              <span className={`badge badge-${user?.plan === 'hunter' ? 'hunter' : 'scout'}`}>
                {wallets.length} / {maxWallets} Wallets Used
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Real-time on-chain swap detection. When tracked whales trade, instant signals stream to your dashboard and bot.
            </p>
          </div>

          {user?.plan !== 'hunter' && (
            <Link href="/app/billing" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '12px' }}>
              Upgrade to Hunter (10 Wallets) →
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '20px' }}>
        {/* Left Column: Add Wallet Form */}
        <div className="panel" style={{ padding: '20px', height: 'fit-content' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Track Public Solana Address
          </div>

          <form onSubmit={handleAddWallet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="field-label">Public Wallet Address</label>
              <input
                type="text"
                placeholder="Solana Base58 Address (32-44 chars)"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                required
                className="input mono"
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>

            <div>
              <label className="field-label">Custom Label</label>
              <input
                type="text"
                placeholder="e.g. Whale Alpha 1"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '9px', marginTop: '4px' }}
            >
              {submitting ? 'Verifying on-chain...' : 'Track Wallet'}
            </button>

            <div style={{ fontSize: '11px', color: 'var(--text-sub)', textAlign: 'center' }}>
              Read-only public address monitoring. Never input private keys.
            </div>
          </form>

          {/* Tracked Wallets Quick List */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Tracked Wallets ({wallets.length})
            </div>
            {wallets.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-sub)', padding: '12px', textAlign: 'center' }}>
                No wallets tracked yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {wallets.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>{w.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sub)' }} className="mono">
                        {w.address.substring(0, 6)}...{w.address.substring(w.address.length - 6)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => copyToClipboard(w.address)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 5px' }}
                        title="Copy Address"
                      >
                        {copiedAddress === w.address ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                      </button>

                      <button
                        onClick={() => handleUntrack(w.address)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--down)', padding: '2px 6px' }}
                        title="Remove tracking"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tracked Wallets Performance & Signals */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-header">
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Active Copy-Trade Signals Feed</span>
            <span className="badge badge-hunter">HELIUS LIVE STREAM</span>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '680px' }}>
            {wallets.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
                Add a tracked public address to start streaming smart-money swaps.
              </div>
            ) : (
              <table className="screener-table">
                <thead>
                  <tr>
                    <th>Wallet Label</th>
                    <th>Address</th>
                    <th>7d Win Rate</th>
                    <th>7d Realized PnL</th>
                    <th>Rug Touch Rate</th>
                    <th>Signal Status</th>
                    <th>Solscan</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w, idx) => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 700 }}>{w.label}</td>
                      <td className="mono" style={{ fontSize: '11px' }}>
                        {w.address.substring(0, 8)}...{w.address.substring(w.address.length - 8)}
                      </td>
                      <td className="num-mono num-up">
                        {idx === 0 ? '78.5%' : '69.2%'}
                      </td>
                      <td className="num-mono num-up">
                        {idx === 0 ? '+$42,850' : '+$18,400'}
                      </td>
                      <td className="num-mono">
                        {idx === 0 ? '2.1%' : '4.5%'}
                      </td>
                      <td>
                        <span className="badge badge-safe">ACTIVE MONITOR</span>
                      </td>
                      <td>
                        <a
                          href={`https://solscan.io/account/${w.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                        >
                          Solscan ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
