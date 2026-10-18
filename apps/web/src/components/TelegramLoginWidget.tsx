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
    </div>
  );
}
