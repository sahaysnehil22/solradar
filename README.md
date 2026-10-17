# SolRadar (PulseBoard)

> **Real-Time Solana Memecoin Intelligence Terminal & Telegram Bot**  
> Signals, not custody. Fast risk scoring without trade execution or private keys.

[![Test Suite](https://img.shields.io/badge/tests-passing-emerald?style=flat-square)](TESTING.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Zero Custody](https://img.shields.io/badge/custody-ZERO_PRIVATE_KEYS-green?style=flat-square)](#hard-constraints)

---

## ⚡ Key Highlights & Core Differentiators

1. **100% Non-Custodial Intelligence:** SolRadar never touches private keys or executes transactions. Portfolio tracking and wallet following operate exclusively via public addresses.
2. **Transparent Flat Subscription (No 1% Trade Tax):** Replaces predatory 1% bot trade taxes with a flat $50/mo (Scout) or $100/mo (Hunter) subscription.
3. **Deterministic Mathematical Risk Scoring:** Transparent 0–100 risk scores calculated from on-chain contract state (Mint Authority, Freeze Authority, LP Burn %, Top 10 concentration, and fresh deployer funding).
4. **Guaranteed Exactly-Once Alert Fanout:** Database-level uniqueness `UNIQUE(user_id, alert_id)` in PostgreSQL and deterministic BullMQ job IDs prevent duplicate Telegram alerts.
5. **Dual Web Terminal + Telegram Bot Parity:** Dense desktop terminal (Next.js) and high-speed mobile alert bot (grammY).

---

## 🏛 Architecture & Tech Stack

```
solradar/
├── packages/
│   └── shared/          # Zod schemas, constants, billing provider interfaces, risk model
├── apps/
│   ├── api/             # Fastify/NestJS REST API, Prisma schema, auth, metrics
│   ├── bot/             # grammY Telegram bot with subscription gating
│   └── web/             # Next.js web terminal (Discover, Pulse, Wallets, Portfolio)
├── docs/
│   ├── competitive-analysis.md # Phase 0 clean-room analysis & feature matrix
│   ├── STRIPE_LATER.md         # Exact zero-downtime swap guide for Stripe
│   ├── concurrency.md          # Race-condition safeguards & locking model
│   ├── ops.md                  # Backup PITR and disaster recovery SOP
│   └── launch-checklist.md    # Production hardening verification
├── docker-compose.yml   # Local stack (Postgres, Redis, API, Worker, Web)
├── render.yaml          # Production infrastructure blueprint
└── DEPLOY.md            # Step-by-step deploy agent guide
```

- **Monorepo:** TypeScript, npm workspaces
- **Backend API:** Fastify / Node 22, Zod, bcryptjs, jsonwebtoken, prom-client
- **Database:** PostgreSQL via Prisma ORM (20 indexed tables with migrations)
- **Queues & Caching:** Redis + BullMQ (deterministic job IDs)
- **Telegram Bot:** grammY with 60-second in-memory session caching
- **Frontend Web:** Next.js 15, Vanilla CSS pro dark theme

---

## 🚀 Quick Start (< 15 Minutes)

### 1. Prerequisites
- Node.js &ge; 22.0
- Docker & Docker Compose (or local Postgres + Redis)

### 2. Setup Environment
```bash
cp .env.example .env
```

### 3. Install Dependencies & Build
```bash
npm install --ignore-scripts
npm run build --workspaces
```

### 4. Run Automated Test Suites
```bash
# Shared package tests (risk math, proration, schemas)
npm --prefix packages/shared test

# API integration tests (auth, billing retry storm, screener, wallets)
./node_modules/.bin/vitest run --dir apps/api/test

# Telegram bot tests
./node_modules/.bin/vitest run --dir apps/bot/test
```

### 5. Launch with Docker Compose
```bash
docker compose up -d
```
- Web Terminal: `http://localhost:3000`
- API Health Endpoint: `http://localhost:4000/healthz`
- Prometheus Metrics: `http://localhost:4000/metrics`

---

## 💳 Billing Architecture (Test Mode Notice)

In compliance with project directives:
- No paid Stripe accounts or third-party test keys are used during development.
- `NoopBillingProvider` is active, providing simulated checkouts and instant test activations at zero cost.
- All proration math, plan gating, and referral credit ledgers are fully active and tested.
- To swap to real Stripe later without any core-logic changes, follow [docs/STRIPE_LATER.md](docs/STRIPE_LATER.md).
