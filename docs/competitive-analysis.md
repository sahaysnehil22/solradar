# PulseBoard: Competitive Analysis & Technical Architecture (Phase 0)

> **Document Version:** 1.0.0  
> **Status:** Completed & Verified  
> **Clean-Room Compliance:** 100% clean-room principles followed. Observed only publicly visible behaviors, official user manuals, public platform documentation, and open developer resources. No competitor code, trademarks, proprietary APIs, or scrapers are used.

---

## 1. Executive Summary & Hard Constraints (§0 Compliance)

**PulseBoard** (working title) is a dedicated Solana memecoin intelligence platform delivering real-time actionable signals and automated risk analysis through a unified **Web Terminal** and **Telegram Bot**. 

### Hard Constraints Verification

1. **NO Trade Execution:** Zero buying, zero selling, zero swaps, and zero transaction signing. No automated execution under any circumstance.
2. **NO Custody & NO Private Keys:** The system never creates, imports, logs, decrypts, or stores private keys or seed phrases. All portfolio and wallet tracking operates exclusively via public addresses in read-only mode.
3. **Signals, Not Actions:** A "snipe alert" or "copy signal" is an informational notification giving token contract address, pool status, liquidity, and risk score. Execution is done manually by the trader in their own preferred wallet or execution client.
4. **100% Real Data & Honest Labeling:** Every numerical metric, price, market cap, and liquidity figure is derived directly from live on-chain RPC/indexer sources (Helius webhooks, DAS, Solana RPC). Any non-production mock in staging/dev is explicitly watermarked **DEMO**.
5. **100% Original Codebase:** Clean-room implementation using modern TypeScript, NestJS, Next.js, grammY, and Prisma.
6. **Subscription-Only Business Model:** Scout ($50/mo) and Hunter ($100/mo) tiers. Zero transaction skimming (no 1% tax per trade like typical execution bots).
7. **Pluggable Billing Provider:** Modular `BillingProvider` interface with `NoopBillingProvider` active during development and testing to ensure zero cost and zero test account dependencies.

---

## 2. Competitive Feature Matrix

This matrix synthesizes public observations across leading Solana trading terminals and intelligence bots: **axiom.trade**, **BONKbot & Telemetry**, **Maestro Bots**, **Photon**, **Trojan**, **Bloom**, and **GMGN.ai**.

