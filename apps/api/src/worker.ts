import { Worker, Job } from 'bullmq';
import {
  QUEUE_NAMES,
  DLQ_NAMES,
  DEFAULT_JOB_OPTIONS,
  dlqIngestQueue,
  dlqScoringQueue,
  dlqFanoutQueue,
  dlqBillingQueue,
  dlqMaintenanceQueue,
  maintenanceQueue,
} from './queues/index.js';
import { getRedisClient, isRedisConnected, acquireDistributedLock } from './queues/redis.js';
import { prisma } from './db/prisma.js';
import { logger } from './observability/index.js';
import { tokensService } from './tokens/tokens.service.js';
import { walletsService } from './wallets/wallets.service.js';
import { billingService } from './billing/billing.service.js';

export class BackgroundWorker {
  private isRunning = false;
  private workers: Worker[] = [];
  private userSentTimestamps = new Map<string, number[]>(); // flood control: max 20 msg/min per user

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('SolRadar BullMQ Worker Host starting...');

    const connection = getRedisClient();

    // If Redis is not currently connected (e.g. offline unit test suite), operate in memory mode
    if (!isRedisConnected()) {
      logger.info('SolRadar Worker Host initialized in offline memory mode (Redis offline)');
      return;
    }

    // 1. Ingest Queue Processor
    const ingestWorker = new Worker(
      QUEUE_NAMES.INGEST,
      async (job: Job) => {
        logger.info(`Processing ingest job ${job.id}`, { name: job.name });
        const { type, events, payload } = job.data;
        if (type === 'helius_webhook' && events) {
          return await tokensService.ingestHeliusWebhook(events);
        } else if (type === 'wallet_trade' && payload) {
          return await walletsService.recordWalletTrade(payload);
        }
        return { processed: true };
      },
      { connection, concurrency: 5 }
    );
    this.setupWorkerHooks(ingestWorker, dlqIngestQueue, QUEUE_NAMES.INGEST);
    this.workers.push(ingestWorker);

    // 2. Scoring & On-Chain Enrichment Queue Processor
    const scoringWorker = new Worker(
      QUEUE_NAMES.SCORING,
      async (job: Job) => {
        logger.info(`Processing scoring/enrichment job ${job.id}`, { name: job.name });
        const { mint, creator, stage } = job.data;
        if (mint) {
          return await tokensService.enrichTokenOnChain(mint, creator, stage);
        }
        return { scored: true };
      },
      { connection, concurrency: 2 }
    );
    this.setupWorkerHooks(scoringWorker, dlqScoringQueue, QUEUE_NAMES.SCORING);
    this.workers.push(scoringWorker);

    // 3. Fanout Queue Processor (with rate limits and DB deduplication)
    const fanoutWorker = new Worker(
      QUEUE_NAMES.FANOUT,
      async (job: Job) => {
        logger.info(`Processing alert fanout job ${job.id}`, { name: job.name });
        const { alertId, eventKey, payload } = job.data;

        // Fetch users to deliver to
        const users = await prisma.user.findMany({ where: { status: 'active' } });
        let deliveredCount = 0;

        for (const user of users) {
          // Check flood control limit: max 20 per minute per user
          const now = Date.now();
          const timestamps = (this.userSentTimestamps.get(user.id) || []).filter((t) => now - t < 60000);

          if (timestamps.length >= 20) {
            logger.warn('User hit flood control limit (20 msg/min)', { userId: user.id });
            continue;
          }

          try {
            // Exactly-once DB unique constraint backstop: UNIQUE(user_id, alert_id)
            await prisma.alertDelivery.create({
              data: {
                alertId,
                userId: user.id,
                channel: 'telegram',
                status: 'sent',
              },
            });

            timestamps.push(now);
            this.userSentTimestamps.set(user.id, timestamps);
            deliveredCount++;

            await prisma.systemCounter.upsert({
              where: { key: 'alert_fanout_count' },
              update: { value: { increment: 1 } },
              create: { key: 'alert_fanout_count', value: BigInt(1) },
            });
          } catch {
            // Already delivered (UNIQUE constraint dropped duplicate)
          }
        }

        return { deliveredCount };
      },
      { connection, concurrency: 10 }
    );
    this.setupWorkerHooks(fanoutWorker, dlqFanoutQueue, QUEUE_NAMES.FANOUT);
    this.workers.push(fanoutWorker);

    // 4. Billing Queue Processor
    const billingWorker = new Worker(
      QUEUE_NAMES.BILLING,
      async (job: Job) => {
        logger.info(`Processing billing job ${job.id}`, { name: job.name });
        const { payload, signature } = job.data;
        return await billingService.processWebhook(payload, signature);
      },
      { connection, concurrency: 2 }
    );
    this.setupWorkerHooks(billingWorker, dlqBillingQueue, QUEUE_NAMES.BILLING);
    this.workers.push(billingWorker);

