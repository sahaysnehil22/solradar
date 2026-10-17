import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient, isRedisConnected } from './redis.js';
import { env } from '../config/env.js';
import { logger } from '../observability/index.js';

export const QUEUE_NAMES = {
  INGEST: 'ingest',
  SCORING: 'scoring',
  FANOUT: 'fanout',
  BILLING: 'billing',
  MAINTENANCE: 'maintenance',
} as const;

export const DLQ_NAMES = {
  INGEST: 'dlq-ingest',
  SCORING: 'dlq-scoring',
  FANOUT: 'dlq-fanout',
  BILLING: 'dlq-billing',
  MAINTENANCE: 'dlq-maintenance',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

function createQueueInstance(name: string): Queue {
  const connection = getRedisClient();
  const opts: QueueOptions = {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  };
  return new Queue(name, opts);
}

// In-Memory Queue Adapter for offline environments/unit tests
class MemoryQueueAdapter {
  public name: string;
  public jobs = new Map<string, any>();
  private handlers = new Set<(job: any) => Promise<any>>();

  constructor(name: string) {
    this.name = name;
  }

  async add(jobName: string, data: any, opts: any = {}) {
    const jobId = opts.jobId || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Deterministic deduplication by jobId
    if (this.jobs.has(jobId)) {
      logger.info(`Duplicate job collapsed in memory queue ${this.name}`, { jobId });
      return { id: jobId, name: jobName, data, duplicate: true };
    }
    const job = { id: jobId, name: jobName, data, opts };
    this.jobs.set(jobId, job);

    for (const h of this.handlers) {
      Promise.resolve(h(job)).catch((err) => {
        logger.error(`Handler error in memory queue ${this.name}:`, err);
      });
    }

    return job;
  }

  registerHandler(handler: (job: any) => Promise<any>) {
    this.handlers.add(handler);
  }

  async close() {
    this.jobs.clear();
    this.handlers.clear();
  }
}

// Proxied Queues that route to BullMQ or in-memory fallback
function createManagedQueue(name: string): Queue {
  const memoryFallback = new MemoryQueueAdapter(name);
  let realQueue: Queue | null = null;

  try {
    realQueue = createQueueInstance(name);
  } catch (err: any) {
    logger.warn(`Could not initialize real BullMQ queue for ${name}:`, err.message);
  }

  return new Proxy(memoryFallback as any, {
    get(target: any, prop: string | symbol) {
      if (isRedisConnected() && realQueue && prop in realQueue) {
        const val = (realQueue as any)[prop];
        if (typeof val === 'function') return val.bind(realQueue);
        return val;
      }
      const val = target[prop];
      if (typeof val === 'function') return val.bind(target);
      return val;
    },
  });
}

// 5 Named BullMQ Queues
export const ingestQueue = createManagedQueue(QUEUE_NAMES.INGEST);
export const scoringQueue = createManagedQueue(QUEUE_NAMES.SCORING);
export const fanoutQueue = createManagedQueue(QUEUE_NAMES.FANOUT);
export const billingQueue = createManagedQueue(QUEUE_NAMES.BILLING);
export const maintenanceQueue = createManagedQueue(QUEUE_NAMES.MAINTENANCE);

// 5 Dead-Letter Queues (DLQ)
export const dlqIngestQueue = createManagedQueue(DLQ_NAMES.INGEST);
export const dlqScoringQueue = createManagedQueue(DLQ_NAMES.SCORING);
export const dlqFanoutQueue = createManagedQueue(DLQ_NAMES.FANOUT);
export const dlqBillingQueue = createManagedQueue(DLQ_NAMES.BILLING);
export const dlqMaintenanceQueue = createManagedQueue(DLQ_NAMES.MAINTENANCE);

/**
 * Enqueue a job with a deterministic eventKey as BullMQ jobId.
 * Collapses duplicate enqueue calls before the job enters processing.
 */
export async function enqueueWithEventKey(
  queue: Queue,
  jobName: string,
  eventKey: string,
  data: any,
  extraOpts: any = {}
) {
  return await queue.add(jobName, data, {
    ...DEFAULT_JOB_OPTIONS,
    jobId: eventKey, // Deterministic deduplication key
    ...extraOpts,
  });
}
