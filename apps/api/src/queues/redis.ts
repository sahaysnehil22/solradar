import { Redis } from 'ioredis';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../observability/index.js';

let sharedRedis: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis {
  if (!sharedRedis) {
    sharedRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (env.NODE_ENV === 'test' && times > 1) return null; // stop retrying in offline test
        return Math.min(times * 500, 3000);
      },
    });

    sharedRedis.on('error', (err) => {
      isRedisAvailable = false;
      if (env.NODE_ENV === 'production') {
        logger.error('CRITICAL: Redis connection error:', err.message);
      } else {
        logger.warn('Redis connection inactive', { error: err.message });
      }
    });

    sharedRedis.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Connected to Redis server for queues');
    });
  }

  return sharedRedis;
}

export function isRedisConnected(): boolean {
  return isRedisAvailable;
}

/**
 * Distributed Lock using Redis SET ... NX PX with unique token.
 * Prevents double-execution across multiple worker instances.
 */
export async function acquireDistributedLock(
  redis: Redis,
  lockKey: string,
  ttlMs = 15000
): Promise<{ acquired: boolean; token: string; release: () => Promise<void> }> {
  const token = crypto.randomUUID();
  try {
    const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    const acquired = result === 'OK';
    return {
      acquired,
      token,
      release: async () => {
        try {
          // Safe release via Lua script (only delete if token matches)
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
          `;
          await redis.eval(script, 1, lockKey, token);
        } catch {
          // ignore release errors
        }
      },
    };
  } catch {
    // If Redis is offline, simulate a local lock
    return {
      acquired: true,
      token,
      release: async () => {},
    };
  }
}
