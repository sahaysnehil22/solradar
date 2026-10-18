'use client';

import React from 'react';

interface PricePoint {
  price: number;
  takenAt?: string;
}

interface PriceChartProps {
  data?: (number | PricePoint)[];
  symbol?: string;
  height?: number;
}

export function PriceChart({ data = [], symbol = 'TOKEN', height = 140 }: PriceChartProps) {
  // Extract clean numbers
  const prices: number[] = (data || [])
    .map((item) => (typeof item === 'number' ? item : item?.price))
    .filter((p): p is number => typeof p === 'number' && !isNaN(p) && p > 0);

  if (prices.length < 2) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          color: 'var(--text-sub)',
          fontSize: '12px',
        }}
      >
        <span style={{ fontSize: '20px', marginBottom: '6px' }}>📊</span>
        <span>Awaiting secondary price tick from on-chain transactions...</span>
        <span style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
          Current Price: ${prices[0] ? (prices[0] < 0.001 ? prices[0].toFixed(6) : prices[0].toFixed(4)) : '—'}
        </span>
      </div>
    );
  }

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;
  const pctChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || maxPrice * 0.05 || 1;

  const width = 420;
  const chartHeight = height - 34; // leave room for header labels

  const points = prices.map((val, idx) => {
    const x = (idx / (prices.length - 1)) * width;
    const y = chartHeight - ((val - minPrice) / range) * (chartHeight - 16) - 8;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPoints = `${polylinePoints} ${width},${chartHeight} 0,${chartHeight}`;

  const strokeColor = isUp ? 'var(--up)' : 'var(--down)';
  const gradientId = `grad_${isUp ? 'up' : 'down'}`;

  const formatPrice = (p: number) => (p < 0.001 ? `$${p.toFixed(6)}` : `$${p.toFixed(4)}`);

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header: Current Price & Real % Change */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 800 }} className="num-mono">
            {formatPrice(lastPrice)}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: strokeColor,
            }}
          >
            {isUp ? '+' : ''}
            {pctChange.toFixed(2)}%
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
          H: <strong className="num-mono">{formatPrice(maxPrice)}</strong> L:{' '}
          <strong className="num-mono">{formatPrice(minPrice)}</strong>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          style={{ width: '100%', height: chartHeight, overflow: 'visible' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? 'var(--up)' : 'var(--down)'} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isUp ? 'var(--up)' : 'var(--down)'} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <polygon points={areaPoints} fill={`url(#${gradientId})`} />

          {/* Chart line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current price endpoint dot */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3.5"
              fill={strokeColor}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
