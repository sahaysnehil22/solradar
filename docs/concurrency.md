# SolRadar Concurrency & Race-Condition Safeguards (`docs/concurrency.md`)

> **Guiding Principle:** Hostile concurrency across multi-instance BullMQ queue workers, concurrent webhook retries, and high-frequency trade ingestion is strictly prevented through PostgreSQL row-level locks, transactional boundary isolation, and Redis distributed locks.

---

## 1. Concurrency Matrix & Locking Architecture

| Path / Shared Resource | Failure Mode Prevented | Primary Guard | Backstop Guard |
| :--- | :--- | :--- | :--- |
| **Payment Webhooks** | Double crediting, duplicate subscription activation under retry storm | PostgreSQL `$transaction` with row-level lock (`SELECT ... FOR UPDATE` via `tx.$queryRaw`) on `users` | Table constraint `UNIQUE(provider_event_id)` on `payment_events` |
| **Referral Credit Application** | Double-applying 20% discount on concurrent payment cycle webhooks | Interactive transaction row-level lock `SELECT id FROM referral_credits WHERE id = ? FOR UPDATE` | Atomic integer decrement `months_applied < months_total` state condition |
| **Referral Code Claiming** | Two users claiming the same referral link simultaneously | Interactive transaction row-level lock `SELECT id FROM referrals WHERE id = ? FOR UPDATE` | `referee_user_id IS NULL` check before `referee_user_id = ?` update |
| **Telegram Alert Fanout** | Spamming users with duplicate alerts for the same on-chain event | Deterministic BullMQ `jobId: eventKey` collapsing duplicates at the queue level | Table constraint `UNIQUE(user_id, alert_id)` on `alert_deliveries` |
| **Smart-Wallet Trade Ingestion** | Double counting trades, duplicate copy signals | Unique constraint check `wallet_trades.signature` in transactional insert | Table constraint `UNIQUE(signature)` |
| **Tracked Wallet Counts** | Bypassing plan limits (Scout: 1, Hunter: 10) by sending concurrent track requests | Transactional count evaluation with row lock on `users` record | Database constraint `UNIQUE(user_id, address)` on `tracked_wallets` |
| **Cron Jobs (Portfolio Snapshots, Counter Resets)** | Multiple worker containers executing same scheduled cron task simultaneously | Redis distributed lock (`SET key token NX PX 30000`) with safe Lua token release | Queue repeatable job definition (`jobId: repeatable:...`) |
| **Telegram Flood Control** | User or viral token exhausting Telegram rate limits | Sliding-window per-user token timestamp window (&le; 20 msg/min) | Global rate budget guard (&le; 3000 msg/min) |

---

## 2. Row-Level Locking Model (`SELECT ... FOR UPDATE`)

Prisma does not provide native ORM record-level locking syntax. SolRadar executes raw SQL row locks inside Prisma interactive transactions (`prisma.$transaction(async (tx) => { ... })`):

```typescript
// apps/api/src/db/prisma.ts

export async function lockUserForUpdate(tx: any, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

export async function lockSubscriptionForUpdate(tx: any, subscriptionId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${subscriptionId} FOR UPDATE`;
}

export async function lockReferralCreditForUpdate(tx: any, creditId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM referral_credits WHERE id = ${creditId} FOR UPDATE`;
}

export async function lockReferralForUpdate(tx: any, referralId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM referrals WHERE id = ${referralId} FOR UPDATE`;
}
```

When a webhook arrives or referral credit is applied:
1. `tx.$queryRaw` acquires the row lock in PostgreSQL.
2. If another transaction holds the lock, PostgreSQL blocks the incoming transaction until the first commits or rolls back.
3. The lock is automatically released upon transaction completion.

---

## 3. Deterministic Job IDs (BullMQ Queue Layer)

When an alert-worthy event is generated (e.g. token launch, whale buy, tracked wallet trade), the queue job is enqueued with a deterministic `jobId`:

```typescript
// apps/api/src/queues/index.ts

export async function enqueueWithEventKey(
  queue: Queue,
  jobName: string,
  eventKey: string,
  data: any,
  extraOpts: any = {}
) {
  return await queue.add(jobName, data, {
    ...DEFAULT_JOB_OPTIONS,
    jobId: eventKey, // BullMQ automatically collapses duplicate enqueues to 1 job
    ...extraOpts,
  });
}
```

Because Redis keys are deterministic, if multiple webhook ingress threads enqueue the same event simultaneously, Redis drops the duplicate enqueue before it ever reaches a worker.

---

## 4. Multi-Worker Distributed Locks for Crons

In multi-instance worker deployments (`solradar-worker-1`, `solradar-worker-2`), scheduled maintenance tasks (hourly portfolio snapshot and midnight counter reset) use Redis distributed locking:

```typescript
// apps/api/src/queues/redis.ts

export async function acquireDistributedLock(
  redis: Redis,
  lockKey: string,
  ttlMs = 15000
): Promise<{ acquired: boolean; token: string; release: () => Promise<void> }> {
  const token = crypto.randomUUID();
  const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
  const acquired = result === 'OK';
  return {
    acquired,
    token,
    release: async () => {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(script, 1, lockKey, token);
    },
  };
}
```

If two workers boot simultaneously, only the worker that successfully acquires the lock executes the cron run. The second worker skips execution cleanly.

---

## 5. Verification & Tests

The cross-process locking and deduplication guarantees are verified in:
- `apps/api/test/cross-process-idempotency.test.ts`: 10-request concurrent webhook storm across 2 worker instances resulting in exactly 1 processed payment event and 9 duplicates rejected.
- `apps/api/test/billing-idempotency.test.ts`: Referral credit discount preservation under concurrent subscription creation webhooks.
