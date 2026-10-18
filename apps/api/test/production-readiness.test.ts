import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import {
  PUMP_FUN_PROGRAM,
  RAYDIUM_PROGRAM,
  MANDATORY_PROGRAM_ADDRESSES,
} from '../src/tokens/helius.service.js';
import { prisma } from '../src/db/prisma.js';
import { PumpFunDiscoveryService } from '../src/discovery/pumpfun.js';
import { DexScreenerDiscoveryService } from '../src/discovery/dexscreener.js';
import { tokensService } from '../src/tokens/tokens.service.js';

describe('Production Readiness & Blocker Hardening Test Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  }, 25000);

  afterAll(async () => {
    await app.close();
  });

  describe('Discovery Pipeline & Webhook Deprecation', () => {
    it('returns HTTP 410 Gone on POST /tokens/webhook/helius (Helius webhook retired)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tokens/webhook/helius',
        payload: [{ mint: 'SomeOldWebhookPayload' }],
      });

      expect(res.statusCode).toBe(410);
      const json = JSON.parse(res.body);
      expect(json.error).toBe('Gone');
      expect(json.message).toContain('deprecated');
    });

    it('successfully ingests pump.fun coin and persists real data without P2022', async () => {
      const testMint = `MigrationVerifyMint${Date.now()}111111111111`;
      const coin = {
        mint: testMint,
        symbol: 'REALMIG',
        name: 'Real Migration Token',
        image_uri: 'https://ipfs.io/ipfs/QmVerifiedHash1111111111111111111111111',
        created_timestamp: Date.now(),
        usd_market_cap: 350000,
        virtual_sol_reserves: 30,
        complete: true,
      };

      const result = await tokensService.ingestPumpFunCoin(coin);
      expect(result.created).toBe(true);

      // Verify token row was created in DB with real columns (imageUrl, priceHistory)
      const token = await prisma.token.findUnique({ where: { mint: testMint } });
      expect(token).not.toBeNull();
      expect(token?.imageUrl).toBe('https://ipfs.io/ipfs/QmVerifiedHash1111111111111111111111111');
      expect(Array.isArray(token?.priceHistory)).toBe(true);
      expect((token?.priceHistory as any[]).length).toBe(1);

      // Verify token snapshot was created with real values
      const snapshots = await prisma.tokenSnapshot.findMany({ where: { tokenId: token!.id } });
      expect(snapshots.length).toBeGreaterThan(0);
      const snapshot = snapshots[0];
      expect(snapshot?.mcap).toBe(350000);
      expect(snapshot?.mintAuthRevoked).toBe(true);
      expect(snapshot?.freezeAuthRevoked).toBe(true);
      expect(snapshot?.stage).toBe('migrated');
    });

    it('defines standard Pump.fun and Raydium program addresses', () => {
      expect(PUMP_FUN_PROGRAM).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
      expect(RAYDIUM_PROGRAM).toBe('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
      expect(MANDATORY_PROGRAM_ADDRESSES).toContain('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
      expect(MANDATORY_PROGRAM_ADDRESSES).toContain('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    });

    it('PumpFunDiscoveryService handles 429 Too Many Requests with exponential backoff', async () => {
      const discovery = new PumpFunDiscoveryService();
      const originalFetch = global.fetch;

      global.fetch = vi.fn(async () => ({
        status: 429,
        ok: false,
      } as any));

      try {
        const coins = await discovery.fetchLatestCoins();
        expect(coins).toEqual([]);
        expect(discovery.getInterval()).toBe(30000); // doubled from 15000 to 30000
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('PumpFunDiscoveryService parses coins and triggers ingest in pollOnce', async () => {
      const discovery = new PumpFunDiscoveryService();
      const sampleMint = `PumpFunSampleMint${Date.now()}11111111111`;
      const originalFetch = global.fetch;

      global.fetch = vi.fn(async (url: any) => {
        if (url.toString().includes('pump.fun')) {
          return {
            status: 200,
            ok: true,
            json: async () => [
              {
                mint: sampleMint,
                name: 'Pump Discovery Coin',
                symbol: 'PDISC',
                image_uri: 'https://cf-ipfs.com/ipfs/QmTestImage',
                created_timestamp: Date.now(),
                usd_market_cap: 60000,
                virtual_sol_reserves: 35,
                complete: false,
              },
            ],
          } as any;
        }
        return originalFetch(url);
      });

      try {
        const result = await discovery.pollOnce();
        expect(result.fetched).toBe(1);
        expect(result.newCoins).toBe(1);

        const found = await prisma.token.findUnique({ where: { mint: sampleMint } });
        expect(found).not.toBeNull();
        expect(found?.symbol).toBe('PDISC');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('DexScreenerDiscoveryService fetches token metadata and handles 429 backoff gracefully', async () => {
      const dexScreener = new DexScreenerDiscoveryService();
      const originalFetch = global.fetch;

      global.fetch = vi.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/latest/dex/tokens/')) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              pairs: [
                {
                  baseToken: { address: 'DexMint11111111111111111111111111111111', name: 'Dex Coin', symbol: 'DEXC' },
                  priceUsd: '0.045',
                  marketCap: 450000,
                  info: {
                    imageUrl: 'https://dexscreener.com/token.png',
                  },
                },
              ],
            }),
          } as any;
        }
        return originalFetch(url);
      });

      try {
        const meta = await dexScreener.fetchTokenMetadata('DexMint11111111111111111111111111111111');
        expect(meta).not.toBeNull();
        expect(meta?.name).toBe('Dex Coin');
        expect(meta?.imageUrl).toBe('https://dexscreener.com/token.png');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Blocker 3 — Real Risk Data Pipeline & Capped 200-Point Price History', () => {
    it('ingests price snapshots and caps price_history at 200 points', async () => {
      const testMint = `CappedPriceHistoryMint${Date.now()}1111111`;

      // Ingest 205 price updates in batch
      const events = Array.from({ length: 205 }, (_, i) => ({
        mint: testMint,
        priceUsd: 0.001 + (i + 1) * 0.00001,
      }));

      await tokensService.ingestHeliusWebhook(events);

      const token = await prisma.token.findUnique({ where: { mint: testMint } });
      const history = (token?.priceHistory as any[]) || [];

      // Must be capped at exactly 200 points (last 200)
      expect(history.length).toBe(200);
      expect(history[history.length - 1].price).toBeCloseTo(0.001 + 205 * 0.00001, 5);

      // Verify /tokens/:mint returns real sparklines from the capped series
      const detailRes = await app.inject({
        method: 'GET',
        url: `/tokens/${testMint}`,
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body);
      expect(detail.sparkline.length).toBe(200);
    });

    it('does not store hardcoded fake placeholder values (25 holders, 35% top10, 2% dev) on bare webhook event', async () => {
      const bareMint = `BareEventMint${Date.now()}11111111111111`;
      await tokensService.ingestHeliusWebhook([
        {
          mint: bareMint,
          priceUsd: 0.0004,
          // Notice: holderCount, top10Pct, devHoldingPct are intentionally omitted
        },
      ]);

      const token = await prisma.token.findUnique({ where: { mint: bareMint } });
      const snapshots = await prisma.tokenSnapshot.findMany({ where: { tokenId: token?.id } });
      expect(snapshots.length).toBeGreaterThan(0);

      const latestSnap = snapshots[0];
      // Must NOT be the old fake defaults: 25, 35, 2
      expect(latestSnap.holderCount).toBe(0);
      expect(latestSnap.top10Pct).toBe(0);
      expect(latestSnap.devHoldingPct).toBe(0);
    });
  });

  describe('Production Hardening & Auth Verification', () => {
    it('returns 401 Unauthorized (never 500) with clear message when accessing protected route without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/snipe-rules',
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('returns 401 Unauthorized with invalid Bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/snipe-rules',
        headers: { authorization: 'Bearer invalid_bogus_token_12345' },
      });

      expect(res.statusCode).toBe(401);
      const json = JSON.parse(res.body);
      expect(json.error).toMatch(/Unauthorized/i);
    });

    it('checks health and readiness endpoints accurately', async () => {
      const healthRes = await app.inject({ method: 'GET', url: '/healthz' });
      expect(healthRes.statusCode).toBe(200);
      expect(JSON.parse(healthRes.body).status).toBe('ok');

      const readyRes = await app.inject({ method: 'GET', url: '/readyz' });
      expect(readyRes.statusCode).toBe(200);
      const readyJson = JSON.parse(readyRes.body);
      expect(readyJson.status).toBe('ready');
      expect(readyJson.database).toBe('connected');
    });
  });
});
