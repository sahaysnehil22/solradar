'use client';

import React, { useState, useId } from 'react';

export interface PricePoint {
  t?: number;
  p?: number;
  price?: number;
  takenAt?: string;
}

export interface PriceChartProps {
  data?: (number | PricePoint)[];
  symbol?: string;
  height?: number;
}

type Timeframe = '1m' | '5m' | '30m' | '1h' | '24h' | 'ALL';

export function PriceChart({ data = [], symbol = 'TOKEN', height = 180 }: PriceChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5m');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '_');

  // Normalize all points to { t, p, takenAt }
  const allPoints: { t: number; p: number; takenAt?: string }[] = (data || [])
    .map((item, idx) => {
      if (typeof item === 'number') {
        return { t: idx, p: item };
      }
      const p = typeof item?.p === 'number' ? item.p : typeof item?.price === 'number' ? item.price : NaN;
      let t = typeof item?.t === 'number' ? item.t : 0;
      if (!t && item?.takenAt) {
        t = new Date(item.takenAt).getTime();
      }
      return { t: t || idx, p, takenAt: item?.takenAt };
    })
    .filter((pt) => !isNaN(pt.p) && pt.p > 0);

  // Timeframe resampling / window filtering
  const now = Date.now();
  const timeframeMsMap: Record<Timeframe, number | undefined> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    ALL: undefined,
  };

  let visiblePoints = allPoints;
  const windowMs = timeframeMsMap[selectedTimeframe];
  if (windowMs && allPoints.length > 0 && allPoints[allPoints.length - 1].t > 1000000) {
    const cutoff = now - windowMs;
    const filtered = allPoints.filter((pt) => pt.t >= cutoff);
    if (filtered.length >= 3) {
      visiblePoints = filtered;
    } else {
      // Default to last 30–50 points if window is too sparse
      visiblePoints = allPoints.slice(-40);
    }
  } else if (selectedTimeframe !== 'ALL') {
    visiblePoints = allPoints.slice(-40);
  }

  // Format price helper
  const formatPrice = (p: number) => {
    if (p < 0.00001) return `$${p.toFixed(8)}`;
    if (p < 0.001) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(2)}`;
  };

  // If token genuinely has < 3 points, show "collecting price data…" state
  if (allPoints.length < 3) {
    const currentPrice = allPoints[allPoints.length - 1]?.p;
    return (
      <div
        style={{
          minHeight: height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          padding: '24px 16px',
          color: 'var(--text-sub)',
          textAlign: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#f59e0b',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
            Collecting price data…
          </span>
        </div>
        <p style={{ fontSize: '11px', margin: 0, maxWidth: '280px', lineHeight: 1.5 }}>
          The background price sampler records real on-chain quotes every 20 seconds.
          Charts unlock once ≥ 3 points are gathered.
        </p>
        {currentPrice && (
          <div
            style={{
              marginTop: '4px',
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
            }}
          >
            Latest Price:{' '}
            <strong className="num-mono" style={{ color: 'var(--text-main)' }}>
              {formatPrice(currentPrice)}
            </strong>
          </div>
        )}
      </div>
    );
  }

  const prices = visiblePoints.map((pt) => pt.p);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;
  const pctChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  // Auto-scale the Y axis to the visible window (min/max of shown points) so small moves are visible
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const delta = maxPrice - minPrice;
  const padding = delta === 0 ? (minPrice * 0.005 || 0.000001) : delta * 0.08;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;
  const yRange = yMax - yMin || 1;

  const width = 420;
  const chartHeight = Math.max(90, height - 70);

  const points = prices.map((val, idx) => {
    const x = (idx / (prices.length - 1)) * width;
    const y = chartHeight - ((val - yMin) / yRange) * (chartHeight - 16) - 8;
    return { x, y, price: val, t: visiblePoints[idx].t, takenAt: visiblePoints[idx].takenAt };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPoints = `${polylinePoints} ${width},${chartHeight} 0,${chartHeight}`;

  const strokeColor = isUp ? 'var(--up, #10b981)' : 'var(--down, #ef4444)';

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : points[points.length - 1];
  const displayPrice = activePoint ? activePoint.price : lastPrice;

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header: Price, % Change, Timeframe Selectors */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }} className="num-mono">
              {formatPrice(displayPrice)}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: strokeColor,
              }}
              className="num-mono"
            >
              {isUp ? '+' : ''}
              {pctChange.toFixed(2)}%
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '2px' }}>
            H: <strong className="num-mono">{formatPrice(maxPrice)}</strong> · L:{' '}
            <strong className="num-mono">{formatPrice(minPrice)}</strong>
            {activePoint?.takenAt && (
              <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                {new Date(activePoint.takenAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Timeframe Buttons: 1m, 5m, 30m, 1h, 24h, ALL */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-main)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          {(['1m', '5m', '30m', '1h', '24h', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              style={{
                background: selectedTimeframe === tf ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: selectedTimeframe === tf ? 'var(--text-main)' : 'var(--text-sub)',
                border: 'none',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: selectedTimeframe === tf ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Interactive Area Chart */}
      <div
        style={{ width: '100%', overflow: 'hidden', position: 'relative' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          style={{ width: '100%', height: chartHeight, overflow: 'visible', cursor: 'crosshair' }}
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const ratio = mouseX / rect.width;
            const targetIdx = Math.round(ratio * (points.length - 1));
            setHoveredIdx(Math.max(0, Math.min(targetIdx, points.length - 1)));
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <polygon points={areaPoints} fill={`url(#${gradientId})`} />

          {/* Chart line (thin stroke, no chunky lines) */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Hover Crosshair Line and Dot */}
          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={chartHeight}
                stroke="var(--border-color)"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill={strokeColor}
                stroke="var(--bg-main)"
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
