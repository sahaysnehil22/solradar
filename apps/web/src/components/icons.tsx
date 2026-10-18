import React from 'react';

export function RadarIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <style>{`
        .radar-sweep { transform-origin: 12px 12px; animation: radar-rotate 3s linear infinite; }
        @keyframes radar-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .radar-blip { animation: radar-blink 1.5s ease-in-out infinite; }
        @keyframes radar-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
      `}</style>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <g className="radar-sweep">
        <path d="M12 12 L12 3 A9 9 0 0 1 18.4 5.6 Z" fill="currentColor" opacity="0.7" />
      </g>
      <circle className="radar-blip" cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function AlertTriangleIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function CopyIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function CheckIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function SearchIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function SparklineSvg({ data = [], width = 70, height = 20, isUp }: { data?: number[]; width?: number; height?: number; isUp?: boolean }) {
  if (!data || data.length < 3) {
    return (
      <span style={{ fontSize: '10px', color: 'var(--text-sub)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
        collecting…
      </span>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const delta = max - min;
  const padding = delta === 0 ? (min * 0.005 || 0.000001) : delta * 0.08;
  const yMin = min - padding;
  const yMax = max + padding;
  const range = yMax - yMin || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - yMin) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Green if first -> last is positive, red if negative (Axiom style)
  const isPositive = isUp !== undefined ? isUp : data[data.length - 1] >= data[0];
  const strokeColor = isPositive ? 'var(--up)' : 'var(--down)';

  return (
    <svg width={width} height={height} className="sparkline" style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}
