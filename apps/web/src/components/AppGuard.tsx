'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredToken, getMe } from '../lib/api';
import { TelegramLoginWidget } from './TelegramLoginWidget';

export function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      // Unauthenticated: redirect to landing with login CTA
      router.push('/?login=required');
      setChecking(false);
      return;
    }

    // Verify token with backend
    getMe().then((user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        router.push('/?login=required');
      }
      setChecking(false);
    });
  }, [pathname, router]);

  if (checking) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', marginBottom: '12px' }}>
          <div className="badge badge-hunter">Terminal Security</div>
        </div>
        <div>Verifying terminal credentials...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '420px', margin: '60px auto', padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)', textAlign: 'center' }}>
          Terminal Access Required
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center' }}>
          Please sign in via Telegram to access live signals, alerts, and tracking.
        </p>
        <TelegramLoginWidget
          onSuccess={() => {
            setIsAuthenticated(true);
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
