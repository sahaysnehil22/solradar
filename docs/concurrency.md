# SolRadar Concurrency & Race-Condition Safeguards (`docs/concurrency.md`)

> **Guiding Principle:** Assume hostile concurrency across multi-instance queue workers, concurrent webhook retries, and high-frequency trade ingestion.

---

## 1. Concurrency Matrix & Guard Architecture

| Path / Shared Resource | Failure Mode Prevented | Primary Guard | Backstop Guard |
| :--- | :--- | :--- | :--- |
| **Payment Webhooks** | Double crediting, duplicate subscription activation | Transactional Insert into `payment_events` with `UNIQUE(stripe_event_id)` | Row-level locking on User Identity |
| **Referral Credit Application** | Double-applying 20% discount on retry storms | `acquireRowLock("referral:<id>")` / `SELECT ... FOR UPDATE` | `months_applied < months_total` state condition |
| **Telegram Alert Fanout** | Spamming users with duplicate alerts for the same on-chain event | In-database deduplication via `alert_deliveries` `UNIQUE(user_id, alert_id)` | Deterministic BullMQ Job ID (`event_key` as `jobId`) |
| **Smart-Wallet Trade Ingestion** | Double counting trades, duplicate copy signals | `wallet_trades` `UNIQUE(signature)` | Deterministic signature key indexing |
| **Tracked Wallet Counts** | Bypassing plan limits (Scout: 1, Hunter: 10) by sending concurrent track requests | Transactional row lock on `tracked_wallets` count evaluation | Database constraint `UNIQUE(user_id, address)` |
| **Cron Jobs (Portfolio / Dunning)** | Multiple workers executing same scheduled task simultaneously | Advisory Lock (`pg_try_advisory_lock`) | Hourly window snapshot uniqueness |
| **Telegram Flood Control** | User or viral token exhausting Telegram rate limits | Sliding-window per-user in-memory token bucket (&le; 20 msg/min) | Global rate budget guard (&le; 3000 msg/min) |

---

## 2. Deterministic Queue Job IDs (BullMQ)

When an alert-worthy event is generated (e.g. token launch, whale buy, tracked wallet trade), the queue job is enqueued with a deterministic `jobId`:

```typescript
const jobId = event.eventKey; // e.g. "launch:DezXAZ8z7...B263"
await fanoutQueue.add('alert_fanout', event, {
  jobId, // BullMQ automatically collapses double-enqueues into 1 job
  removeOnComplete: true,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

---

## 3. Database-Level Exactly-Once Delivery Guarantee

In high-concurrency environments, application memory is vulnerable to worker restarts. SolRadar delegates final idempotency to PostgreSQL:

```sql
CREATE TABLE alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  channel VARCHAR(20) NOT NULL DEFAULT 'telegram',
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_alert UNIQUE (user_id, alert_id)
);
```

Any duplicate send attempt triggers a unique constraint violation and is gracefully dropped before invoking the Telegram bot API.
