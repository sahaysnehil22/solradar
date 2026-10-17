# SolRadar Launch Readiness & Production Hardening Checklist (`docs/launch-checklist.md`)

> **Verification Status:** Fully Signed Off for MVP Deployment.

---

## 1. Production Hardening Sign-Off (§6)

### 6.1 Idempotency
- [x] **Stripe / Billing Webhooks:** Guarded via `payment_events.stripe_event_id` unique column inside transactions. Duplicate events return `status: "ignored_duplicate"`.
- [x] **Alert Fanout Delivery:** Guarded by `alert_deliveries.UNIQUE(user_id, alert_id)`. Database constraint prevents duplicate Telegram messages.
- [x] **Referral Credits Application:** Row-locked via `acquireRowLock` / `SELECT ... FOR UPDATE` before incrementing `months_applied`.
- [x] **Tracked Wallet Trades:** Duplicate transactions dropped via `wallet_trades.UNIQUE(signature)`.

### 6.2 Race Conditions
- [x] **Deterministic BullMQ Job IDs:** `jobId = event_key` prevents duplicate queue jobs from being enqueued by parallel workers.
- [x] **Plan Limit Enforcement:** Transactional checks prevent exceeding max tracked wallets (Scout: 1, Hunter: 10).
- [x] **Concurrency Model Documented:** Complete matrix published in `docs/concurrency.md`.

### 6.3 Queues & Reliability
- [x] **Exponential Backoff:** Configured on all ingest and fanout queues.
- [x] **Dead-Letter Queue (DLQ):** Instrumented and monitored via Prometheus gauge `solradar_dlq_depth`.
- [x] **Graceful Shutdown:** SIGTERM / SIGINT handlers in API and worker processes.

### 6.4 Webhook & API Security
- [x] **Fastify Helmet:** Enabled on all HTTP routes.
- [x] **Zod Validation:** Enforced on every input boundary (Auth, Billing, Tokens, Wallets, Telegram).
- [x] **Prisma Type Safety:** Zero string-concatenated SQL queries in application logic.

### 6.5 Auth & Sessions
- [x] **Password Hashing:** `bcryptjs` with salt rounds.
- [x] **JWT Access Token:** Short-lived 15-minute access token.
- [x] **Rotating Refresh Token:** Family-based tracking with automatic revocation of all tokens if reuse is detected.
- [x] **Telegram initData Validation:** HMAC-SHA256 signature verification per official Telegram specification.

### 6.6 Observability
- [x] **Structured JSON Logging:** Standardized level, timestamp, message, and context meta.
- [x] **Liveness Endpoint:** `GET /healthz` returns 200 and uptime.
- [x] **Readiness Endpoint:** `GET /readyz` checks DB, Redis, and Billing provider status.
- [x] **Prometheus Scrape Endpoint:** `GET /metrics` exporting request counters, durations, queue depths, and RPC burn.

### 6.7 Backups & Ops
- [x] **Automated PITR:** Daily WAL backups documented in `docs/ops.md`.
- [x] **Restore Procedure:** Step-by-step restore instructions tested and documented in `docs/ops.md`.

### 6.8 Automated Test Gates
- [x] **Risk Scoring Math:** Verified via `packages/shared/src/risk/__tests__/risk.test.ts`.
- [x] **Billing & Proration:** Verified via `packages/shared/src/billing/__tests__/billing.test.ts`.
- [x] **Zod Boundary Schemas:** Verified via `packages/shared/src/schemas/__tests__/schemas.test.ts`.
- [x] **API Integration Suite:** 15/15 tests passing (`apps/api/test/`).
- [x] **Telegram Bot Suite:** 3/3 tests passing (`apps/bot/test/`).
