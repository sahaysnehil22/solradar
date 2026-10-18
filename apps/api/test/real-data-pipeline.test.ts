import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { normalizeImageUrl } from '../src/tokens/helius.service.js';
import { tokensService } from '../src/tokens/tokens.service.js';

describe('Real Data Pipeline & Axiom Layout Fixes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();

    // Ingest realistic tokens with images and diverse risk inputs
    await tokensService.ingestHeliusWebhook([
      {
        mint: 'RealPipelineSeed1111111111111111111111111',
        symbol: 'SAFE',
        name: 'Safe Token Community',
        imageUrl: 'https://ipfs.io/ipfs/QmZpeT4zG9k4J88k1uYvQ3wJtW7b3wZ6J1uYvQ3wJtW7b3',
        priceUsd: 0.005,
        mcapUsd: 500000,
        liquidityUsd: 95000,
        holderCount: 850,
        top10Pct: 18.2,
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
        lpBurnedOrLockedPct: 100,
        stage: 'migrated',
      },
      {
        mint: 'RealPipelineSeed2222222222222222222222222',
        symbol: 'RISKY',
        name: 'High Hazard Gem',
        imageUrl: 'ipfs://QmHazard1234567890abcdef1234567890abcdef12345',
        priceUsd: 0.0001,
        mcapUsd: 15000,
        liquidityUsd: 3000,
        holderCount: 15,
        top10Pct: 78.5,
        devHoldingPct: 22.0,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
        lpBurnedOrLockedPct: 0,
        stage: 'curve',
      },
      {
        mint: 'RealPipelineSeed3333333333333333333333333',
        symbol: 'MID',
        name: 'Medium Risk Token',
        priceUsd: 0.001,
        mcapUsd: 80000,
        liquidityUsd: 20000,
        holderCount: 120,
        top10Pct: 42.0,
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
        lpBurnedOrLockedPct: 60,
        stage: 'new',
      },
    ]);
  }, 25000);

  afterAll(async () => {
    await app.close();
  });

  describe('Fix 1: Real Token Metadata & Image URLs', () => {
    it('normalizes IPFS URLs to standard HTTPS gateway URLs', () => {
      expect(normalizeImageUrl('ipfs://QmZpeT4zG9k4J88k1uYvQ3wJtW7b3wZ6J1uYvQ3wJtW7b3')).toBe(
        'https://ipfs.io/ipfs/QmZpeT4zG9k4J88k1uYvQ3wJtW7b3wZ6J1uYvQ3wJtW7b3'
      );
      expect(normalizeImageUrl('https://cf-ipfs.com/ipfs/Qm123')).toBe(
        'https://cf-ipfs.com/ipfs/Qm123'
      );
      expect(normalizeImageUrl(null)).toBeNull();
      expect(normalizeImageUrl('')).toBeNull();
    });

    it('stores and returns imageUrl for tokens in screener', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tokens/screener?limit=20',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBeGreaterThan(0);

      // Verify at least one seeded flagship token returns a valid image URL
      const tokensWithImages = body.data.filter((item: any) => !!item.token.imageUrl);
      expect(tokensWithImages.length).toBeGreaterThan(0);
      expect(tokensWithImages[0].token.imageUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('Fix 2 & 3: Real Risk Score Variation & Real Sparklines', () => {
    it('produces diverse risk scores across token pool (not stuck at 15/100)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tokens/screener?limit=50',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const riskScores = body.data.map((item: any) => item.risk.riskScore);

      // Unique risk scores should be varied, not all identical 15/100
      const uniqueScores = new Set(riskScores);
      expect(uniqueScores.size).toBeGreaterThan(2);

      // Verify we have both low risk (<30) and higher risk tokens
      const hasLowRisk = riskScores.some((s: number) => s < 30);
      const hasHigherRisk = riskScores.some((s: number) => s >= 30);
      expect(hasLowRisk).toBe(true);
      expect(hasHigherRisk).toBe(true);
    });

    it('stores real price points in priceHistory and returns genuine sparklines', async () => {
      const testMint = `SparklineTestMint${Date.now()}111111111111`;

      // 1. Initial Webhook Ingest at price 0.001
      await tokensService.ingestHeliusWebhook([
        {
          mint: testMint,
          symbol: 'SPARK',
          name: 'Sparkline Real Action',
          priceUsd: 0.001,
          mcapUsd: 100000,
          liquidityUsd: 25000,
          holderCount: 150,
          top10Pct: 22.5,
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          lpBurnedOrLockedPct: 100,
          stage: 'migrated',
        },
      ]);

      // 2. Second Webhook Ingest with price surge to 0.0015 (+50%)
      await tokensService.ingestHeliusWebhook([
        {
          mint: testMint,
          priceUsd: 0.0015,
        },
      ]);

      // 3. Query token detail
      const detailRes = await app.inject({
        method: 'GET',
        url: `/tokens/${testMint}`,
      });

      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body);

      // Verify sparkline contains the real historical prices
      expect(detail.sparkline).toBeDefined();
      expect(detail.sparkline.length).toBeGreaterThanOrEqual(2);
      expect(detail.sparkline[0]).toBe(0.001);
      expect(detail.sparkline[detail.sparkline.length - 1]).toBe(0.0015);

      // Uptrend: last >= first -> green sparkline
      expect(detail.sparkline[detail.sparkline.length - 1]).toBeGreaterThan(detail.sparkline[0]);
    });
  });

  describe('Fix 5: Token Detail Drawer Data', () => {
    it('returns diagnostic flags, top holders list, and deep-linkable mint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tokens/screener?limit=5',
      });
      const firstToken = JSON.parse(res.body).data[0];

      const detailRes = await app.inject({
        method: 'GET',
        url: `/tokens/${firstToken.token.mint}`,
      });

      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body);

      expect(detail.token.mint).toBeDefined();
      expect(detail.token.symbol).toBeDefined();
      expect(detail.snapshot).toBeDefined();
      expect(detail.risk.riskScore).toBeDefined();
      expect(Array.isArray(detail.risk.flags)).toBe(true);

      // If topHolders is populated, verify structure
      if (detail.snapshot.topHolders && detail.snapshot.topHolders.length > 0) {
        const h = detail.snapshot.topHolders[0];
        expect(h.address).toBeDefined();
        expect(h.pct).toBeDefined();
      }
    });
  });
});
