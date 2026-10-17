# SolRadar Operations, Migrations & Disaster Recovery (`docs/ops.md`)

> **Operations Protocol:** Standard Operating Procedures for Prisma migrations, backups, emergency restore, and BullMQ queue management.

---

## 1. Prisma Migration Lifecycle

### Initial Migration Review
The initial database schema was generated from `apps/api/prisma/schema.prisma` and is version-controlled at `apps/api/prisma/migrations/20261018000000_init/migration.sql`.
Key schema guarantees verified by hand:
- Provider-agnostic columns: `provider_subscription_id`, `provider_payment_id`, `provider_event_id` (generic across Noop and Stripe providers).
- Uniqueness constraints: `UNIQUE(provider_event_id)` on `payment_events`, `UNIQUE(user_id, alert_id)` on `alert_deliveries`, `UNIQUE(signature)` on `wallet_trades`, and `UNIQUE(user_id, address)` on `tracked_wallets`.
- Foreign key cascading: `ON DELETE CASCADE` on `subscriptions`, `tracked_wallets`, and `watchlists`.

### Applying Migrations in Production
Before starting the API or Worker services:
```bash
# Apply pending migrations strictly forward
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### Developing New Migrations
```bash
# In development environment only:
cd apps/api
npx prisma migrate dev --name <migration_name>
```

---

## 2. Backup Strategy & Point-In-Time Recovery (PITR)

### Automated Daily Snapshots
- Managed via cloud PostgreSQL daily automated backup snapshots.
- WAL (Write-Ahead Logging) archiving enabled with 7-day retention for Point-In-Time Recovery (PITR) down to the second.

### Manual Pre-Migration Backup
Before applying any database migration touching payment, subscription, or user tables:
```bash
pg_dump -Fc -v --no-owner -h $DB_HOST -U $DB_USER -d solradar > backups/solradar_pre_migration_$(date +%Y%m%d_%H%M%S).dump
```

---

## 3. Disaster Recovery & Tested Restore Procedure

In the event of database corruption or unrecoverable state:

1. **Step 1: Terminate Worker Ingestion**
   Stop consumer workers to freeze state mutations:
   ```bash
   docker compose stop worker
   ```

2. **Step 2: Flush State & Recreate Database**
   ```bash
   dropdb -h $DB_HOST -U $DB_USER solradar
   createdb -h $DB_HOST -U $DB_USER solradar
   ```

3. **Step 3: Restore from Verified Archive**
   ```bash
   pg_restore -v --no-owner -h $DB_HOST -U $DB_USER -d solradar backups/solradar_backup.dump
   ```

4. **Step 4: Verify Identity & Money Invariants**
   Run integrity check queries:
   ```sql
   -- Verify referral credit limits
   SELECT COUNT(*) FROM referral_credits WHERE months_applied > months_total; -- Must be 0
   -- Verify active subscriptions match user plans
   SELECT COUNT(*) FROM users u 
   JOIN subscriptions s ON s.user_id = u.id 
   WHERE s.status = 'active' AND u.plan = 'free'; -- Must be 0
   ```

5. **Step 5: Resume Ingestion and Workers**
   ```bash
   docker compose start worker
   ```

---

## 4. BullMQ Queue Health & Dead-Letter Queue (DLQ) Monitoring

SolRadar operates 5 active queues with exponential backoff and designated DLQs:
- `ingest` &rarr; `dlq-ingest`
- `scoring` &rarr; `dlq-scoring`
- `fanout` &rarr; `dlq-fanout`
- `billing` &rarr; `dlq-billing`
- `maintenance` &rarr; `dlq-maintenance`

### Dead-Letter Queue (DLQ) Alerting Thresholds
| Alert Name | Condition | Severity | Action Required |
| :--- | :--- | :--- | :--- |
| **Dead-Letter Queue Spike** | `dlq_depth > 10` for 2m | CRITICAL | Inspect failed BullMQ payload in DLQ; check downstream RPC |
| **RPC Budget Burn Alert** | `daily_burn > 400,000` before 18:00 UTC | WARNING | Throttle background snapshot intervals |
| **Telegram Rate Limit Error** | `alert_send_failures > 5%` | HIGH | Verify flood control window and global budget |
| **Webhook Signature Mismatch** | `unverified_webhooks > 5` in 5m | HIGH | Check endpoint secret rotation |