| Feature Category | Reference Products | Publicly Documented Behavior | PulseBoard Clean-Room Concept | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **New Launch Feed ("Pulse")** | Axiom, GMGN, Photon | 3-stage progression: *New Pairs* (creation), *Bonding Curve / Final Stretch*, *Migrated* (Raydium pool created). Real-time websocket pushes. | Event-driven pipeline consuming Helius program webhooks (Pump.fun, Raydium, Meteora). Deduplicated streaming feed with stage progression. | **VERIFIED** (Axiom public guides & Photon Memescope) |
| **Discovery Screener** | Axiom, Photon, GMGN, Trojan | High-density data table: Price, Mcap, Liq, 5m/1h/24h Vol, Buys/Sells, Txns, Holder Count, Age, Sparkline. Sortable & filterable. | High-throughput Next.js screener with virtualized table rendering, customizable columns, quick-filter presets, and auto-refresh intervals. | **VERIFIED** (Photon/GMGN column schemas) |
| **Holder Concentration & Clusters** | GMGN.ai, Photon | Top 10 holder percentage (`T10`), dev balance (`DH`), visual concentration bar, and wallet cluster detection (common funding sources). | Normalized Top-10 concentration bar, dedicated Dev holding badge, and cluster detection flag for tokens launched with co-funded snipers. | **VERIFIED** (GMGN holder analysis & audit cards) |
| **Security & Safety Audit** | GMGN.ai, Axiom, Photon | Contract safety audit flags: Mint Authority Disabled, Freeze Authority Disabled, LP Burned/Locked %, Mutable Metadata check. | Token Safety Panel calculating exact binary flags directly from token mint account and liquidity pool vault status. | **VERIFIED** (Solana SPL token standards & DEX audits) |
| **Risk & Momentum Scoring** | GMGN, Photon, Axiom | Algorithmic danger scores or tag badges ("High Risk", "Rug Warning", "Smart Money Inflow"). | Transparent 0–100 Risk Score & Momentum Score with granular diagnostic red flags (unlocked LP, top 10 > 50%, fresh dev, bundled launch). | **VERIFIED** (Platform audit tags) |
| **Telegram Alerts & Alpha** | BONKbot, Maestro, Trojan | Fast Telegram alerts triggered on new launches, volume spikes, whale entries, or alpha channel contract calls. | grammY Telegram bot with deduplicated notifications, Markdown formatting, embedded risk summaries, and deep links to the Web Terminal. | **VERIFIED** (BONKbot alpha & Maestro alerts) |
| **Smart-Wallet & "Copy" Signals** | Maestro, GMGN, Telemetry | Tracking profitable addresses. Maestro supports auto-copy; GMGN surfaces trader PnL, win rate, and recent swaps. | **Read-only Copy Signals:** Immediate alert when a tracked wallet buys/sells. Includes wallet 7d win rate, realized PnL, and rug exposure history. **No automated trades.** | **VERIFIED** (Maestro Copytrade docs; GMGN Smart Money tracker) |
| **Read-Only Portfolio Tracking** | Telemetry, Axiom, GMGN | Aggregate dashboard tracking public addresses, open token balances, cost basis, and unrealized/realized PnL. | Multi-address portfolio tracker via public address only. Periodic snapshot engine computing net asset value and token performance. | **VERIFIED** (Telemetry & GMGN portfolio pages) |
| **Social / Call Channel Monitor** | Maestro, Axiom, GMGN | Listening to Telegram channels or Twitter/X accounts for contract address mentions. | Regex contract parser extracting Solana mints from configured channels, instantly querying risk engine and delivering pre-flight audit. | **VERIFIED** (Maestro Signals documentation) |
| **Limit / Trigger Alerting** | BONKbot, Photon | Alerts or orders triggered at price multipliers, Mcap levels, or trailing percentage drops. | User-configured trigger alerts (e.g. "Notify when Mcap crosses $500k" or "Notify if price drops 20% in 5m"). | **VERIFIED** (BONKbot limit triggers) |
| *Private Key Trading & MEV Bribes* | BONKbot, Maestro, Trojan | Custodial bot wallets, Jito tip configuration, private transaction signing. | **REJECTED BY DESIGN (§0 Hard Constraint).** PulseBoard never touches private keys or executes transactions. | **EXCLUDED** |

---

## 3. The 10 Features Adopted (Original Clean-Room Concepts)

1. **Stage-Progressive Pulse Feed:** Real-time stream categorizing new launches into *New Pair* (genesis), *Bonding Curve Rush* (>50% filled), and *DEX Migrated* (Raydium/Meteora LP pool live).
2. **Dense Trader Screener:** Fast, desktop-optimized tabular view with 5m/1h/24h volume, price change, liquidity-to-market-cap ratio, buyer/seller ratios, and micro-sparklines.
3. **Top-10 Supply Distribution Bar:** Visual tri-color bar displaying Top 10 holders %, Developer holding %, and general circulating supply % with instant warning when Top 10 > 40%.
4. **Deterministic Token Safety Panel:** Direct SPL-token audit showing Mint Authority (Active/Revoked), Freeze Authority (Active/Revoked), and Liquidity Pool Status (% Burned, % Locked, or Unlocked).
5. **Multi-Factor Risk & Momentum Engine:** Dual quantitative scores:
   - *Momentum Score (0–100):* Evaluates transaction velocity, buy-to-sell volume delta, and unique wallet growth.
   - *Risk Score (0–100):* Additive penalty system penalizing unlocked LP, creator holding > 5%, bundled snipers, and high concentration.
