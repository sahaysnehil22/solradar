import { logger } from '../observability/index.js';
import { tokensService } from '../tokens/tokens.service.js';

export interface PumpFunCoin {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  created_timestamp: number;
  market_cap?: number;
  usd_market_cap?: number;
  virtual_sol_reserves?: number | string;
  virtual_token_reserves?: number | string;
  complete?: boolean;
  creator?: string;
}

export class PumpFunDiscoveryService {
  private apiUrl =
    'https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=false';
  private baseIntervalMs = 15_000; // 15 seconds
  private currentIntervalMs = 15_000;
  private maxIntervalMs = 300_000; // 5 minutes max backoff
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(apiUrl?: string, intervalMs?: number) {
    if (apiUrl) this.apiUrl = apiUrl;
    if (intervalMs) {
      this.baseIntervalMs = intervalMs;
      this.currentIntervalMs = intervalMs;
    }
  }

  /**
   * Fetches latest 50 coins from pump.fun frontend API.
   * Isolates URL, headers, and parsing for easy maintenance.
   */
  async fetchLatestCoins(): Promise<PumpFunCoin[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SolRadar/1.0 (+https://solradar.io)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        this.currentIntervalMs = Math.min(this.maxIntervalMs, this.currentIntervalMs * 2);
        logger.warn(
          `[PumpFunDiscovery] 429 Too Many Requests. Backing off interval to ${this.currentIntervalMs / 1000}s`
        );
        return [];
      }

      if (!res.ok) {
        logger.warn(`[PumpFunDiscovery] GET failed with HTTP ${res.status}`);
        return [];
      }

      // Successful request: reset backoff
      this.currentIntervalMs = this.baseIntervalMs;

      const data: any = await res.json();
      if (!Array.isArray(data)) {
        logger.warn('[PumpFunDiscovery] Response is not an array', { data });
        return [];
      }

      return data
        .filter((item) => item && typeof item.mint === 'string' && item.mint.length >= 32)
        .map((item) => ({
          mint: item.mint,
          name: item.name || `${item.symbol || item.mint.slice(0, 4)} Token`,
          symbol: item.symbol || item.mint.slice(0, 4).toUpperCase(),
          description: item.description || undefined,
          image_uri: item.image_uri || undefined,
          created_timestamp: Number(item.created_timestamp) || Date.now(),
          market_cap: typeof item.market_cap === 'number' ? item.market_cap : undefined,
          usd_market_cap: typeof item.usd_market_cap === 'number' ? item.usd_market_cap : undefined,
          virtual_sol_reserves: item.virtual_sol_reserves,
          virtual_token_reserves: item.virtual_token_reserves,
          complete: !!item.complete,
          creator: item.creator || undefined,
        }));
    } catch (err: any) {
      clearTimeout(timeout);
      logger.warn(`[PumpFunDiscovery] Network or parse error: ${err.message}`);
      return [];
    }
  }

  /**
   * Executes a single poll cycle.
   * For each new coin not yet in DB, registers the token and schedules enrichment.
   */
  async pollOnce(): Promise<{ fetched: number; newCoins: number }> {
    if (this.isPolling) {
      return { fetched: 0, newCoins: 0 };
    }
    this.isPolling = true;

    try {
      const coins = await this.fetchLatestCoins();
      let newCoins = 0;

      for (const coin of coins) {
        try {
          const result = await tokensService.ingestPumpFunCoin(coin);
          if (result.created) {
            newCoins++;
          }
        } catch (err: any) {
          logger.warn(`[PumpFunDiscovery] Failed to ingest coin ${coin.mint}:`, err.message);
        }
      }

      if (newCoins > 0) {
        logger.info(`[PumpFunDiscovery] Polled ${coins.length} coins, discovered ${newCoins} new launches`);
      }

      return { fetched: coins.length, newCoins };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Starts the recurring pump.fun discovery poller.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`[PumpFunDiscovery] Poller started (interval: ${this.currentIntervalMs / 1000}s)`);

    const scheduleNext = () => {
      if (!this.isRunning) return;
      this.timer = setTimeout(async () => {
        try {
          await this.pollOnce();
        } catch (err: any) {
          logger.warn('[PumpFunDiscovery] Unhandled poll error:', err.message);
        } finally {
          scheduleNext();
        }
      }, this.currentIntervalMs);
    };

    // Run first poll shortly after start
    setTimeout(() => {
      if (this.isRunning) {
        this.pollOnce().catch(() => {});
        scheduleNext();
      }
    }, 1000);
  }

  /**
   * Stops the recurring poller.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('[PumpFunDiscovery] Poller stopped');
  }

  getInterval(): number {
    return this.currentIntervalMs;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const pumpFunDiscovery = new PumpFunDiscoveryService();
