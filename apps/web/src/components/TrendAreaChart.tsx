'use client';

import React, { useId } from 'react';

export interface PriceHistoryItem {
  t?: number;
  p?: number;
  price?: number;
  takenAt?: string;
}

export interface TrendAreaChartProps {
  data?: (number | PriceHistoryItem)[];
  timeframe?: '1m' | '5m' | '30m' | '1h' | '24h' | 'ALL';
  width?: number;
  height?: number;
  showPercentChange?: boolean;
}

export function TrendAreaChart({
  data = [],
  timeframe = '5m',
  width = 84,
  height = 24,
  showPercentChange = true,
}: TrendAreaChartProps) {
  const gradientId = useId().replace(/:/g, '_');

  // Normalize input objects into timestamped price points
  const parsedPoints: { t: number; p: number }[] = (data || [])
    .map((item, idx) => {
      if (typeof item === 'number') {
        return { t: idx, p: item };
      }
      const p = typeof item?.p === 'number' ? item.p : typeof item?.price === 'number' ? item.price : NaN;
      let t = typeof item?.t === 'number' ? item.t : 0;
      if (!t && item?.takenAt) {
        t = new Date(item.takenAt).getTime();
      }
      return { t: t || idx, p };
    })
    .filter((pt) => !isNaN(pt.p) && pt.p > 0);

  // Timeframe resampling / window filtering
  let visiblePoints = parsedPoints;
  const now = Date.now();

  const timeframeMsMap: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };

  const windowMs = timeframe !== 'ALL' ? timeframeMsMap[timeframe] : undefined;
  if (windowMs && parsedPoints.length > 0 && parsedPoints[parsedPoints.length - 1].t > 1000000) {
    const cutoff = now - windowMs;
    const filtered = parsedPoints.filter((pt) => pt.t >= cutoff);
    if (filtered.length >= 3) {
      visiblePoints = filtered;
    } else {
      // Show default 30–50 points
      visiblePoints = parsedPoints.slice(-40);
    }
  } else {
    // Default 30–50 points
    visiblePoints = parsedPoints.slice(-40);
  }

  // Requirement: If a token genuinely has < 3 price points, show "collecting price data…" instead of a flat line.
  // Never draw a straight line from a single point. Never synthesize or interpolate fake points.
  if (visiblePoints.length < 3) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 7px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed var(--border-color)',
          fontSize: '10px',
          color: 'var(--text-sub)',
        }}
        title="Waiting for real price ticks (sampled every 20s)..."
      >
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#f59e0b',
            display: 'inline-block',
          }}
        />
        <span style={{ whiteSpace: 'nowrap', fontStyle: 'italic' }}>collecting price data…</span>
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

  // Map to SVG coordinates
  const coords = prices.map((p, idx) => {
    const x = (idx / (prices.length - 1)) * width;
    const y = height - ((p - yMin) / yRange) * (height - 4) - 2;
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${polylinePoints} ${width.toFixed(1)},${height} 0,${height}`;

  const strokeColor = isUp ? 'var(--up, #10b981)' : 'var(--down, #ef4444)';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Dynamic Area Fill */}
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />

        {/* Thin Stroke line (no chunky strokes) */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price endpoint dot */}
        {coords.length > 0 && (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r="2.2"
            fill={strokeColor}
          />
        )}
      </svg>

      {/* % change label next to the chart */}
      {showPercentChange && (
        <span
          className="num-mono"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: strokeColor,
            minWidth: '42px',
            textAlign: 'right',
          }}
        >
          {isUp ? '+' : ''}
          {pctChange.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
