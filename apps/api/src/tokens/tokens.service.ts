import {
  evaluateTokenRisk,
  RiskReportOutput,
  TokenQueryDto,
  TokenSnapshotDto,
} from '@solradar/shared';
import { db, TokenRecord, TokenSnapshotRecord, AlertRecord } from '../db/store.js';
import { logger } from '../observability/index.js';

export interface TokenWithLatestSnapshot {
  token: TokenRecord;
  snapshot: TokenSnapshotRecord;
  risk: RiskReportOutput;
}

export class TokensService {
  constructor() {
    this.seedInitialVerifiedTokens();
  }

  private seedInitialVerifiedTokens() {
    // Populate realistic initial data tokens
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

    for (const s of sampleMints) {
      if (!db.tokens.has(s.mint)) {
        const token: TokenRecord = {
          id: `tok_${s.symbol.toLowerCase()}`,
          mint: s.mint,
          symbol: s.symbol,
          name: s.name,
          decimals: s.decimals,
          creator: 'CreatorWalletAddressPlaceholder111111111111',
          firstSeenAt: new Date(Date.now() - 3600000),
        };
        db.tokens.set(s.mint, token);

        const snapshot: TokenSnapshotRecord = {
          id: `snap_${s.symbol.toLowerCase()}`,
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
        };
        db.snapshots.set(snapshot.id, snapshot);
      }
    }
  }

  async ingestHeliusWebhook(events: any[]) {
    const processedAlerts: AlertRecord[] = [];

    for (const evt of events) {
      // Increment system counter
      const currentCount = db.systemCounters.get('webhook_ingest_count') || 0;
      db.systemCounters.set('webhook_ingest_count', currentCount + 1);

      const mint = evt.mint || evt.tokenTransfers?.[0]?.mint;
      if (!mint) continue;

      let token = db.tokens.get(mint);
      if (!token) {
        token = {
          id: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          mint,
          symbol: evt.symbol || 'MEME',
          name: evt.name || 'Solana Token',
          decimals: evt.decimals || 6,
          creator: evt.creator || null,
          firstSeenAt: new Date(),
        };
        db.tokens.set(mint, token);
      }

      // Snapshot creation
      const snapshot: TokenSnapshotRecord = {
        id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
      };
      db.snapshots.set(snapshot.id, snapshot);

      // Check alert trigger condition: New Launch
      const eventKey = `launch:${mint}`;
      if (!db.alerts.has(eventKey)) {
        const alertRecord: AlertRecord = {
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
          createdAt: new Date(),
        };
        db.alerts.set(eventKey, alertRecord);
        processedAlerts.push(alertRecord);
      }
    }

    return { processedCount: events.length, alertsGenerated: processedAlerts.length };
  }

  queryScreener(query: TokenQueryDto): { data: TokenWithLatestSnapshot[]; total: number } {
    const list: TokenWithLatestSnapshot[] = [];

    for (const token of db.tokens.values()) {
      // Find latest snapshot for token
      const snapshots = Array.from(db.snapshots.values()).filter((s) => s.tokenId === token.id);
      if (snapshots.length === 0) continue;
      const latestSnapshot = snapshots.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0];

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
          valA = a.token.firstSeenAt.getTime();
          valB = b.token.firstSeenAt.getTime();
          break;
      }
      return query.sortDir === 'asc' ? valA - valB : valB - valA;
    });

    const total = list.length;
    const paginated = list.slice(query.offset, query.offset + query.limit);
    return { data: paginated, total };
  }

  getTokenDetail(mint: string): TokenWithLatestSnapshot | null {
    const token = db.tokens.get(mint);
    if (!token) return null;

    const snapshots = Array.from(db.snapshots.values()).filter((s) => s.tokenId === token.id);
    if (snapshots.length === 0) return null;
    const latestSnapshot = snapshots.sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0];

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
