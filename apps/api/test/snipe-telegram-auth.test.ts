import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';

describe('Snipe Rules & Telegram Auth API', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createServer();
  }, 25000);

  it('authenticates user via Telegram login widget data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram',
      payload: {
        id: 987654321,
        first_name: 'Sol',
        last_name: 'Sniper',
        username: 'solsniper_alpha',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'test_mock_hash',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.telegramId).toBe('987654321');
    expect(body.tokens.accessToken).toBeDefined();

    authToken = body.tokens.accessToken;
    userId = body.user.id;
  });

  it('creates a non-custodial snipe alert rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/snipe-rules',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Pump.fun <40 Risk Snipe',
        launchpad: 'pump.fun',
        minLiquidityUsd: 4000,
        maxRiskScore: 40,
        maxDevHoldingPct: 8,
        channel: 'telegram',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Pump.fun <40 Risk Snipe');
    expect(body.minLiquidityUsd).toBe(4000);
  });

  it('retrieves user snipe rules and matches launch tokens', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/snipe-rules',
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const rules = JSON.parse(listRes.body);
    expect(rules.length).toBeGreaterThan(0);

    // Ingest a webhook launch token matching rule
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/tokens/webhook/helius',
      payload: [
        {
          mint: 'MatchingSnipeTokenMint9999999999999999999',
          symbol: 'SNIPED',
          name: 'Sniped Token Alpha',
          priceUsd: 0.00025,
          mcapUsd: 25000,
          liquidityUsd: 6500,
          devHoldingPct: 2,
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          lpBurnedOrLockedPct: 100,
          launchpad: 'pump.fun',
        },
      ],
    });

    expect(webhookRes.statusCode).toBe(200);

    // Verify triggers
    const triggerRes = await app.inject({
      method: 'GET',
      url: '/api/snipe-triggers',
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(triggerRes.statusCode).toBe(200);
    const triggers = JSON.parse(triggerRes.body);
    expect(triggers.some((t: any) => t.mint === 'MatchingSnipeTokenMint9999999999999999999')).toBe(true);
  });
});
