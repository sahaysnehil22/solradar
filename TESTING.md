# SolRadar Test Execution & Verification Guide (`TESTING.md`)

> **Automated Test Coverage:** Unit, integration, idempotency retry storms, and critical path flows.

---

## 1. Running the Full Test Suite

To run all automated test suites across packages and applications:

```bash
# Run tests across packages/shared
npm --prefix packages/shared test

# Run tests across apps/api (15 integration & critical path tests)
./node_modules/.bin/vitest run --dir apps/api/test

# Run tests across apps/bot (Telegram bot formatters and gating)
./node_modules/.bin/vitest run --dir apps/bot/test
```

---

## 2. Test Suites Overview

### A. Shared Package (`packages/shared`)
- `risk.test.ts`: Verifies that critical contract flags (Mint Authority Active, Freeze Authority Active, LP Unlocked, Extreme Top 10 Concentration) penalize risk scores deterministically.
- `billing.test.ts`: Verifies test checkout session generation, referral discount math, and upgrade proration calculations.
- `schemas.test.ts`: Tests Zod input boundary validation for Solana wallet addresses, email/password rules, and screener query params.

### B. API Integration Suite (`apps/api/test`)
- `health.test.ts`: Tests `/healthz`, `/readyz`, and Prometheus `/metrics`.
- `auth.test.ts`: Tests signup, login, session issue, and rotating refresh tokens with reuse attack detection and immediate family revocation.
- `billing-idempotency.test.ts`: Simulates concurrent retry storms of identical Stripe webhooks. Confirms duplicate events are dropped and referral credits are applied race-safely via row locks.
- `screener-risk.test.ts`: Ingests real-time Helius webhook payloads and verifies immediate creation of tokens, snapshots, risk reports, and launch alerts.
- `wallets-signals.test.ts`: Tests plan limit gating (Free: 0, Scout: 1, Hunter: 10), signature deduplication on wallet trades, and read-only public portfolio tracking without private keys.

### C. Telegram Bot Suite (`apps/bot/test`)
- `bot.test.ts`: Tests high-risk and low-risk Markdown alert formatters, copy-trade signal generation with PnL track records, and 60-second in-memory session caching.
