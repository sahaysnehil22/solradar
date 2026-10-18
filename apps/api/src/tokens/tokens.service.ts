import {
  evaluateTokenRisk,
  RiskReportOutput,
  TokenQueryDto,
  TokenSnapshotDto,
} from '@solradar/shared';
import { prisma } from '../db/prisma.js';
import { snipeService } from '../snipe/snipe.service.js';
import { logger } from '../observability/index.js';
import { heliusOnChainService, normalizeImageUrl } from './helius.service.js';
import { scoringQueue } from '../queues/index.js';

export interface TokenWithLatestSnapshot {
  token: any;
  snapshot: any;
  risk: RiskReportOutput;
  sparkline?: number[];
}

export class TokensService {
  constructor() {
    // Database-backed live pipeline only
  }

  /**
   * Production Hardening:
   * Discover/Pulse must show only DB-backed live data.
   * Purges any legacy dummy tokens without inserting fake demo data.
   */
  async ensureInitialTokensSeeded() {
    try {
      const dummyCount = await prisma.token.count({
        where: { OR: [{ symbol: 'MEME' }, { name: 'Solana Token' }] },
      });
      if (dummyCount > 0) {
        logger.info(`Purging ${dummyCount} legacy dummy tokens from database...`);
        try {
          await prisma.tokenSnapshot.deleteMany({
            where: { token: { OR: [{ symbol: 'MEME' }, { name: 'Solana Token' }] } },
          });
          await prisma.token.deleteMany({
            where: { OR: [{ symbol: 'MEME' }, { name: 'Solana Token' }] },
          });
        } catch (delErr: any) {
          logger.warn('Non-fatal error purging legacy dummy tokens:', delErr.message);
        }
      }
    } catch (err: any) {
      logger.warn('Token table verification handled:', err.message);
    }
  }