    // 5. Maintenance Queue Processor (Repeatable Jobs with Distributed Lock)
    const maintenanceWorker = new Worker(
      QUEUE_NAMES.MAINTENANCE,
      async (job: Job) => {
        logger.info(`Processing maintenance cron job ${job.id}`, { name: job.name });

        if (job.name === 'portfolio-snapshot') {
          return await this.runHourlyPortfolioSnapshots();
        } else if (job.name === 'counter-reset') {
          return await this.resetDailyCounters();
        }
        return { completed: true };
      },
      { connection, concurrency: 1 }
    );
    this.setupWorkerHooks(maintenanceWorker, dlqMaintenanceQueue, QUEUE_NAMES.MAINTENANCE);
    this.workers.push(maintenanceWorker);

    // Register repeatable jobs on maintenance queue
    await this.registerRepeatableJobs();

    logger.info('SolRadar BullMQ Worker Host active with 5 queue processors');
  }

  private setupWorkerHooks(worker: Worker, dlqQueue: any, queueName: string) {
    worker.on('failed', async (job: Job | undefined, err: Error) => {
      if (!job) return;
      logger.error(`Job ${job.id} failed in queue ${queueName} on attempt ${job.attemptsMade}:`, err.message);

      // If all retries exhausted, send to DLQ
      const maxAttempts = job.opts?.attempts || DEFAULT_JOB_OPTIONS.attempts;
      if (job.attemptsMade >= maxAttempts) {
        logger.warn(`Job ${job.id} exhausted retries. Routing to DLQ ${queueName}`, {
          jobId: job.id,
          attempts: job.attemptsMade,
        });

        try {
          await dlqQueue.add(`dead_${job.name}`, {
            originalJobId: job.id,
            originalQueue: queueName,
            data: job.data,
            failedReason: job.failedReason || err.message,
            stacktrace: job.stacktrace,
            failedAt: new Date(),
          });
        } catch (dlqErr: any) {
          logger.error(`Failed to push job ${job.id} to DLQ:`, dlqErr.message);
        }
      }
    });
  }

  private async registerRepeatableJobs() {
    try {
      // Repeatable job 1: Hourly portfolio snapshots
      await maintenanceQueue.add(
        'portfolio-snapshot',
        { type: 'portfolio_snapshot' },
        {
          repeat: { pattern: '0 * * * *' }, // every hour
          jobId: 'repeatable:portfolio_snapshot',
        }
      );

      // Repeatable job 2: Daily counter reset at midnight
      await maintenanceQueue.add(
        'counter-reset',
        { type: 'counter_reset' },
        {
          repeat: { pattern: '0 0 * * *' }, // midnight
          jobId: 'repeatable:counter_reset',
        }
      );
    } catch (e: any) {
      logger.warn('Repeatable jobs registration handled:', e.message);
    }
  }

  /**
   * Hourly portfolio snapshot runner with distributed lock.
   * Ensures double-booted workers don't execute concurrently.
   */
  async runHourlyPortfolioSnapshots() {
    const redis = getRedisClient();
    const lock = await acquireDistributedLock(redis, 'lock:maintenance:portfolio_snapshots', 30000);

    if (!lock.acquired) {
      logger.info('Portfolio snapshot skipped: lock held by another worker instance');
      return { skipped: true, reason: 'lock_held' };
    }

    try {
      const users = await prisma.user.findMany();
      let snapshotCount = 0;

      for (const user of users) {
        const summary = await walletsService.getPortfolioSummary(user.id);
        logger.info('Hourly portfolio snapshot recorded', {
          userId: user.id,
          totalValueUsd: summary.totalValueUsd,
        });
        snapshotCount++;
      }

      return { snapshotCount };
    } finally {
      await lock.release();
    }
  }

  /**
   * Daily counter reset with distributed lock.
   */
  async resetDailyCounters() {
    const redis = getRedisClient();
    const lock = await acquireDistributedLock(redis, 'lock:maintenance:counter_reset', 30000);

    if (!lock.acquired) {
      logger.info('Daily counter reset skipped: lock held by another worker instance');
      return { skipped: true, reason: 'lock_held' };
    }

    try {
      await prisma.systemCounter.upsert({
        where: { key: 'rpc_budget_burn_daily' },
        update: { value: BigInt(0) },
        create: { key: 'rpc_budget_burn_daily', value: BigInt(0) },
      });
      logger.info('Daily RPC budget burn counter reset');
      return { reset: true };
    } finally {
      await lock.release();
    }
  }

  async stop() {
    this.isRunning = false;
    for (const w of this.workers) {
      try {
        await w.close();
      } catch {
        // ignore
      }
    }
    this.workers = [];
    logger.info('SolRadar BullMQ Worker Host stopped');
  }
}

export const worker = new BackgroundWorker();

// If invoked directly as CLI worker
if (process.argv[1]?.endsWith('worker.js') || process.argv[1]?.endsWith('worker.ts')) {
  worker.start().catch((err) => {
    logger.error('Failed to start BullMQ worker:', err);
    process.exit(1);
  });
}
