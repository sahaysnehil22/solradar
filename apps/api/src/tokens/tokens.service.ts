import {
  evaluateTokenRisk,
  RiskReportOutput,
  TokenQueryDto,
  TokenSnapshotDto,
} from '@solradar/shared';
import { prisma } from '../db/prisma.js';
import { logger } from '../observability/index.js';

export interface TokenWithLatestSnapshot {
  token: any;
  snapshot: any;
  risk: RiskReportOutput;
}

export class TokensService {
  constructor() {
    this.seedInitialVerifiedTokens();
  }

  private async seedInitialVerifiedTokens() {
    const sampleMints = [
      {
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        name: 'Bonk',
        decimals: 5,
        price: 0.0000214,
        mcap: 1450000000,
        liquidityUsd: 18500000,
        vol5m: 125000,
        vol1h: 1800000,
        vol24h: 34000000,
        buys: 420,
        sells: 310,
        holders: 780000,
        top10: 18.5,
        devHolding: 0.1,
        mintRevoked: true,
        freezeRevoked: true,
        lpBurned: 100,
        stage: 'migrated' as const,
      },
      {
        mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        symbol: 'WIF',
        name: 'dogwifhat',
        decimals: 6,
        price: 2.38,
        mcap: 2380000000,
        liquidityUsd: 32000000,
        vol5m: 280000,
        vol1h: 3100000,
        vol24h: 85000000,
        buys: 680,
        sells: 590,
        holders: 195000,
        top10: 22.1,
        devHolding: 0.0,
        mintRevoked: true,
        freezeRevoked: true,
        lpBurned: 100,
        stage: 'migrated' as const,
      },
      {
        mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        symbol: 'POPCAT',
        name: 'Popcat',
        decimals: 9,
        price: 1.42,
        mcap: 1390000000,
        liquidityUsd: 14200000,
        vol5m: 95000,
        vol1h: 1200000,
        vol24h: 22000000,
        buys: 310,
        sells: 280,
        holders: 92000,
        top10: 26.4,
        devHolding: 0.0,
        mintRevoked: true,
        freezeRevoked: true,
        lpBurned: 100,
        stage: 'migrated' as const,
      },
      {
        mint: 'CurveLaunchPulseTest1111111111111111111111111',
        symbol: 'SOLPEPE',
        name: 'Solana Pepe',
        decimals: 6,
        price: 0.00041,
        mcap: 410000,
        liquidityUsd: 38000,
        vol5m: 14500,
        vol1h: 88000,
        vol24h: 195000,
        buys: 110,
        sells: 42,
        holders: 890,
        top10: 38.2,
        devHolding: 2.5,
        mintRevoked: true,
        freezeRevoked: true,
        lpBurned: 75,
        stage: 'curve' as const,
      },
      {
        mint: 'DangerousRugRiskTest2222222222222222222222222',
        symbol: 'HONEYPOT',
        name: 'Fake Pump Token',
        decimals: 6,
        price: 0.000012,
        mcap: 12000,
        liquidityUsd: 1800,
        vol5m: 400,
        vol1h: 800,
        vol24h: 1200,
        buys: 2,
        sells: 12,
        holders: 14,
        top10: 78.5,
        devHolding: 15.0,
        mintRevoked: false,
        freezeRevoked: false,
        lpBurned: 0,
        stage: 'new' as const,
      },
    ];

    try {
      for (const s of sampleMints) {
        const existing = await prisma.token.findUnique({ where: { mint: s.mint } });
        if (!existing) {
          const token = await prisma.token.create({
            data: {
              mint: s.mint,
              symbol: s.symbol,
              name: s.name,
              decimals: s.decimals,
              creator: 'CreatorWalletAddressPlaceholder111111111111',
              firstSeenAt: new Date(Date.now() - 3600000),
            },
          });

          await prisma.tokenSnapshot.create({
            data: {
              tokenId: token.id,
              price: s.price,
              mcap: s.mcap,
              liquidityUsd: s.liquidityUsd,
              volume5m: s.vol5m,
              volume1h: s.vol1h,
              volume24h: s.vol24h,
              buys: s.buys,
              sells: s.sells,
              holderCount: s.holders,
              top10Pct: s.top10,
              devHoldingPct: s.devHolding,
              mintAuthRevoked: s.mintRevoked,
              freezeAuthRevoked: s.freezeRevoked,
              lpBurnedOrLockedPct: s.lpBurned,
              stage: s.stage,
              takenAt: new Date(),
            },
          });
        }
      }
    } catch (e: any) {
      logger.warn('Initial token seed handled:', e.message);
    }
  }

  async ingestHeliusWebhook(events: any[]) {
    const processedAlerts: any[] = [];

    for (const evt of events) {
      // Increment system counter
      await prisma.systemCounter.upsert({
        where: { key: 'webhook_ingest_count' },
        update: { value: { increment: 1 } },
        create: { key: 'webhook_ingest_count', value: BigInt(1) },
      });

      const mint = evt.mint || evt.tokenTransfers?.[0]?.mint;
      if (!mint) continue;

      let token = await prisma.token.findUnique({ where: { mint } });
      if (!token) {
        token = await prisma.token.create({
          data: {
            mint,
            symbol: evt.symbol || 'MEME',
            name: evt.name || 'Solana Token',
            decimals: evt.decimals || 6,
            creator: evt.creator || null,
            firstSeenAt: new Date(),
          },
        });
      }

      // Snapshot creation
      const snapshot = await prisma.tokenSnapshot.create({
        data: {
          tokenId: token.id,
          price: evt.priceUsd || 0.0001,
          mcap: evt.mcapUsd || 10000,
          liquidityUsd: evt.liquidityUsd || 5000,
          volume5m: evt.volume5m || 1000,
          volume1h: evt.volume1h || 2000,
          volume24h: evt.volume24h || 5000,
          buys: evt.buys5m || 10,
          sells: evt.sells5m || 2,
          holderCount: evt.holderCount || 25,
          top10Pct: evt.top10Pct || 35,
          devHoldingPct: evt.devHoldingPct || 2,
          mintAuthRevoked: !!evt.mintAuthorityRevoked,
          freezeAuthRevoked: !!evt.freezeAuthorityRevoked,
          lpBurnedOrLockedPct: evt.lpBurnedOrLockedPct || 0,
          stage: evt.stage || 'new',
          takenAt: new Date(),
        },
      });

      // Check alert trigger condition: New Launch with deterministic eventKey
      const eventKey = `launch:${mint}`;
      const existingAlert = await prisma.alert.findUnique({ where: { eventKey } });
      if (!existingAlert) {
        const alertRecord = await prisma.alert.create({
          data: {
            eventKey,
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
    }

    return { processedCount: events.length, alertsGenerated: processedAlerts.length };
  }

  async queryScreener(query: TokenQueryDto): Promise<{ data: TokenWithLatestSnapshot[]; total: number }> {
    const tokens = await prisma.token.findMany();
    const list: TokenWithLatestSnapshot[] = [];

    for (const token of tokens) {
      const snapshots = await prisma.tokenSnapshot.findMany({ where: { tokenId: token.id } });
      if (snapshots.length === 0) continue;
      const latestSnapshot = snapshots.sort((a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

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

      list.push({ token, snapshot: latestSnapshot, risk });
    }

    // Sort list
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
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
    return { data: paginated, total };
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

    return { token, snapshot: latestSnapshot, risk };
  }
}

export const tokensService = new TokensService();
