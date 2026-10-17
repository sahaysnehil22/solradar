# SolRadar Deployment Guide (`DEPLOY.md`)

> **Target Environments:** Local Docker Compose / Render Blueprint / Production Kubernetes

---

## 1. Services Inventory

| Service Name | Type | Source Directory | Port / Endpoint | Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **solradar-postgres** | Database | `postgres:16-alpine` | `5432` | `pg_isready` |
| **solradar-redis** | Cache/Queue | `redis:7-alpine` | `6379` | `redis-cli ping` |
| **solradar-api** | Web Service | `apps/api` | `4000` | `GET /healthz` |
| **solradar-worker** | Background Worker | `apps/api/dist/worker.js` | N/A (BullMQ Host) | Process Heartbeat |
| **solradar-bot** | Telegram Bot | `apps/bot` | N/A (grammY) | Process Heartbeat |
| **solradar-web** | Next.js Frontend | `apps/web` | `3000` | `GET /` |

---

## 2. Mandatory Deployment Order

### Step 1: Database & Cache Boot
Boot PostgreSQL and Redis. Wait for health checks to report healthy before starting application nodes.
```bash
docker compose up -d postgres redis
```

### Step 2: Database Migration (CRITICAL STEP BEFORE FIRST DEPLOY)
Run Prisma schema migration against the PostgreSQL instance:
```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```
> **IMPORTANT:** Booting the API without applying `prisma migrate deploy` will cause table-not-found errors during queries. Always run this migration step on fresh cluster initialization.

### Step 3: API Web Service
Deploy `apps/api`. Verify `/healthz` and `/readyz` return status `ok` and `ready`.
```bash
docker compose up -d api
curl -f http://localhost:4000/readyz
```

### Step 4: Background Queue Worker & Telegram Bot
Deploy worker and bot services. The worker registers 5 BullMQ queue processors and schedules repeatable cron maintenance tasks with distributed locks:
```bash
docker compose up -d worker bot
```

### Step 5: Web Terminal (Next.js)
Deploy `apps/web` pointing to the live API URL (`NEXT_PUBLIC_API_URL`):
```bash
docker compose up -d web
```

---

## 3. Environment Variables Wire-Up

Verify that `DATABASE_URL` and `REDIS_URL` are wired in your runtime configuration (defined in `.env.example`):
```env
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/solradar?schema=public
REDIS_URL=redis://localhost:6379
```
If either variable is missing in `NODE_ENV=production`, the service fail-fast validator halts boot immediately with a clean fatal error message.

---

## 4. Webhook Configuration Endpoints

- **Helius Solana Webhook URL:**
  `POST https://api.solradar.io/tokens/webhook/helius`
  - Account/Program: Pump.fun (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`), Raydium Liquidity Pool V4 (`675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`)
  - Transaction type: Any
  - Webhook Secret: Match `HELIUS_WEBHOOK_SECRET`

- **Stripe Billing Webhook URL (When Activated):**
  `POST https://api.solradar.io/billing/webhook`
  - Secret: Match `STRIPE_WEBHOOK_SECRET`
