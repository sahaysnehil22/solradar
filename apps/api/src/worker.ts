import { db } from './db/store.js';
import { logger } from './observability/index.js';
import { tokensService } from './tokens/tokens.service.js';
import { walletsService } from './wallets/wallets.service.js';

export class BackgroundWorker {
  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private userSentTimestamps = new Map<string, number[]>(); // for <= 20 msg/min flood control

  start() {
    this.isRunning = true;
    logger.info('SolRadar Background Queue & Cron Worker started');

    // Run polling/processing interval
    this.intervalTimer = setInterval(() => this.processQueues(), 3000);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    logger.info('SolRadar Background Queue & Cron Worker stopped');
  }

  private async processQueues() {
    if (!this.isRunning) return;

    try {
      // 1. Process Alert Fanout with database deduplication and flood control
      for (const alert of db.alerts.values()) {
        for (const user of db.users.values()) {
          // Check flood control limit: max 20 per minute
          const now = Date.now();
          const timestamps = (this.userSentTimestamps.get(user.id) || []).filter((t) => now - t < 60000);

          if (timestamps.length >= 20) {
            // Rate-limited for this window
            continue;
          }

          // Attempt idempotent delivery
          const delivered = db.recordAlertDeliveryIdempotent(user.id, alert.id, 'telegram');
          if (delivered) {
            timestamps.push(now);
            this.userSentTimestamps.set(user.id, timestamps);

            const fanoutCount = db.systemCounters.get('alert_fanout_count') || 0;
            db.systemCounters.set('alert_fanout_count', fanoutCount + 1);
          }
        }
      }
    } catch (err) {
      logger.error('Error in background queue loop', err);
    }
  }

  // Hourly portfolio snapshot runner
  async runHourlyPortfolioSnapshots() {
    for (const user of db.users.values()) {
      const summary = walletsService.getPortfolioSummary(user.id);
      logger.info('Hourly portfolio snapshot recorded', {
        userId: user.id,
        totalValueUsd: summary.totalValueUsd,
      });
    }
  }
}

export const worker = new BackgroundWorker();

// If invoked as CLI worker
if (process.argv[1]?.endsWith('worker.js') || process.argv[1]?.endsWith('worker.ts')) {
  worker.start();
}
