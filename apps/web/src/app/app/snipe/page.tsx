'use client';

import React, { useState, useEffect } from 'react';
import { getSnipeRules, createSnipeRule, deleteSnipeRule, getSnipeTriggers, getTradeDeepLinks } from '../../../lib/api';
import { BellIcon, CopyIcon, CheckIcon, ShieldCheckIcon, AlertTriangleIcon } from '../../../components/icons';

export default function SnipeAlertsPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State for New Rule
  const [ruleName, setRuleName] = useState('Pump.fun Fast Launch Snipe');
  const [launchpad, setLaunchpad] = useState<'all' | 'pump.fun' | 'raydium'>('pump.fun');
  const [minLiquidity, setMinLiquidity] = useState(5000);
  const [maxRisk, setMaxRisk] = useState(40);
  const [maxDevHolding, setMaxDevHolding] = useState(10);
  const [creating, setCreating] = useState(false);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [rulesData, triggersData] = await Promise.all([
        getSnipeRules(),
        getSnipeTriggers(),
      ]);
      setRules(rulesData || []);
      setTriggers(triggersData || []);
    } catch (err) {
      console.error('Failed to load snipe alerts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createSnipeRule({
        name: ruleName,
        launchpad,
        minLiquidityUsd: minLiquidity,
        maxRiskScore: maxRisk,
        maxDevHoldingPct: maxDevHolding,
        channel: 'telegram',
      });
      setRuleName('Pump.fun Launch Alert');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create snipe rule');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteSnipeRule(id);
      setRules(rules.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMint(text);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Banner */}
      <div className="panel" style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800 }}>Snipe Alert Engine</span>
              <span className="badge badge-hunter">Non-Custodial Signals</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Instant Telegram dispatch (&lt;2s target) with pre-filled trade links. You execute manually in your own wallet.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }} className="mono">
            <div>RULES ACTIVE: <strong className="num-up">{rules.length}</strong></div>
            <div>SIGNALS DELIVERED: <strong className="num-up">{triggers.length}</strong></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '20px' }}>
        {/* Left Column: Create Snipe Rule Form */}
        <div className="panel" style={{ padding: '20px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <BellIcon size={16} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Create Snipe Rule</span>
          </div>

          <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="field-label">Rule Label</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                required
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label className="field-label">Launchpad</label>
              <select
                value={launchpad}
                onChange={(e) => setLaunchpad(e.target.value as any)}
                className="select"
                style={{ width: '100%' }}
              >
                <option value="pump.fun">Pump.fun Bonding Curves</option>
                <option value="raydium">Raydium AMM Migrations</option>
                <option value="all">All Launchpads</option>
              </select>
            </div>

            <div>
              <label className="field-label">Minimum Initial Liquidity ($)</label>
              <input
                type="number"
                min={500}
                max={500000}
                step={500}
                value={minLiquidity}
                onChange={(e) => setMinLiquidity(Number(e.target.value))}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="field-label">Max Risk Score</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={maxRisk}
                  onChange={(e) => setMaxRisk(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="field-label">Max Dev Hold %</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxDevHolding}
                  onChange={(e) => setMaxDevHolding(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px', padding: '10px' }}
            >
              {creating ? 'Activating Rule...' : 'Deploy Snipe Rule'}
            </button>
          </form>

          {/* Active Rules List */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Your Configured Rules ({rules.length})
            </div>
            {rules.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-sub)', padding: '12px', textAlign: 'center' }}>
                No active snipe rules. Deploy one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules.map((r) => (
                  <div
                    key={r.id}
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
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                        Liq &gt; ${r.minLiquidityUsd} • Risk &lt; {r.maxRiskScore} • {r.launchpad}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--down)', padding: '2px 6px' }}
                      title="Delete rule"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Triggered Snipe Alerts Stream */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-header">
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Recent Triggered Snipe Signals</span>
            <span className="badge badge-safe">{triggers.length} MATCHES</span>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '680px' }}>
            {triggers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
                No matching launches detected yet. When an on-chain token launch satisfies your rules, it will stream here and to Telegram instantly.
              </div>
            ) : (
              <table className="screener-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Price</th>
                    <th>Market Cap</th>
                    <th>Liquidity</th>
                    <th>Risk</th>
                    <th>Delivered At</th>
                    <th>One-Tap Snipe Links</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((t) => {
                    const links = getTradeDeepLinks(t.mint);
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ fontWeight: 800 }}>${t.symbol}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{t.name}</div>
                        </td>
                        <td className="num-mono">${t.price < 0.001 ? t.price.toFixed(6) : t.price.toFixed(3)}</td>
                        <td className="num-mono">${(t.mcap / 1e3).toFixed(1)}k</td>
                        <td className="num-mono">${(t.liquidityUsd / 1e3).toFixed(1)}k</td>
                        <td>
                          <span className={`badge ${t.riskScore < 30 ? 'badge-safe' : 'badge-demo'}`}>
                            {t.riskScore}/100
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-sub)' }} className="mono">
                          {new Date(t.deliveredAt).toLocaleTimeString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => copyToClipboard(t.mint)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 6px' }}
                              title="Copy CA"
                            >
                              {copiedMint === t.mint ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                            </button>

                            <a
                              href={links.axiom}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 7px', fontSize: '11px' }}
                            >
                              Axiom ↗
                            </a>

                            <a
                              href={links.bullx}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 7px', fontSize: '11px' }}
                            >
                              BullX ↗
                            </a>

                            <a
                              href={links.photon}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 7px', fontSize: '11px' }}
                            >
                              Photon ↗
                            </a>

                            <a
                              href={links.jupiter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              Jupiter ↗
                            </a>
                          </div>
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
    </div>
  );
}
