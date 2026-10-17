# SolRadar Deployment Guide for Ops & Deploy Agent (`DEPLOY.md`)

> **Target Environments:** Local Docker Compose / Render.yaml Blueprint / Vercel (Frontend)

---

## 1. Services Inventory

| Service Name | Type | Source Directory | Port / Endpoint | Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **solradar-postgres** | Database | `postgres:16-alpine` | `5432` | `pg_isready` |
| **solradar-redis** | Cache/Queue | `redis:7-alpine` | `6379` | `redis-cli ping` |
| **solradar-api** | Web Service | `apps/api` | `4000` | `GET /healthz` |
| **solradar-worker** | Background Worker | `apps/api/dist/worker.js` | N/A (Queue Consumer) | Process Heartbeat |
| **solradar-bot** | Telegram Bot | `apps/bot` | N/A (Long Polling/Webhook) | Process Heartbeat |
| **solradar-web** | Next.js Frontend | `apps/web` | `3000` | `GET /` |

---

## 2. Deployment Order

1. **Step 1: Database & Cache**
   Boot PostgreSQL and Redis. Wait for health checks to report healthy.
   ```bash
   docker compose up -d postgres redis
   ```

2. **Step 2: Database Schema & Migrations**
   Run Prisma migrations to instantiate tables:
   ```bash
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```

3. **Step 3: API Web Service**
   Deploy `apps/api`. Verify `/healthz` and `/readyz` return status `ok` and `ready`.
   ```bash
   docker compose up -d api
   curl -f http://localhost:4000/readyz
   ```

4. **Step 4: Background Queue Worker & Telegram Bot**
   Deploy worker and bot services:
   ```bash
   docker compose up -d worker bot
   ```

5. **Step 5: Web Terminal (Next.js)**
   Deploy `apps/web` pointing to the live API URL (`NEXT_PUBLIC_API_URL`):
   ```bash
   docker compose up -d web
   ```

---

## 3. Webhook Configuration Endpoints

- **Helius Solana Webhook URL:**
  `POST https://api.solradar.io/tokens/webhook/helius`
  Configure in Helius Dashboard:
  - Account/Program: Pump.fun (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`), Raydium Liquidity Pool V4 (`675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`)
  - Transaction type: Any
  - Webhook Secret: Match `HELIUS_WEBHOOK_SECRET`

- **Stripe Billing Webhook URL (When Activated):**
  `POST https://api.solradar.io/billing/webhook`
  - Secret: Match `STRIPE_WEBHOOK_SECRET`
