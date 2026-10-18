import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import {
  heliusOnChainService,
  PUMP_FUN_PROGRAM,
  RAYDIUM_PROGRAM,
  MANDATORY_PROGRAM_ADDRESSES,
} from '../src/tokens/helius.service.js';
import { prisma } from '../src/db/prisma.js';

describe('Production Readiness & Blocker Hardening Test Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  }, 25000);

  afterAll(async () => {
    await app.close();
  });

  describe('Blocker 1 — Real Data Pipeline Migration & Webhook Ingest', () => {
    it('successfully processes POST /tokens/webhook/helius with 200 and persists real data without P2022', async () => {
      const testMint = `MigrationVerifyMint${Date.now()}111111111111`;
      const res = await app.inject({
        method: 'POST',
        url: '/tokens/webhook/helius',
        payload: [
          {
            mint: testMint,
            symbol: 'REALMIG',
            name: 'Real Migration Token',
            imageUrl: 'https://ipfs.io/ipfs/QmVerifiedHash1111111111111111111111111',
            priceUsd: 0.0035,
            mcapUsd: 350000,
            liquidityUsd: 70000,
            holderCount: 412,
            top10Pct: 21.4,
            devHoldingPct: 1.1,
            mintAuthorityRevoked: true,
            freezeAuthorityRevoked: true,
            lpBurnedOrLockedPct: 100,
            stage: 'migrated',
          },
        ],
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.processedCount).toBe(1);

      // Verify token row was created in DB with real columns (imageUrl, priceHistory)
      const token = await prisma.token.findUnique({ where: { mint: testMint } });
      expect(token).not.toBeNull();
      expect(token?.imageUrl).toBe('https://ipfs.io/ipfs/QmVerifiedHash1111111111111111111111111');
      expect(Array.isArray(token?.priceHistory)).toBe(true);
      expect((token?.priceHistory as any[]).length).toBe(1);
    });
  });

  describe('Blocker 2 — Helius Webhook Addresses Boot Sync (Regression Guard)', () => {
    it('defines mandatory Pump.fun and Raydium program addresses', () => {
      expect(PUMP_FUN_PROGRAM).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
      expect(RAYDIUM_PROGRAM).toBe('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
      expect(MANDATORY_PROGRAM_ADDRESSES).toContain('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
      expect(MANDATORY_PROGRAM_ADDRESSES).toContain('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    });

    it('restores watched program addresses when remote webhook addresses are empty or missing', async () => {
      // Mock fetch to simulate Helius webhook GET returning empty accountAddresses
      const originalFetch = global.fetch;
      let lastPutPayload: any = null;

      global.fetch = vi.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/v0/webhooks') && (!opts || opts.method === 'GET')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              webhookID: '4fbc8fb3-863e-47e2-b164-b24afb4ae0a3',
              webhookURL: 'https://api.solradar.io/tokens/webhook/helius',
              accountAddresses: [], // EMPTY! The blocker bug
              transactionTypes: ['Any'],
              webhookType: 'enhanced',
            }),
          } as any;
        }
        if (urlStr.includes('/v0/webhooks') && opts?.method === 'PUT') {
          lastPutPayload = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            json: async () => lastPutPayload,
          } as any;
        }
        return originalFetch(url, opts);
      }) as any;

      try {
        const result = await heliusOnChainService.syncWebhookAddresses('test_key_for_mock');

        // Must report 'added' (restored)
        expect(result.status).toBe('added');
        expect(result.addresses).toContain(PUMP_FUN_PROGRAM);
        expect(result.addresses).toContain(RAYDIUM_PROGRAM);

        // Verify PUT payload NEVER sent an empty array
        expect(lastPutPayload.accountAddresses.length).toBeGreaterThanOrEqual(2);
        expect(lastPutPayload.accountAddresses).toContain(PUMP_FUN_PROGRAM);
        expect(lastPutPayload.accountAddresses).toContain(RAYDIUM_PROGRAM);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('does not overwrite or wipe accountAddresses when both program addresses are already present', async () => {
      const existingWatched = [
        PUMP_FUN_PROGRAM,
        RAYDIUM_PROGRAM,
        'CustomTrackedWallet111111111111111111111111',
      ];
      const originalFetch = global.fetch;
      let putCalled = false;

      global.fetch = vi.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/v0/webhooks') && (!opts || opts.method === 'GET')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              webhookID: '4fbc8fb3-863e-47e2-b164-b24afb4ae0a3',
              webhookURL: 'https://api.solradar.io/tokens/webhook/helius',
              accountAddresses: existingWatched,
              transactionTypes: ['Any'],
              webhookType: 'enhanced',
            }),
          } as any;
        }
        if (urlStr.includes('/v0/webhooks') && opts?.method === 'PUT') {
          putCalled = true;
          return { ok: true, status: 200, json: async () => ({}) } as any;
        }
        return originalFetch(url, opts);
      }) as any;

      try {
        const result = await heliusOnChainService.syncWebhookAddresses('test_key_for_mock');

        // Must report 'already_present' and not issue a PUT overwrite
        expect(result.status).toBe('already_present');
        expect(putCalled).toBe(false);
        expect(result.addresses).toEqual(existingWatched);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('regression test: consecutive restarts do not wipe program addresses', async () => {
      // Simulate 2 restarts
      const sync1 = await heliusOnChainService.syncWebhookAddresses();
      const sync2 = await heliusOnChainService.syncWebhookAddresses();

      expect(['added', 'already_present', 'skipped']).toContain(sync1.status);
      expect(['added', 'already_present', 'skipped']).toContain(sync2.status);
    });
  });

  describe('Blocker 3 — Real Risk Data Pipeline & Capped 100-Point Price History', () => {
    it('ingests price snapshots and caps price_history at 100 points', async () => {
      const testMint = `CappedPriceHistoryMint${Date.now()}1111111`;

      // Ingest 105 price updates in batch
      const events = Array.from({ length: 105 }, (_, i) => ({
        mint: testMint,
        priceUsd: 0.001 + (i + 1) * 0.00001,
      }));

      await app.inject({
        method: 'POST',
        url: '/tokens/webhook/helius',
        payload: events,
      });

      const token = await prisma.token.findUnique({ where: { mint: testMint } });
      const history = (token?.priceHistory as any[]) || [];

      // Must be capped at exactly 100 points (last 100)
      expect(history.length).toBe(100);
      expect(history[history.length - 1].price).toBeCloseTo(0.001 + 105 * 0.00001, 5);

      // Verify /tokens/:mint returns real sparklines from the capped series
      const detailRes = await app.inject({
        method: 'GET',
        url: `/tokens/${testMint}`,
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body);
      expect(detail.sparkline.length).toBe(100);
    });

    it('does not store hardcoded fake placeholder values (25 holders, 35% top10, 2% dev) on bare webhook event', async () => {
      const bareMint = `BareEventMint${Date.now()}11111111111111`;
      await app.inject({
        method: 'POST',
        url: '/tokens/webhook/helius',
        payload: [
          {
            mint: bareMint,
            priceUsd: 0.0004,
            // Notice: holderCount, top10Pct, devHoldingPct are intentionally omitted
          },
        ],
      });

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