6. **Instant Multi-Condition Telegram Alerts:** Telegram push notifications with strict flood control (max 20 msg/min per user) for volume spikes, whale buys (> $X USD), and watchlist triggers.
7. **Smart-Wallet "Signal-Only" Follower:** Real-time notification when tracked high-performing wallets execute a swap, enriched with historical win rate, average hold time, and token risk score.
8. **Public Address Portfolio Aggregator:** Clean portfolio viewer for user-added public addresses, aggregating live SPL token balances, total USD value, and individual token performance without wallet signing.
9. **Social / Channel Contract Address (CA) Ingestor:** Background scanner parsing Solana contract addresses posted in watched Telegram channels or social feeds, appending instant risk ratings.
10. **Granular Per-Token Watchlist with Custom Thresholds:** Watchlist system enabling traders to toggle specific alert triggers (e.g., alert on Whale Buy only, mute new volume, alert on Migration).

---

## 4. The 5 Deliberate Differentiators

1. **Zero-Custody, Zero-Execution Safety Guarantee:** While competing bots like BONKbot, Maestro, and Trojan require users to deposit SOL or hand over private keys (creating severe exploit and drain risks), PulseBoard never touches funds. It is a pure intelligence terminal.
2. **Transparent Flat Subscription (No 1% Trade Tax):** Trading bots quietly extract 1% on every single buy and sell. For an active trader moving $50k/month, that is $500–$1,000 in hidden fees. PulseBoard costs a transparent flat subscription ($50 or $100/mo), saving active traders thousands.
3. **Explainable Risk Auditing (No Black Box):** Rather than giving arbitrary "Good" or "Bad" labels, every risk report provides the mathematical rationale and specific on-chain red flags (e.g. `[FLAG_TOP10_CONCENTRATION: 64% held by 10 wallets]`, `[FLAG_DEV_FRESH_WALLET: funding tx < 2 hours old]`).
4. **Guaranteed Exactly-Once Alert Fanout:** Built with transactional database deduplication `UNIQUE(user_id, event_key)` in Postgres and deterministic BullMQ job IDs, guaranteeing zero duplicate Telegram alerts even during severe chain re-orgs or queue retries.
5. **Unified Terminal + Bot Dual Experience:** Full parity between the high-density desktop web terminal (Next.js) and the Telegram bot (grammY). Alerts received on mobile link directly to the deep-dive token terminal.

---

## 5. Brand Identity & Name Proposals

In compliance with clean-room trademark rules, PulseBoard avoids confusing similarity with existing platforms (Axiom, BONKbot, Maestro, Photon, Trojan).

| Proposal | Brand Name | Rationale & Positioning |
| :---: | :--- | :--- |
| **Option A (Working Title)** | **PulseBoard** | Functional, professional, focuses on the core "Pulse" streaming launch feed and trader dashboard. |
| **Option B (Recommended)** | **SolRadar** | Strong memetic recognition, immediately communicates fast signal detection, scanning, and safety surveillance for Solana. |
| **Option C** | **NovaScope** | Modern, premium aesthetic reminiscent of high-frequency institutional intelligence tools. |
| **Option D** | **VigilSol** | Highlights vigilance, risk prevention, and 24/7 security monitoring against rugs and scams. |

---

## 6. Verification and Substitution Log

- **Axiom Trade Discover & Pulse Workflows:** Verified via public documentation and product guides.
- **BONKbot Alert & Limit Triggers:** Verified via official user manuals and Telegram interface documentation.
- **Maestro Copytrade Sizing & Signals:** Verified via Maestro Mintlify documentation. Auto-buy functionality substituted with **Signal-Only** notification to enforce §0 hard constraints.
- **GMGN.ai & Photon Top-10 / Dev Holding Bar:** Verified via Photon user guides and GMGN column specifications.
- **Yellowstone gRPC Integration:** Flagged as Phase 5 stretch goal; Helius Webhooks + DAS established as MVP primary ingest to maintain cost guardrails.
