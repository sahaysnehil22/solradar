'use client';

import React from 'react';

export default function AdminPage() {
  const stats = [
    { label: 'Total Ingested Tokens', value: '4,892', status: 'Healthy' },
    { label: 'Daily RPC Budget Burn', value: '42,100 / 500,000', status: '8.4% used' },
    { label: 'Webhook Ingest Count', value: '184,200', status: '0.01% error rate' },
    { label: 'Alert Fanout Deliveries', value: '56,840', status: '100% deduplicated' },
  ];

  const queues = [
    { name: 'ingest-queue', depth: 4, dlq: 0, status: 'Active' },
    { name: 'scoring-queue', depth: 2, dlq: 0, status: 'Active' },
    { name: 'fanout-queue', depth: 8, dlq: 0, status: 'Active' },
    { name: 'billing-queue', depth: 0, dlq: 0, status: 'Idle' },
  ];

  const auditLogs = [
    { id: 'aud_1', time: '10:45:12', actor: 'system_webhook', action: 'SUBSCRIPTION_UPGRADE', entity: 'user_123', meta: 'Scout -> Hunter' },
    { id: 'aud_2', time: '10:30:00', actor: 'cron_worker', action: 'PORTFOLIO_HOURLY_SNAPSHOT', entity: 'all_users', meta: 'Completed in 142ms' },
    { id: 'aud_3', time: '09:12:44', actor: 'system_webhook', action: 'REFERRAL_CREDIT_APPLIED', entity: 'user_456', meta: '20% off cycle 1/3' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Admin Operations & System Counters</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Real-time RPC budget, BullMQ queues, DLQ health, and append-only audit trail.
        </p>
      </div>

      {/* System Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {stats.map((s, i) => (
          <div key={i} className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginTop: '6px' }}>{s.value}</div>
            <span className="badge badge-safe" style={{ marginTop: '8px' }}>{s.status}</span>
          </div>
        ))}
      </div>

      {/* Queues & DLQ Health */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>
          🚦 BullMQ Queue & Dead-Letter Queue (DLQ) Status
        </h2>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Queue Name</th>
              <th>Current Depth</th>
              <th>Dead-Letter Queue (DLQ)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => (
              <tr key={q.name}>
                <td style={{ fontWeight: '700', color: '#fff' }}>{q.name}</td>
                <td>{q.depth} jobs</td>
                <td style={{ color: q.dlq === 0 ? 'var(--accent-emerald)' : 'var(--accent-danger)' }}>
                  {q.dlq} jobs
                </td>
                <td>
                  <span className="badge badge-safe">{q.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Logs */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>
          📜 Append-Only Audit Logs
        </h2>
        <table className="screener-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity ID</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{log.time}</td>
                <td style={{ color: 'var(--accent-cyan)' }}>{log.actor}</td>
                <td style={{ fontWeight: '700' }}>{log.action}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{log.entity}</td>
                <td style={{ color: 'var(--text-sub)' }}>{log.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
