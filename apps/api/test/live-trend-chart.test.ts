import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokensService } from '../src/tokens/tokens.service.js';
import { prisma } from '../src/db/prisma.js';
import { worker } from '../src/worker.js';

describe('Live Trend Chart Upgrade & Price Sampler Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('seeds launch price { t, p, price, takenAt } into price_history on token creation', async () => {
    const mint = `TrendSeedLaunchMint_${Date.now()}`;
    const launchPrice = 0.00042;

    await tokensService.ingestHeliusWebhook([
      {
        mint,
        symbol: 'LAUNCH',
        name: 'Launch Token',
        priceUsd: launchPrice,
        mcapUsd: 420000,
        liquidityUsd: 50000,
        stage: 'new',
      },
    ]);

    const token = await prisma.token.findUnique({ where: { mint } });
    expect(token).toBeDefined();
    expect(Array.isArray(token?.priceHistory)).toBe(true);

    const history: any[] = token?.priceHistory as any[];
    expect(history.length).toBe(1);
    expect(history[0].p).toBe(launchPrice);
    expect(history[0].price).toBe(launchPrice);
    expect(typeof history[0].t).toBe('number');
    expect(typeof history[0].takenAt).toBe('string');
  });

  it('caps price_history at 200 points on subsequent updates', async () => {
    const mint = `TrendCap200Mint_${Date.now()}`;

    // Seed token
    await tokensService.ingestHeliusWebhook([
      {
        mint,
        symbol: 'CAP200',
        priceUsd: 0.001,
        stage: 'curve',
      },
    ]);

    // Populate token with 210 existing points
    const points210 = Array.from({ length: 210 }, (_, i) => ({
      t: Date.now() - (210 - i) * 20000,
      p: 0.001 + i * 0.00001,
      price: 0.001 + i * 0.00001,
      takenAt: new Date().toISOString(),
    }));

    await prisma.token.update({
      where: { mint },
      data: { priceHistory: points210 },
    });

    // Ingest one more point
    await tokensService.ingestHeliusWebhook([
      {
        mint,
        symbol: 'CAP200',
        priceUsd: 0.005,
        stage: 'curve',
      },
    ]);

    const updatedToken = await prisma.token.findUnique({ where: { mint } });
    const history: any[] = updatedToken?.priceHistory as any[];
    expect(history.length).toBe(200);
    expect(history[history.length - 1].p).toBe(0.005);
  });

  it('sampleActiveTokenPrices fetches batch quotes via Jupiter API and updates price_history without Helius RPC', async () => {
    const mint1 = `JupSampleMint1_${Date.now()}`;
    const mint2 = `JupSampleMint2_${Date.now()}`;

    await tokensService.ingestHeliusWebhook([
      { mint: mint1, symbol: 'JUP1', priceUsd: 0.002, stage: 'curve' },
      { mint: mint2, symbol: 'JUP2', priceUsd: 0.004, stage: 'migrated' },
    ]);

    // Mock global fetch to intercept Jupiter API call
    const originalFetch = global.fetch;
    const fetchSpy = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('lite-api.jup.ag/price/v3')) {
        return {
          ok: true,
          json: async () => ({
            [mint1]: { usdPrice: 0.00245 },
            [mint2]: { usdPrice: 0.00489 },
          }),
        };
      }
      return originalFetch(url);
    });
    global.fetch = fetchSpy as any;

    try {
      const result = await tokensService.sampleActiveTokenPrices();
      expect(result.sampled).toBeGreaterThanOrEqual(2);
      expect(result.updated).toBeGreaterThanOrEqual(2);

      // Verify Jupiter API was called in a single batch request
      const jupCalls = fetchSpy.mock.calls.filter((call) =>
        call[0].toString().includes('lite-api.jup.ag/price/v3')
      );
      expect(jupCalls.length).toBe(1);
      expect(jupCalls[0][0].toString()).toContain(encodeURIComponent(mint1));

      // Verify tokens gained new points
      const t1 = await prisma.token.findUnique({ where: { mint: mint1 } });
      const h1: any[] = t1?.priceHistory as any[];
      expect(h1[h1.length - 1].p).toBe(0.00245);
      expect(h1[h1.length - 1].price).toBe(0.00245);
      expect(typeof h1[h1.length - 1].t).toBe('number');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('anti-faking policy: never synthesizes or interpolates fake points when token has < 3 points', async () => {
    const mint = `AntiFakeMint_${Date.now()}`;
    const singlePrice = 0.0033;

    await tokensService.ingestHeliusWebhook([
      {
        mint,
        symbol: 'REALONLY',
        priceUsd: singlePrice,
        stage: 'new',
      },
    ]);

    const detail = await tokensService.getTokenDetail(mint);
    expect(detail).toBeDefined();

    // sparkline should contain only the genuine real points, NEVER duplicate fake points
    expect(detail?.sparkline?.length).toBe(1);
    expect(detail?.sparkline?.[0]).toBe(singlePrice);

    // queryScreener also returns genuine points without fake padding
    const screener = await tokensService.queryScreener({ limit: 10, offset: 0, stage: 'all', search: 'REALONLY' });
    const match = screener.data.find((item) => item.token.mint === mint);
    expect(match).toBeDefined();
    expect(match?.sparkline?.length).toBe(1);
    expect(match?.sparkline?.[0]).toBe(singlePrice);
  });

  it('worker repeatable job price-sampler executes cleanly with distributed locking', async () => {
    const result = await worker.runPriceSampler();
    expect(result).toBeDefined();
    expect(result.completed).toBe(true);
    expect(typeof result.sampled).toBe('number');
  });
});
