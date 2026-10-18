import { logger } from '../observability/index.js';
import { prisma } from '../db/prisma.js';
import { normalizeImageUrl } from '../tokens/helius.service.js';
import { tokensService } from '../tokens/tokens.service.js';

export interface DexScreenerTokenMetadata {
  mint: string;
  name?: string;
  symbol?: string;
  imageUrl?: string;
  websites?: string[];
  socials?: { type: string; url: string }[];
  priceUsd?: number;
  fdv?: number;
  marketCap?: number;
  liquidityUsd?: number;
  pairAddress?: string;
  dexId?: string;
}

export interface DexScreenerBoostItem {
  url?: string;
  chainId: string;
  tokenAddress: string;
  amount?: number;
  totalAmount?: number;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type?: string; label?: string; url: string }[];
}

export class DexScreenerDiscoveryService {
  private baseTokenUrl = 'https://api.dexscreener.com/latest/dex/tokens';
  private topBoostsUrl = 'https://api.dexscreener.com/token-boosts/top/v1';

  // Strict rate limit: max 60 requests / minute
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 58; // margin below 60
  private backoffUntil = 0;
  private backoffDelayMs = 5000;

  private isRunning = false;
  private boostTimer: NodeJS.Timeout | null = null;
  private metadataTimer: NodeJS.Timeout | null = null;

  /**
   * Enforces max 60 req/min rate limit with sliding window and 429 backoff.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    if (now < this.backoffUntil) {
      const waitTime = this.backoffUntil - now;
      logger.info(`[DexScreener] Throttling for backoff (${Math.round(waitTime / 1000)}s)...`);
      await new Promise((r) => setTimeout(r, waitTime));
    }

    // Purge timestamps older than 60 seconds
    const windowStart = Date.now() - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart);

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldest = this.requestTimestamps[0];
      const waitTime = Math.max(50, oldest + 60_000 - Date.now() + 100);
      logger.info(`[DexScreener] Rate limiter paused for ${waitTime}ms`);
      await new Promise((r) => setTimeout(r, waitTime));
    }

    this.requestTimestamps.push(Date.now());
  }

  /**
   * Handle 429 Too Many Requests with exponential backoff.
   */
  private handleRateLimit() {
    this.backoffDelayMs = Math.min(300_000, this.backoffDelayMs * 2);
    this.backoffUntil = Date.now() + this.backoffDelayMs;
    logger.warn(`[DexScreener] 429 received. Backing off for ${this.backoffDelayMs / 1000}s`);
  }