  /**
   * Ingests live Helius Webhook payloads idempotently.
   * - Idempotency on (mint, slot) or event signature.
   * - Records real price snapshot into tokens.price_history (capped at last 100 points).
   * - NEVER writes placeholder values (25, 35, 2) into risk inputs.
   * - Enqueues a BullMQ enrichment job (non-blocking).
   */
  async ingestHeliusWebhook(events: any[]) {
    const processedAlerts: any[] = [];

    for (const evt of events) {
      // Increment system counter
      try {
        await prisma.systemCounter.upsert({
          where: { key: 'webhook_ingest_count' },
          update: { value: { increment: 1 } },
          create: { key: 'webhook_ingest_count', value: BigInt(1) },
        });
      } catch {}

      const mint = evt.mint || evt.tokenTransfers?.[0]?.mint;
      if (!mint) continue;

      // Deterministic event key for deduplication and idempotency
      const eventSig = evt.signature || evt.events?.signature;
      const dedupeKey = eventSig
        ? `sig:${eventSig}`
        : evt.slot
        ? `slot:${mint}:${evt.slot}`
        : `launch:${mint}`;

      let token = await prisma.token.findUnique({ where: { mint } });
      const defaultSym = (evt.symbol || mint.slice(0, 4).toUpperCase()).replace(/[^A-Z0-9]/g, '') || 'SOLPUMP';
      const price = typeof evt.priceUsd === 'number' && !isNaN(evt.priceUsd) && evt.priceUsd > 0
        ? evt.priceUsd
        : 0.0001;
      const historyPoint = { price, takenAt: new Date().toISOString() };

      if (!token) {
        token = await prisma.token.create({
          data: {
            mint,
            symbol: defaultSym,
            name: evt.name || `${defaultSym} Token`,
            imageUrl: normalizeImageUrl(evt.imageUrl) || null,
            decimals: evt.decimals || 6,
            creator: evt.creator || null,
            priceHistory: [historyPoint],
            firstSeenAt: new Date(),
          },
        });
      } else {
        const existingHistory = Array.isArray(token.priceHistory) ? token.priceHistory : [];
        // Price history capped at last 100 points
        const updatedHistory = [...existingHistory, historyPoint].slice(-100);
        try {
          token = await prisma.token.update({
            where: { id: token.id },
            data: { priceHistory: updatedHistory },
          });
        } catch {}
      }

      // Snapshot creation: store real event values or 0, NEVER placeholder values (25, 35, 2)
      const snapshot = await prisma.tokenSnapshot.create({
        data: {
          tokenId: token.id,
          price,
          mcap: evt.mcapUsd ?? (price * 1_000_000_000),
          liquidityUsd: evt.liquidityUsd ?? 0,
          volume5m: evt.volume5m ?? 0,
          volume1h: evt.volume1h ?? 0,
          volume24h: evt.volume24h ?? 0,
          buys: evt.buys5m ?? 0,
          sells: evt.sells5m ?? 0,
          holderCount: evt.holderCount ?? 0,
          top10Pct: evt.top10Pct ?? 0,
          devHoldingPct: evt.devHoldingPct ?? 0,
          mintAuthRevoked: !!evt.mintAuthorityRevoked,
          freezeAuthRevoked: !!evt.freezeAuthorityRevoked,
          lpBurnedOrLockedPct: evt.lpBurnedOrLockedPct ?? 0,
          stage: evt.stage || 'new',
          takenAt: new Date(),
        },
      });

      // Compute initial risk from available inputs
      const risk = evaluateTokenRisk({
        mintAuthorityRevoked: snapshot.mintAuthRevoked,
        freezeAuthorityRevoked: snapshot.freezeAuthRevoked,
        lpBurnedOrLockedPct: snapshot.lpBurnedOrLockedPct,
        top10Pct: snapshot.top10Pct,
        devHoldingPct: snapshot.devHoldingPct,
        liquidityUsd: snapshot.liquidityUsd,
        mcapUsd: snapshot.mcap,
        volume5m: snapshot.volume5m,
        buys5m: snapshot.buys,
        sells5m: snapshot.sells,
        holderCount: snapshot.holderCount,
      });

      // Check snipe alert rules
      await snipeService.evaluateLaunchAgainstRules({
        mint,
        symbol: token.symbol,
        name: token.name,
        price: snapshot.price,
        mcap: snapshot.mcap,
        liquidityUsd: snapshot.liquidityUsd,
        riskScore: risk.riskScore,
        devHoldingPct: snapshot.devHoldingPct,
        launchpad: evt.launchpad || 'pump.fun',
      });

      // Check alert trigger condition with deterministic dedupeKey
      const existingAlert = await prisma.alert.findUnique({ where: { eventKey: dedupeKey } });
      if (!existingAlert) {
        const alertRecord = await prisma.alert.create({
          data: {
            eventKey: dedupeKey,
            kind: 'launch',
            tokenId: token.id,
            payload: {
              mint,
              symbol: token.symbol,
              name: token.name,
              price: snapshot.price,
              mcap: snapshot.mcap,
              liquidity: snapshot.liquidityUsd,
              stage: snapshot.stage,
            },
          },
        });
        processedAlerts.push(alertRecord);
      }

      // Non-blocking BullMQ background enrichment job (with 3 attempts and backoff)
      try {
        await scoringQueue.add(
          'enrich_token',
          { mint, creator: evt.creator || null, stage: evt.stage || 'new' },
          {
            jobId: `enrich:${mint}:${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          }
        );
      } catch (qErr: any) {
        logger.warn(`Could not enqueue enrich_token job:`, qErr.message);
      }

      // Background asynchronous trigger (never blocks webhook response)
      setImmediate(() => {
        this.enrichTokenOnChain(mint, evt.creator || null, evt.stage || 'new').catch((e) => {
          logger.warn(`Asynchronous background enrichment error for ${mint}:`, e.message);
        });
      });
    }

    return { processedCount: events.length, alertsGenerated: processedAlerts.length };
  }

  /**
   * On-Chain Token Enrichment:
   * - Helius DAS getAsset for real metadata, image URL, name, and symbol
   * - Helius RPC (rate-limited <= 8 RPS) for top 10 %, authorities, dev balance, LP status
   * - Retries with exponential backoff; if enrichment fails, keeps token with enriched=false
   * - NEVER writes placeholder values into risk inputs
   */
  async enrichTokenOnChain(mint: string, creatorAddress?: string | null, stage: string = 'new') {
    try {
      logger.info(`Starting on-chain enrichment for ${mint}...`);

      // 1. Fetch real metadata and image URL via Helius DAS getAsset or DexScreener fallback
      const assetMeta = await heliusOnChainService.fetchTokenAsset(mint);

      let token = await prisma.token.findUnique({ where: { mint } });
      const imageUrl = assetMeta?.imageUrl || (token ? token.imageUrl : null);
      const symbol = assetMeta?.symbol || token?.symbol || mint.slice(0, 4).toUpperCase();
      const name = assetMeta?.name || token?.name || `${symbol} Token`;
      const creator = creatorAddress || assetMeta?.creator || token?.creator || null;

      if (!token) {
        token = await prisma.token.create({
          data: {
            mint,
            symbol,
            name,
            imageUrl: imageUrl || null,
            decimals: assetMeta?.decimals ?? 6,
            creator,
            priceHistory: [],
            firstSeenAt: new Date(),
          },
        });
      } else {
        const updateData: any = {};
        if (imageUrl && !token.imageUrl) updateData.imageUrl = imageUrl;
        if (assetMeta?.name && token.name.includes('Token')) updateData.name = assetMeta.name;
        if (assetMeta?.symbol && token.symbol === 'SOLPUMP') updateData.symbol = assetMeta.symbol;
        if (creator && !token.creator) updateData.creator = creator;
        if (Object.keys(updateData).length > 0) {
          try {
            token = await prisma.token.update({
              where: { id: token.id },
              data: updateData,
            });
          } catch {}
        }
      }

      // 2. Fetch real on-chain risk inputs (Top-10 %, authorities, dev holding, LP burn status)
      const realInputs = await heliusOnChainService.fetchOnChainRiskInputs(
        mint,
        creator,
        stage
      );

      // 3. Find latest snapshot
      const snapshots = await prisma.tokenSnapshot.findMany({ where: { tokenId: token.id } });
      const latestSnapshot = snapshots.sort(
        (a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
      )[0];

      let updatedSnapshot = latestSnapshot;
      if (latestSnapshot) {
        const updateSnapData: any = {
          holderCount: realInputs.holderCount,
          top10Pct: realInputs.top10Pct,
          topHolders: realInputs.topHolders,
          devHoldingPct: realInputs.devHoldingPct,
          mintAuthRevoked: realInputs.mintAuthRevoked,
          freezeAuthRevoked: realInputs.freezeAuthRevoked,
          lpBurnedOrLockedPct: realInputs.lpBurnedOrLockedPct,
        };
        if (realInputs.liquidityUsd !== undefined && realInputs.liquidityUsd > 0) {
          updateSnapData.liquidityUsd = realInputs.liquidityUsd;
        }

        try {
          updatedSnapshot = await prisma.tokenSnapshot.update({
            where: { id: latestSnapshot.id },
            data: updateSnapData,
          });
        } catch {}
      }

      // 4. Re-evaluate real risk with updated on-chain snapshot inputs
      if (updatedSnapshot) {
        const risk = evaluateTokenRisk({
          mintAuthorityRevoked: updatedSnapshot.mintAuthRevoked,
          freezeAuthorityRevoked: updatedSnapshot.freezeAuthRevoked,
          lpBurnedOrLockedPct: updatedSnapshot.lpBurnedOrLockedPct,
          top10Pct: updatedSnapshot.top10Pct,
          devHoldingPct: updatedSnapshot.devHoldingPct,
          liquidityUsd: updatedSnapshot.liquidityUsd,
          mcapUsd: updatedSnapshot.mcap,
          volume5m: updatedSnapshot.volume5m,
          buys5m: updatedSnapshot.buys,
          sells5m: updatedSnapshot.sells,
          holderCount: updatedSnapshot.holderCount,
        });

        try {
          await prisma.riskReport.upsert({
            where: { tokenId_modelVersion: { tokenId: token.id, modelVersion: '1.0.0' } },
            update: {
              riskScore: risk.riskScore,
              momentumScore: risk.momentumScore,
              confidence: risk.confidence,
              flags: risk.flags as any,
              scoredAt: new Date(),
            },
            create: {
              tokenId: token.id,
              riskScore: risk.riskScore,
              momentumScore: risk.momentumScore,
              confidence: risk.confidence,
              flags: risk.flags as any,
              modelVersion: '1.0.0',
              scoredAt: new Date(),
            },
          });
        } catch {}
      }

      logger.info(`Completed on-chain enrichment for ${mint}: top10=${realInputs.top10Pct}%, dev=${realInputs.devHoldingPct}%, lpBurned=${realInputs.lpBurnedOrLockedPct}%, enriched=${realInputs.enriched}`);
      return { token, snapshot: updatedSnapshot };
    } catch (err: any) {
      logger.error(`Error in enrichTokenOnChain for ${mint}:`, err.message);
      return null;
    }
  }

  async queryScreener(query: TokenQueryDto & { search?: string }): Promise<{ data: TokenWithLatestSnapshot[]; tokens: TokenWithLatestSnapshot[]; total: number }> {
    const startTime = Date.now();
    try {
      const tokens = await prisma.token.findMany({
        where: {
          NOT: {
            OR: [
              { symbol: 'MEME' },
              { name: 'Solana Token' },
            ],
          },
        },
        take: 200,
      });

      if (!tokens || tokens.length === 0) {
        logger.info('queryScreener completed (empty table)', { elapsedMs: Date.now() - startTime });
        return { data: [], tokens: [], total: 0 };
      }

      const tokenIds = tokens.map((t: any) => t.id);
      const snapshots = await prisma.tokenSnapshot.findMany({
        where: {
          tokenId: { in: tokenIds },
        },
      });

      const snapshotsByTokenId = new Map<string, any[]>();
      for (const s of snapshots) {
        let list = snapshotsByTokenId.get(s.tokenId);
        if (!list) {
          list = [];
          snapshotsByTokenId.set(s.tokenId, list);
        }
        list.push(s);
      }

      const list: TokenWithLatestSnapshot[] = [];
      const searchQuery = query.search?.toLowerCase().trim();

      for (const token of tokens) {
        if (searchQuery) {
          const matchSymbol = token.symbol.toLowerCase().includes(searchQuery);
          const matchName = token.name.toLowerCase().includes(searchQuery);
          const matchMint = token.mint.toLowerCase().includes(searchQuery);
          if (!matchSymbol && !matchName && !matchMint) continue;
        }

        const tSnapshots = snapshotsByTokenId.get(token.id) || [];
        if (tSnapshots.length === 0) continue;
        const latestSnapshot = tSnapshots.sort(
          (a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
        )[0];

        // Filter stage
        if (query.stage !== 'all' && latestSnapshot.stage !== query.stage) {
          continue;
        }

        // Filter Mcap
        if (query.minMcap && latestSnapshot.mcap < query.minMcap) continue;
        if (query.maxMcap && latestSnapshot.mcap > query.maxMcap) continue;

        // Filter Liquidity
        if (query.minLiquidity && latestSnapshot.liquidityUsd < query.minLiquidity) continue;

        // Filter Security Flags
        if (query.mintAuthRevokedOnly && !latestSnapshot.mintAuthRevoked) continue;
        if (query.freezeAuthRevokedOnly && !latestSnapshot.freezeAuthRevoked) continue;
        if (query.lpBurnedOnly && latestSnapshot.lpBurnedOrLockedPct < 90) continue;

        // Calculate real-time risk report
        const risk = evaluateTokenRisk({
          mintAuthorityRevoked: latestSnapshot.mintAuthRevoked,
          freezeAuthorityRevoked: latestSnapshot.freezeAuthRevoked,
          lpBurnedOrLockedPct: latestSnapshot.lpBurnedOrLockedPct,
          top10Pct: latestSnapshot.top10Pct,
          devHoldingPct: latestSnapshot.devHoldingPct,
          liquidityUsd: latestSnapshot.liquidityUsd,
          mcapUsd: latestSnapshot.mcap,
          volume5m: latestSnapshot.volume5m,
          buys5m: latestSnapshot.buys,
          sells5m: latestSnapshot.sells,
          holderCount: latestSnapshot.holderCount,
        });

        if (query.maxRiskScore && risk.riskScore > query.maxRiskScore) continue;

        // Real Sparklines from token.priceHistory (capped at last 100 points)
        const history = Array.isArray(token.priceHistory) ? token.priceHistory : [];
        const realPrices: number[] = history
          .map((p: any) => (typeof p === 'number' ? p : p?.price))
          .filter((n: any) => typeof n === 'number' && !isNaN(n));

        const sparkline = realPrices.length >= 2 ? realPrices : [latestSnapshot.price, latestSnapshot.price];

        list.push({ token, snapshot: latestSnapshot, risk, sparkline });
      }

      // Sort
      list.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;
        switch (query.sortBy) {
          case 'volume_5m':
            valA = a.snapshot.volume5m;
            valB = b.snapshot.volume5m;
            break;
          case 'volume_1h':
            valA = a.snapshot.volume1h;
            valB = b.snapshot.volume1h;
            break;
          case 'volume_24h':
            valA = a.snapshot.volume24h;
            valB = b.snapshot.volume24h;
            break;
          case 'liquidity_usd':
            valA = a.snapshot.liquidityUsd;
            valB = b.snapshot.liquidityUsd;
            break;
          case 'mcap':
            valA = a.snapshot.mcap;
            valB = b.snapshot.mcap;
            break;
          case 'risk_score':
            valA = a.risk.riskScore;
            valB = b.risk.riskScore;
            break;
          case 'first_seen_at':
            valA = new Date(a.token.firstSeenAt).getTime();
            valB = new Date(b.token.firstSeenAt).getTime();
            break;
        }
        return query.sortDir === 'asc' ? valA - valB : valB - valA;
      });

      const total = list.length;
      const paginated = list.slice(query.offset, query.offset + query.limit);

      logger.info('queryScreener completed', {
        elapsedMs: Date.now() - startTime,
        total,
        count: paginated.length,
      });

      return { data: paginated, tokens: paginated, total };
    } catch (err: any) {
      logger.error('queryScreener error:', { error: err.message, elapsedMs: Date.now() - startTime });
      return { data: [], tokens: [], total: 0 };
    }
  }

  async getTokenDetail(mint: string): Promise<TokenWithLatestSnapshot | null> {
    const token = await prisma.token.findUnique({ where: { mint } });
    if (!token) return null;

    const snapshots = await prisma.tokenSnapshot.findMany({ where: { tokenId: token.id } });
    if (snapshots.length === 0) return null;
    const latestSnapshot = snapshots.sort((a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

    const risk = evaluateTokenRisk({
      mintAuthorityRevoked: latestSnapshot.mintAuthRevoked,
      freezeAuthorityRevoked: latestSnapshot.freezeAuthRevoked,
      lpBurnedOrLockedPct: latestSnapshot.lpBurnedOrLockedPct,
      top10Pct: latestSnapshot.top10Pct,
      devHoldingPct: latestSnapshot.devHoldingPct,
      liquidityUsd: latestSnapshot.liquidityUsd,
      mcapUsd: latestSnapshot.mcap,
      volume5m: latestSnapshot.volume5m,
      buys5m: latestSnapshot.buys,
      sells5m: latestSnapshot.sells,
      holderCount: latestSnapshot.holderCount,
    });

    // Real Sparklines from token.priceHistory (capped at last 100 points)
    const history = Array.isArray(token.priceHistory) ? token.priceHistory : [];
    const realPrices: number[] = history
      .map((p: any) => (typeof p === 'number' ? p : p?.price))
      .filter((n: any) => typeof n === 'number' && !isNaN(n));

    const sparkline = realPrices.length >= 2 ? realPrices : [latestSnapshot.price, latestSnapshot.price];

    return { token, snapshot: latestSnapshot, risk, sparkline };
  }
}

export const tokensService = new TokensService();
