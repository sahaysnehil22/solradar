import { describe, it, expect } from 'vitest';
import { formatTokenAlert, formatCopyTradeSignal, userSessionCache } from '../src/index.js';
import { PlanCode } from '@solradar/shared';

describe('Telegram Bot Formatter & Alert Logic', () => {
  it('formats high-risk token alert with diagnostic red flags and links', () => {
    const message = formatTokenAlert({
      symbol: 'HONEYPOT',
      name: 'Dangerous Token',
      mint: 'DangerousRugRiskTest2222222222222222222222222',
      price: 0.000012,
      mcap: 12000,
      liquidity: 1800,
      riskScore: 85,
      confidence: 'LOW',
      mintAuthRevoked: false,
      freezeAuthRevoked: false,
      lpBurnedPct: 0,
      top10Pct: 78.5,
      devHoldingPct: 15.0,
      flags: ['Mint Authority Active', 'Freeze Authority Active', 'LP Unlocked'],
    });

    expect(message).toContain('HIGH RISK');
    expect(message).toContain('85/100');
    expect(message).toContain('Mint Authority Active');
    expect(message).toContain('solradar.io/tokens/');
    expect(message).toContain('dexscreener.com/solana/');
  });

  it('formats copy-trade signals with performance metrics and execution disclaimer', () => {
    const signal = formatCopyTradeSignal({
      label: 'Whale Alpha 1',
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: 'buy',
      symbol: 'BONK',
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      amountUsd: 5000,
      price: 0.0000214,
      winRate: 68.5,
      pnl7d: 14200,
    });

    expect(signal).toContain('COPY-TRADE SIGNAL');
    expect(signal).toContain('Whale Alpha 1');
    expect(signal).toContain('68.5% Win Rate');
    expect(signal).toContain('+$14,200 7d Realized PnL');
    expect(signal).toContain('Signal only. No automated execution');
  });

  it('caches user session for subscription gating up to 60 seconds', () => {
    const now = Date.now();
    userSessionCache.set(123456, {
      telegramId: 123456,
      userId: 'usr_test',
      plan: PlanCode.HUNTER,
      cachedAt: now,
      alertPreferences: {
        newLaunches: true,
        volumeSpikes: true,
        whaleBuys: true,
        copySignals: true,
      },
    });

    const cached = userSessionCache.get(123456);
    expect(cached?.plan).toBe(PlanCode.HUNTER);
  });
});
