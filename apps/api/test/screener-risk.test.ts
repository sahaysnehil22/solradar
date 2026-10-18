import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';

describe('Discovery Screener & Risk Model API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
    await app.inject({
      method: 'POST',
      url: '/tokens/webhook/helius',
      payload: [
        {
          mint: 'ScreenerSeedMint11111111111111111111111111',
          symbol: 'SEEDA',
          name: 'Seed Token Alpha',
          priceUsd: 0.002,
          mcapUsd: 120000,
          liquidityUsd: 35000,
          holderCount: 220,
          top10Pct: 24.5,
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          lpBurnedOrLockedPct: 100,
          stage: 'migrated',
        },
        {
          mint: 'ScreenerSeedMint22222222222222222222222222',
          symbol: 'SEEDB',
          name: 'Seed Token Beta',
          priceUsd: 0.0005,
          mcapUsd: 40000,
          liquidityUsd: 8000,
          holderCount: 45,
          top10Pct: 65.0,
          mintAuthorityRevoked: false,
          freezeAuthorityRevoked: false,
          lpBurnedOrLockedPct: 20,
          stage: 'curve',
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('queries screener with default sort and returns populated token list with risk scores', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tokens/screener?limit=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const firstItem = body.data[0];
    expect(firstItem.token.symbol).toBeDefined();
    expect(firstItem.snapshot.price).toBeGreaterThan(0);
    expect(firstItem.risk.riskScore).toBeDefined();
    expect(firstItem.risk.confidence).toBeDefined();
  });

  it('filters screener tokens by minimum liquidity and risk criteria', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tokens/screener?minLiquidity=10000&mintAuthRevokedOnly=true',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    for (const item of body.data) {
      expect(item.snapshot.liquidityUsd).toBeGreaterThanOrEqual(10000);
      expect(item.snapshot.mintAuthRevoked).toBe(true);
    }
  });

  it('ingests Helius webhook and creates alert-worthy launch in under seconds', async () => {
    const testMint = `LaunchIngestTestMint${Date.now()}1111111111111`;
    const res = await app.inject({
      method: 'POST',
      url: '/tokens/webhook/helius',
      payload: [
        {
          mint: testMint,
          symbol: 'NEWGEM',
          name: 'New Gem Token',
          priceUsd: 0.0005,
          mcapUsd: 50000,
          liquidityUsd: 25000,
          volume5m: 5000,
          buys5m: 40,
          sells5m: 5,
          holderCount: 50,
          top10Pct: 28,
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          lpBurnedOrLockedPct: 100,
          stage: 'new',
        },
      ],
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processedCount).toBe(1);
    expect(body.alertsGenerated).toBe(1);

    // Verify token can now be retrieved directly
    const detailRes = await app.inject({
      method: 'GET',
      url: `/tokens/${testMint}`,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.body);
    expect(detail.token.symbol).toBe('NEWGEM');
    expect(detail.risk.riskScore).toBe(0);
  });
});
