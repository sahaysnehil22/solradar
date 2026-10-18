'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TELEGRAM_BOT_USERNAME } from '../lib/config';
import { loginWithTelegram, UserSession } from '../lib/api';

interface TelegramLoginWidgetProps {
  onSuccess: (user: UserSession) => void;
  botName?: string;
  size?: 'large' | 'medium' | 'small';
}

export function TelegramLoginWidget({
  onSuccess,
  botName = TELEGRAM_BOT_USERNAME,
  size = 'large',
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    // Expose the global callback required by Telegram Login Widget
    (window as any).onTelegramAuth = async (user: any) => {
      setAuthenticating(true);
      setError(null);
      try {
        const result = await loginWithTelegram(user);
        onSuccess(result.user);
      } catch (err: any) {
        setError(err.message || 'Telegram authentication failed');
      } finally {
        setAuthenticating(false);
      }
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', botName);
      script.setAttribute('data-size', size);
      script.setAttribute('data-radius', '4');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      containerRef.current.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botName, size, onSuccess]);

  const handleQuickDemoLogin = async () => {
    setAuthenticating(true);
    setError(null);
    try {
      // Instant dev / test authentication flow with verified test hash
      const testPayload = {
        id: 8943169326,
        first_name: 'Solana',
        username: 'SolRadarTrader',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'test_mock_hash',
      };
      const result = await loginWithTelegram(testPayload);
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message || 'Demo authentication failed');
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {/* Official Telegram Login Widget Container */}
      <div
        ref={containerRef}
        style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />

      {authenticating && (
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          Verifying Telegram credentials & generating session JWT...
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: 'var(--down)', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: 'var(--radius)' }}>
          {error}
        </div>
      )}

      {/* Dev / Test mode instant access button */}
      <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleQuickDemoLogin}
          disabled={authenticating}
          className="btn btn-secondary"
          style={{ width: '100%', fontSize: '12px', padding: '8px 12px' }}
        >
          ⚡ Instant Test Login (Developer / Demo)
        </button>
        <span style={{ fontSize: '10px', color: 'var(--text-sub)', marginTop: '4px', display: 'block' }}>
          Issues a real signed backend JWT without requiring Telegram app focus
        </span>
      </div>
    </div>
  );
}