  /**
   * Fetch token metadata and pairs from DexScreener.
   */
  async fetchTokenMetadata(mint: string): Promise<DexScreenerTokenMetadata | null> {
    await this.throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${this.baseTokenUrl}/${mint}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SolRadar/1.0 (+https://solradar.io)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        this.handleRateLimit();
        return null;
      }

      if (!res.ok) {
        return null;
      }

      this.backoffDelayMs = 5000; // Reset backoff on success
      const json: any = await res.json();
      const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
      if (pairs.length === 0) return null;

      // Select most liquid pair
      const bestPair = pairs.sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      const rawImage = bestPair?.info?.imageUrl;
      const imageUrl = normalizeImageUrl(rawImage) || undefined;
      const priceUsd = bestPair?.priceUsd ? parseFloat(bestPair.priceUsd) : undefined;
      const mcap = bestPair?.marketCap || bestPair?.fdv;

      return {
        mint,
        name: bestPair?.baseToken?.name,
        symbol: bestPair?.baseToken?.symbol,
        imageUrl,
        websites: bestPair?.info?.websites?.map((w: any) => w.url),
        socials: bestPair?.info?.socials,
        priceUsd: !isNaN(priceUsd as number) ? priceUsd : undefined,
        fdv: bestPair?.fdv,
        marketCap: mcap,
        liquidityUsd: bestPair?.liquidity?.usd,
        pairAddress: bestPair?.pairAddress,
        dexId: bestPair?.dexId,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      logger.warn(`[DexScreener] fetchTokenMetadata error for ${mint}: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetches top trending token boosts across DexScreener.
   */
  async fetchTrendingBoosts(): Promise<DexScreenerBoostItem[]> {
    await this.throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(this.topBoostsUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SolRadar/1.0 (+https://solradar.io)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        this.handleRateLimit();
        return [];
      }

      if (!res.ok) {
        logger.warn(`[DexScreener] top boosts returned HTTP ${res.status}`);
        return [];
      }

      this.backoffDelayMs = 5000;
      const data: any = await res.json();
      if (!Array.isArray(data)) return [];

      return data.filter((item) => item && item.tokenAddress);
    } catch (err: any) {
      clearTimeout(timeout);
      logger.warn(`[DexScreener] fetchTrendingBoosts error: ${err.message}`);
      return [];
    }
  }

  /**
   * Polls trending boosts (every 5 min) to catch paid/promoted Solana tokens
   * that might not have originated on pump.fun.
   */
  async pollTrendingBoosts(): Promise<number> {
    const boosts = await this.fetchTrendingBoosts();
    const solanaBoosts = boosts.filter(
      (b) => b.chainId?.toLowerCase() === 'solana' && b.tokenAddress?.length >= 32
    );

    let newCount = 0;
    for (const boost of solanaBoosts) {
      try {
        const result = await tokensService.ingestDexScreenerToken({
          mint: boost.tokenAddress,
          imageUrl: normalizeImageUrl(boost.icon),
          description: boost.description,
        });
        if (result.created) {
          newCount++;
        }
      } catch (err: any) {
        logger.warn(`[DexScreener] Error ingesting boost ${boost.tokenAddress}:`, err.message);
      }
    }

    if (newCount > 0) {
      logger.info(`[DexScreener] Discovered ${newCount} new tokens from trending boosts`);
    }

    return newCount;
  }

  /**
   * Backfills metadata (image, socials) for tokens currently missing image_url.
   */
  async enrichMissingMetadata(limit = 15): Promise<number> {
    try {
      const tokensWithoutImage = await prisma.token.findMany({
        where: { imageUrl: null },
        orderBy: { firstSeenAt: 'desc' },
        take: limit,
      });

      if (tokensWithoutImage.length === 0) return 0;

      let updatedCount = 0;
      for (const t of tokensWithoutImage) {
        const meta = await this.fetchTokenMetadata(t.mint);
        if (meta?.imageUrl) {
          await prisma.token.update({
            where: { id: t.id },
            data: {
              imageUrl: meta.imageUrl,
              name: meta.name && t.name.includes('Token') ? meta.name : undefined,
              symbol: meta.symbol && t.symbol === 'SOLPUMP' ? meta.symbol : undefined,
            },
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        logger.info(`[DexScreener] Backfilled metadata for ${updatedCount} tokens`);
      }

      return updatedCount;
    } catch (err: any) {
      logger.warn('[DexScreener] Error enriching missing metadata:', err.message);
      return 0;
    }
  }

  /**
   * Starts periodic polling for trending boosts (5 min) and missing metadata (2 min).
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('[DexScreener] Discovery service started');

    // Trending boosts: every 5 minutes
    this.boostTimer = setInterval(() => {
      this.pollTrendingBoosts().catch((err) => {
        logger.warn('[DexScreener] Recurring boost poll error:', err.message);
      });
    }, 300_000);

    // Missing metadata backfill: every 2 minutes
    this.metadataTimer = setInterval(() => {
      this.enrichMissingMetadata().catch((err) => {
        logger.warn('[DexScreener] Recurring metadata enrich error:', err.message);
      });
    }, 120_000);

    // Run first boost check shortly after boot
    setTimeout(() => {
      if (this.isRunning) {
        this.pollTrendingBoosts().catch(() => {});
      }
    }, 5000);
  }

  stop(): void {
    this.isRunning = false;
    if (this.boostTimer) {
      clearInterval(this.boostTimer);
      this.boostTimer = null;
    }
    if (this.metadataTimer) {
      clearInterval(this.metadataTimer);
      this.metadataTimer = null;
    }
    logger.info('[DexScreener] Discovery service stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const dexScreenerDiscovery = new DexScreenerDiscoveryService();
