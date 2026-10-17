# SolRadar Operations, Backups & Disaster Recovery (`docs/ops.md`)

> **Operations Protocol:** Standard Operating Procedures for backups, emergency restore, migration rollbacks, and queue monitoring.

---

## 1. Backup Strategy & Point-In-Time Recovery (PITR)

### Automated Daily Snapshots
- Managed via Supabase / Render Postgres daily automated backup snapshots.
- WAL (Write-Ahead Logging) archiving is enabled with 7-day retention for Point-In-Time Recovery (PITR) down to the second.

### Manual On-Demand Backup
Before applying any database migration touching money or identity tables:
```bash
pg_dump -Fc -v --no-owner -h $DB_HOST -U $DB_USER -d solradar > backups/solradar_pre_migration_$(date +%Y%m%d_%H%M%S).dump
```

---

## 2. Disaster Recovery & Tested Restore Procedure

In the event of database corruption or unrecoverable error:

1. **Step 1: Terminate Worker Ingestion**
   Stop all consumer workers to freeze state mutations:
   ```bash
   docker compose stop worker
   ```

2. **Step 2: Provision Staging Target or Flush Corrupt State**
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

## 3. Migration Rollback Protocol

All Prisma migrations in SolRadar are strictly forward-only. If a schema alteration must be reversed:

1. Revert application code to previous deployment tag.
2. Apply an explicit forward rollback migration file (`prisma migrate deploy`).
3. Never use destructive `DROP TABLE` or `DROP COLUMN` commands without an active 48-hour data-backfill window.

---

## 4. Alerting Thresholds & PagerDuty Triggers

| Alert Name | Condition | Severity | Action Required |
| :--- | :--- | :--- | :--- |
| **Dead-Letter Queue Spike** | `solradar_dlq_depth > 10` for 2m | CRITICAL | Inspect failed BullMQ payload in Admin console |
| **RPC Budget Burn Alert** | `daily_burn > 400,000` before 18:00 UTC | WARNING | Rate-limit background snapshot intervals |
| **Telegram Rate Limit Error** | `alert_send_failures > 5%` | HIGH | Verify flood control window and global budget |
| **Webhook Signature Mismatch** | `unverified_webhooks > 5` in 5m | HIGH | Check endpoint secret rotation |
