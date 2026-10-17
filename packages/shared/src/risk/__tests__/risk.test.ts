import { describe, it, expect } from 'vitest';
import { evaluateTokenRisk } from '../index.js';

describe('Risk & Momentum Scoring Engine', () => {
  it('flags mint and freeze authority as critical hazards', () => {
    const report = evaluateTokenRisk({
      mintAuthorityRevoked: false,
      freezeAuthorityRevoked: false,
      lpBurnedOrLockedPct: 100,
      top10Pct: 20,
      devHoldingPct: 2,
      liquidityUsd: 50000,
      mcapUsd: 150000,
      volume5m: 10000,
      buys5m: 50,
      sells5m: 20,
      holderCount: 250,
    });

    expect(report.riskScore).toBeGreaterThanOrEqual(55);
    const codes = report.flags.map((f) => f.code);
    expect(codes).toContain('FLAG_MINT_AUTHORITY_ENABLED');
    expect(codes).toContain('FLAG_FREEZE_AUTHORITY_ENABLED');
    expect(report.confidence).toBe('HIGH');
  });

  it('rewards clean token with high momentum and low risk', () => {
    const report = evaluateTokenRisk({
      mintAuthorityRevoked: true,
      freezeAuthorityRevoked: true,
      lpBurnedOrLockedPct: 100,
      top10Pct: 18,
      devHoldingPct: 1,
      liquidityUsd: 80000,
      mcapUsd: 400000,
      volume5m: 60000,
      buys5m: 120,
      sells5m: 30,
      holderCount: 450,
      tokenAgeMinutes: 60,
    });

    expect(report.riskScore).toBe(0);
    expect(report.momentumScore).toBeGreaterThanOrEqual(70);
    expect(report.flags).toHaveLength(0);
    expect(report.confidence).toBe('HIGH');
  });

  it('detects extreme top-10 concentration and unlocked LP', () => {
    const report = evaluateTokenRisk({
      mintAuthorityRevoked: true,
      freezeAuthorityRevoked: true,
      lpBurnedOrLockedPct: 10,
      top10Pct: 65,
      devHoldingPct: 12,
      liquidityUsd: 5000,
      mcapUsd: 80000,
      volume5m: 2000,
      buys5m: 5,
      sells5m: 15,
      holderCount: 15,
      tokenAgeMinutes: 2,
    });

    expect(report.riskScore).toBeGreaterThanOrEqual(80);
    const codes = report.flags.map((f) => f.code);
    expect(codes).toContain('FLAG_LP_UNLOCKED');
    expect(codes).toContain('FLAG_EXTREME_TOP10_CONCENTRATION');
    expect(codes).toContain('FLAG_DEV_HOLDING_EXCESS');
    expect(codes).toContain('FLAG_LOW_LIQUIDITY');
    expect(report.confidence).toBe('LOW'); // new launch with few holders
  });
});
