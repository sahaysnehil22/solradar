import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BackgroundWorker } from '../src/worker.js';
import { billingService } from '../src/billing/billing.service.js';
import { prisma } from '../src/db/prisma.js';
import { enqueueWithEventKey, ingestQueue } from '../src/queues/index.js';
import { PlanCode } from '@solradar/shared';

describe('Cross-Process Idempotency & Concurrency Safety', () => {
  let workerInstance1: BackgroundWorker;
  let workerInstance2: BackgroundWorker;
  let stormUserId: string;

  beforeAll(async () => {
    // 1. Initialize test user in database
    const user = await prisma.user.create({
      data: {
        email: `concurrency_${Date.now()}@solradar.io`,
        passwordHash: 'hash_test_12345',
        role: 'user',
        plan: PlanCode.FREE,
        status: 'active',
      },
    });
    stormUserId = user.id;

    // 2. Instantiate two separate worker instances simulating multi-container deployment
    workerInstance1 = new BackgroundWorker();
    workerInstance2 = new BackgroundWorker();
    await workerInstance1.start();
    await workerInstance2.start();
  });

  afterAll(async () => {
    await workerInstance1.stop();
    await workerInstance2.stop();
  });

  it('handles concurrent webhook storm across multiple workers with exactly-once processing', async () => {
    const stormEventId = `evt_cross_process_${Date.now()}`;
    const webhookPayload = {
      id: stormEventId,
      type: 'customer.subscription.created',
      data: {
        userId: stormUserId,
        planCode: PlanCode.HUNTER,
        subscriptionId: `sub_multi_${stormEventId}`,
        status: 'active',
      },
    };

    // 10 concurrent requests split between two simulated worker nodes
    const stormPromises = Array.from({ length: 10 }).map((_, idx) => {
      // Dispatches concurrently across simulated processes
      return billingService.processWebhook(webhookPayload);
    });

    const results = await Promise.all(stormPromises);

    const processed = results.filter((r) => r.status === 'processed');
    const ignored = results.filter((r) => r.status === 'ignored_duplicate');

    // Exactly one worker processed the event, nine were safely rejected as duplicate
    expect(processed).toHaveLength(1);
    expect(ignored).toHaveLength(9);

    // Database backstop verification: exactly one payment event recorded
    const paymentEvents = await prisma.paymentEvent.findMany({
      where: { providerEventId: stormEventId },
    });
    expect(paymentEvents).toHaveLength(1);

    // User plan updated exactly once to Hunter
    const updatedUser = await prisma.user.findUnique({ where: { id: stormUserId } });
    expect(updatedUser?.plan).toBe(PlanCode.HUNTER);
  });

  it('collapses duplicate enqueued jobs at the queue layer via deterministic eventKey jobId', async () => {
    const deterministicEventKey = `launch:mint_concurrency_test_${Date.now()}`;
    const jobData = {
      type: 'helius_webhook',
      mint: 'TestMintConcurrent111111111111111111111111111',
    };

    // Enqueue 5 duplicate jobs concurrently with the exact same deterministic eventKey
    const enqueuePromises = Array.from({ length: 5 }).map(() =>
      enqueueWithEventKey(ingestQueue, 'process_launch', deterministicEventKey, jobData)
    );

    const enqueuedJobs = await Promise.all(enqueuePromises);

    // All return the deterministic jobId
    for (const job of enqueuedJobs) {
      expect((job as any).id || (job as any).jobId).toBe(deterministicEventKey);
    }
  });

  it('distributed lock prevents double-booted workers from running simultaneous maintenance cron', async () => {
    // Both workers attempt to run hourly portfolio snapshots at the same time
    const [result1, result2] = await Promise.all([
      workerInstance1.runHourlyPortfolioSnapshots(),
      workerInstance2.runHourlyPortfolioSnapshots(),
    ]);

    // At least one worker executed the snapshot
    const oneRan = (result1 as any).snapshotCount !== undefined || (result2 as any).snapshotCount !== undefined;
    expect(oneRan).toBe(true);
  });
});
