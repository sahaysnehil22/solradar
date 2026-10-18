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
import type { PumpFunCoin } from '../discovery/pumpfun.js';

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
   * Primary Real-Time Token Ingest: Pump.fun Public API
   * - Polls every 15s.
   * - Creates token row and initial snapshot.
   * - Immediately evaluates risk & snipe rules (< 30s from launch).
   * - Enqueues BullMQ enrich_token background job using Helius RPC only.
   */
  async ingestPumpFunCoin(coin: PumpFunCoin): Promise<{ created: boolean; token: any }> {
    const mint = coin.mint;
    if (!mint) return { created: false, token: null };

    // Increment discovery counter
    try {
      await prisma.systemCounter.upsert({
        where: { key: 'pumpfun_discovery_count' },
        update: { value: { increment: 1 } },
        create: { key: 'pumpfun_discovery_count', value: BigInt(1) },
      });
    } catch {}

    const existing = await prisma.token.findUnique({ where: { mint } });
    if (existing) {
      return { created: false, token: existing };
    }

    const symbol = (coin.symbol || mint.slice(0, 4).toUpperCase()).replace(/[^A-Za-z0-9]/g, '') || 'SOLPUMP';
    const name = coin.name || `${symbol} Token`;
    const imageUrl = normalizeImageUrl(coin.image_uri) || null;
    const now = Date.now();

    // Price calculation from USD market cap or supply
    let price = 0.00003;
    if (typeof coin.usd_market_cap === 'number' && coin.usd_market_cap > 0) {
      price = coin.usd_market_cap / 1_000_000_000;
    } else if (typeof coin.market_cap === 'number' && coin.market_cap > 0) {
      price = coin.market_cap / 1_000_000_000;
    }

    const historyPoint = {
      t: now,
      p: price,
      price,
      takenAt: new Date(now).toISOString(),
    };

    const token = await prisma.token.create({
      data: {
        mint,
        symbol,
        name,
        imageUrl,
        decimals: 6,
        creator: coin.creator || null,
        priceHistory: [historyPoint],
        firstSeenAt: new Date(coin.created_timestamp ? Number(coin.created_timestamp) : now),
      },
    });

    // Liquidity estimation: 30 SOL * $150 = $4500 base curve liquidity
    let solReserves = 30;
    if (coin.virtual_sol_reserves) {
      const parsed = Number(coin.virtual_sol_reserves);
      if (!isNaN(parsed) && parsed > 0) {
        solReserves = parsed > 10_000 ? parsed / 1e9 : parsed;
      }
    }
    const liquidityUsd = Math.round(solReserves * 150) || 4500;
    const stage = coin.complete ? 'migrated' : 'curve';

    const snapshot = await prisma.tokenSnapshot.create({
      data: {
        tokenId: token.id,
        price,
        mcap: coin.usd_market_cap ?? (coin.market_cap ?? (price * 1_000_000_000)),
        liquidityUsd,
        volume5m: 0,
        volume1h: 0,
        volume24h: 0,
        buys: 0,
        sells: 0,
        holderCount: 1,
        top10Pct: 0,
        devHoldingPct: 0,
        mintAuthRevoked: true, // Pump.fun coins have mint & freeze authority revoked by design
        freezeAuthRevoked: true,
        lpBurnedOrLockedPct: coin.complete ? 100 : 0,
        stage,
        takenAt: new Date(),
      },
    });

    // Compute initial risk
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

    // Check snipe alert rules (< 30s from launch)
    await snipeService.evaluateLaunchAgainstRules({
      mint,
      symbol: token.symbol,
      name: token.name,
      price: snapshot.price,
      mcap: snapshot.mcap,
      liquidityUsd: snapshot.liquidityUsd,
      riskScore: risk.riskScore,
      devHoldingPct: snapshot.devHoldingPct,
      launchpad: 'pump.fun',
    });

    // Create launch alert
    const dedupeKey = `launch:${mint}`;
    try {
      const existingAlert = await prisma.alert.findUnique({ where: { eventKey: dedupeKey } });
      if (!existingAlert) {
        await prisma.alert.create({
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
      }
    } catch {}

    // Enqueue BullMQ background enrichment job (Helius RPC only: getAsset, getAccountInfo, getTokenLargestAccounts)
    try {
      await scoringQueue.add(
        'enrich_token',
        { mint, creator: coin.creator || null, stage },
        {
          jobId: `enrich:${mint}:${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
    } catch (qErr: any) {
      logger.warn(`Could not enqueue enrich_token job for ${mint}:`, qErr.message);
    }

    // Background asynchronous trigger
    setImmediate(() => {
      this.enrichTokenOnChain(mint, coin.creator || null, stage).catch((e) => {
        logger.warn(`Asynchronous background enrichment error for ${mint}:`, e.message);
      });
    });

    return { created: true, token };
  }

  /**
   * Secondary Discovery: Ingests newly trending tokens from DexScreener top boosts.
   */
  async ingestDexScreenerToken(tokenData: {
    mint: string;
    imageUrl?: string | null;
    description?: string;
  }): Promise<{ created: boolean; token: any }> {
    const mint = tokenData.mint;
    if (!mint) return { created: false, token: null };

    const existing = await prisma.token.findUnique({ where: { mint } });
    if (existing) {
      if (tokenData.imageUrl && !existing.imageUrl) {
        await prisma.token.update({
          where: { id: existing.id },
          data: { imageUrl: tokenData.imageUrl },
        });
      }
      return { created: false, token: existing };
    }

    const now = Date.now();
    const defaultSym = mint.slice(0, 4).toUpperCase();
    const initialPrice = 0.0001;

    const token = await prisma.token.create({
      data: {
        mint,
        symbol: defaultSym,
        name: `${defaultSym} Token`,
        imageUrl: tokenData.imageUrl || null,
        decimals: 6,
        priceHistory: [{ t: now, p: initialPrice, price: initialPrice, takenAt: new Date(now).toISOString() }],
        firstSeenAt: new Date(),
      },
    });

    await prisma.tokenSnapshot.create({
      data: {
        tokenId: token.id,
        price: initialPrice,
        mcap: initialPrice * 1_000_000_000,
        liquidityUsd: 10_000,
        stage: 'migrated',
        takenAt: new Date(),
      },
    });

    // Enqueue BullMQ enrichment
    try {
      await scoringQueue.add(
        'enrich_token',
        { mint, stage: 'migrated' },
        {
          jobId: `enrich:${mint}:${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );
    } catch {}

    setImmediate(() => {
      this.enrichTokenOnChain(mint, null, 'migrated').catch(() => {});
    });

    return { created: true, token };
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
      const now = Date.now();
      const price = typeof evt.priceUsd === 'number' && !isNaN(evt.priceUsd) && evt.priceUsd > 0
        ? evt.priceUsd
        : 0.0001;
      const historyPoint = {
        t: now,
        p: price,
        price,
        takenAt: new Date(now).toISOString(),
      };

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
        // Price history capped at last 200 points
        const updatedHistory = [...existingHistory, historyPoint].slice(-200);
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
        const now = Date.now();
        const launchPrice = 0.0001;
        token = await prisma.token.create({
          data: {
            mint,
            symbol,
            name,
            imageUrl: imageUrl || null,
            decimals: assetMeta?.decimals ?? 6,
            creator,
            priceHistory: [{ t: now, p: launchPrice, price: launchPrice, takenAt: new Date(now).toISOString() }],
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

        // Real Sparklines from token.priceHistory (capped at last 200 points)
        const history = Array.isArray(token.priceHistory) ? token.priceHistory : [];
        const realPrices: number[] = history
          .map((p: any) => (typeof p === 'number' ? p : p?.p ?? p?.price))
          .filter((n: any) => typeof n === 'number' && !isNaN(n));

        const sparkline = realPrices.slice(-200);

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

        if (searchQuery) {
          const symA = a.token.symbol.toLowerCase();
          const symB = b.token.symbol.toLowerCase();
          const nameA = a.token.name.toLowerCase();
          const nameB = b.token.name.toLowerCase();

          const getRelevance = (sym: string, name: string, mint: string) => {
            if (sym === searchQuery) return 100;
            if (sym.startsWith(searchQuery)) return 80;
            if (sym.includes(searchQuery)) return 60;
            if (name === searchQuery) return 40;
            if (name.includes(searchQuery)) return 20;
            if (mint.toLowerCase().includes(searchQuery)) return 10;
            return 0;
          };

          const relA = getRelevance(symA, nameA, a.token.mint);
          const relB = getRelevance(symB, nameB, b.token.mint);

          if (relA !== relB) {
            return relB - relA; // Higher relevance first
          }
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

    // Real Sparklines from token.priceHistory (capped at last 200 points)
    const history = Array.isArray(token.priceHistory) ? token.priceHistory : [];
    const realPrices: number[] = history
      .map((p: any) => (typeof p === 'number' ? p : p?.p ?? p?.price))
      .filter((n: any) => typeof n === 'number' && !isNaN(n));

    const sparkline = realPrices.slice(-200);

    return { token, snapshot: latestSnapshot, risk, sparkline };
  }

  /**
   * Price Sampler Worker:
   * - Recurring BullMQ job (every 20s) for top 100 most active tokens.
   * - Batches Jupiter price API v3: https://lite-api.jup.ag/price/v3?ids=<mints>
   * - Fallback to DexScreener batch tokens API for early bonding curve tokens.
   * - Appends { t: timestamp, p: price, price, takenAt } to tokens.price_history, capped at 200 points.
   * - Zero Helius RPC credits consumed.
   */
  async sampleActiveTokenPrices(): Promise<{ sampled: number; updated: number }> {
    try {
      const tokens = await prisma.token.findMany({
        take: 100,
        orderBy: { firstSeenAt: 'desc' },
        select: { id: true, mint: true, priceHistory: true },
      });

      if (!tokens || tokens.length === 0) {
        return { sampled: 0, updated: 0 };
      }

      const mints = tokens.map((t) => t.mint);
      const priceMap = new Map<string, number>();

      // 1. Batch Jupiter Price API v3 (free, up to 100 mints in a single HTTP request)
      try {
        const jupUrl = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(mints.join(','))}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const jupRes = await fetch(jupUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);

        if (jupRes.ok) {
          const jupData: any = await jupRes.json();
          for (const mint of mints) {
            const item = jupData?.[mint];
            const p = typeof item?.usdPrice === 'number' ? item.usdPrice : Number(item?.usdPrice);
            if (!isNaN(p) && p > 0) {
              priceMap.set(mint, p);
            }
          }
        }
      } catch (jupErr: any) {
        logger.warn('Jupiter batch price sampler warning:', jupErr.message);
      }

      // 2. Fallback to DexScreener for any tokens missing from Jupiter (e.g. pump.fun bonding curves)
      const missingMints = mints.filter((m) => !priceMap.has(m));
      if (missingMints.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < missingMints.length; i += 30) {
          chunks.push(missingMints.slice(i, i + 30));
        }

        for (const chunk of chunks) {
          try {
            const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const dexRes = await fetch(dexUrl, {
              signal: controller.signal,
              headers: { Accept: 'application/json' },
            });
            clearTimeout(timeout);

            if (dexRes.ok) {
              const dexData: any = await dexRes.json();
              const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];
              for (const pair of pairs) {
                const mint = pair.baseToken?.address;
                const priceUsd = Number(pair.priceUsd);
                if (mint && !isNaN(priceUsd) && priceUsd > 0 && !priceMap.has(mint)) {
                  priceMap.set(mint, priceUsd);
                }
              }
            }
          } catch (dexErr: any) {
            logger.warn('DexScreener batch price sampler warning:', dexErr.message);
          }
        }
      }

      if (priceMap.size === 0) {
        return { sampled: tokens.length, updated: 0 };
      }

      // 3. Append { t, p, price, takenAt } to tokens.price_history capped at 200 points
      const now = Date.now();
      const takenAt = new Date(now).toISOString();
      let updatedCount = 0;

      for (const t of tokens) {
        const newPrice = priceMap.get(t.mint);
        if (newPrice === undefined || isNaN(newPrice) || newPrice <= 0) continue;

        const historyPoint = {
          t: now,
          p: newPrice,
          price: newPrice,
          takenAt,
        };

        const existingHistory = Array.isArray(t.priceHistory) ? t.priceHistory : [];
        const updatedHistory = [...existingHistory, historyPoint].slice(-200);

        try {
          await prisma.token.update({
            where: { id: t.id },
            data: { priceHistory: updatedHistory },
          });
          updatedCount++;
        } catch (updateErr: any) {
          logger.warn(`Failed to update price history for ${t.mint}:`, updateErr.message);
        }
      }

      logger.info(`Price sampler: ${updatedCount}/${tokens.length} active tokens updated (capped at 200 points)`);
      return { sampled: tokens.length, updated: updatedCount };
    } catch (err: any) {
      logger.error('Error in sampleActiveTokenPrices:', err.message);
      return { sampled: 0, updated: 0 };
    }
  }
}

export const tokensService = new TokensService();
