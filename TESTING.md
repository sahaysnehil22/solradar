# SolRadar Test Execution & Verification Guide (`TESTING.md`)

> **Automated Test Coverage:** Unit, integration, cross-process idempotency, retry storms, and critical path flows.

---

## 1. Running Automated Tests

SolRadar tests can run in two modes:
1. **Offline Mode (Default / CI fast lane):** Tests execute against an in-memory transactional adapter and mock queue layer when Postgres/Redis are not active on `localhost`.
2. **Real Services Mode (Integration verification):** Tests execute against real PostgreSQL and Redis containers booted via Docker Compose.

```bash
# Run all tests across the monorepo (packages/shared, apps/api, apps/bot)
npm test

# Run API test suite with 18 tests (including cross-process idempotency)
npm --prefix apps/api test

# Run Telegram bot test suite
npm --prefix apps/bot test

# Run Shared package test suite
npm --prefix packages/shared test
```

---

## 2. Testing with Real Postgres + Redis (Docker Compose)

To test against live PostgreSQL and Redis services:

1. **Boot Test Services:**
   ```bash
   docker compose up -d postgres redis
   ```

2. **Deploy Prisma Migrations:**
   ```bash
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```

3. **Execute Test Suite:**
   ```bash
   npm test
   ```

---

## 3. Test Suites Overview

### A. Shared Package (`packages/shared`)
- `risk.test.ts`: Verifies that critical contract flags (Mint Authority Active, Freeze Authority Active, LP Unlocked, Extreme Top 10 Concentration) penalize risk scores deterministically.
- `billing.test.ts`: Verifies test checkout session generation, referral discount math, and upgrade proration calculations.
- `schemas.test.ts`: Tests Zod input boundary validation for Solana wallet addresses, email/password rules, and screener query params.

### B. API Integration Suite (`apps/api/test` - 18 Tests)
- `health.test.ts` (3 tests): Tests `/healthz`, `/readyz`, and Prometheus `/metrics`.
- `auth.test.ts` (4 tests): Tests signup, login, session token issue, and rotating refresh tokens with reuse attack detection and immediate family revocation.
- `billing-idempotency.test.ts` (2 tests): Simulates concurrent retry storms of identical payment webhooks. Confirms duplicate events are dropped and referral credits are applied race-safely via row locks.
- `screener-risk.test.ts` (3 tests): Ingests real-time Helius webhook payloads and verifies immediate creation of tokens, snapshots, risk reports, and launch alerts.
- `wallets-signals.test.ts` (3 tests): Tests plan limit gating (Free: 0, Scout: 1, Hunter: 10), signature deduplication on wallet trades, and read-only public portfolio tracking without private keys.
- `cross-process-idempotency.test.ts` (3 tests):
  1. Multi-worker webhook storm: 10 concurrent webhook requests across two worker instances resulting in exactly 1 processed payment event and 9 rejected duplicates.
  2. Queue deduplication: 5 duplicate enqueues with deterministic `eventKey` as `jobId` collapsing down to 1 job.
  3. Distributed lock safety: Simulates simultaneous maintenance execution on two workers, verifying that the distributed lock prevents duplicate snapshot execution.

### C. Telegram Bot Suite (`apps/bot/test` - 3 Tests)
- `bot.test.ts` (3 tests): Tests high-risk and low-risk Markdown alert formatters, copy-trade signal generation with PnL track records, and 60-second in-memory session caching.
