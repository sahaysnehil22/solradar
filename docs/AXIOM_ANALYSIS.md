# Competitive Analysis & Architectural Reference: Axiom.trade
*Clean-Room Competitive & Layout Extraction for SolRadar*

---

## 1. Executive Summary & Clean-Room Boundaries
This document captures structural, informational, and UX architectural patterns analyzed from Axiom (`axiom.trade`) via REA competitive analysis, public platform documentation, and terminal layout references.

### Clean-Room Principles (Strictly Enforced)
- **Conceptual Extraction Only**: Layout structures, component hierarchies, information architecture, data density levels, and interaction patterns are extracted as conceptual benchmarks.
- **Zero Asset / Code Replication**: No CSS, HTML, SVG, JavaScript, brand assets, copy text, or trademarked material from Axiom are reused.
- **Product Differentiation**: Whereas Axiom provides embedded trade execution, wallet creation, and private key storage, **SolRadar is strictly non-custodial and signals-only**. SolRadar never holds private keys, never signs transactions, and routes all execution to external deep-links (Axiom, BullX, Photon, Jupiter) so users trade in their own wallets.

---

## 2. Information Architecture & Shell Structure

```
+--------------------------------------------------------------------------------------------------+
| SolRadar Global Status Strip: Test Mode Active | Solana Mainnet | RPC Budget Health             |
+--------------------------------------------------------------------------------------------------+
| [Logo] SolRadar | Discover | Pulse | Snipe Alerts | Smart Wallets | Portfolio | ... | [User Profile] |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   App Shell Sub-Routes (/app/*):                                                                 |
|   - /app/discover      -> Live Token Screener Table (>=50 tokens, sortable, sparklines)          |
|   - /app/pulse         -> Real-time token launch stream (New / Curve / Migrated)                 |
|   - /app/snipe         -> Non-custodial snipe alert triggers & Telegram delivery                 |
|   - /app/wallets       -> Tracked smart-money wallets & copy-signals feed                        |
|   - /app/portfolio     -> Read-only public address analytics (Spot positions & activity)        |
|   - /app/referrals     -> Working referral discount ledger & shareable links                     |
|   - /app/billing       -> Subscription tier plans (Scout $50 / Hunter $100 - NoopBilling)        |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
| Public Landing (/) -> Marketing landing page (Logo click lands here, never inside /app)          |
| Hidden Admin (/admin) -> 404 for unauthenticated non-admins, removed from all public navigation   |
+--------------------------------------------------------------------------------------------------+
```

### Hierarchy Breakdown
1. **Public Marketing Shell (`/`)**:
   - Clean public conversion page.
   - Live preview strip (backed by read-only real API data, never fake hardcoded rows).
   - Value proposition, feature highlights, and pricing teaser.
   - SolRadar logo links strictly to `/`.
2. **Authenticated App Shell (`/app/*`)**:
   - Gated by authentication (Telegram login primary, Email OTP fallback).
   - High-density, latency-optimized trading terminal layout.
   - Sticky header with quick navigation, connection status, and user account drawer.
3. **Hidden Administration (`/admin`)**:
   - Stripped from all navigation trees.
   - Returns 404 for non-admin sessions.

---

## 3. Discover Screener Table Analysis

Axiom's discover view organizes dozens of live tokens in a tabular interface designed for rapid scanning. SolRadar adapts this into a 100% API-driven screener with the following column hierarchy:

| Column | Content & Format | Behavior & Density |
| :--- | :--- | :--- |
| **Pair / Token** | Token Icon, Symbol (`$BONK`), Name, Age (`4m`, `2h`) | Primary identifier; clicking opens token detail drawer. |
| **Price** | Dynamic price with sub-cent precision (e.g. `$0.000412`) | Tabular numbers; flash green/red on price update. |
| **Market Cap** | Formatted USD (`$1.45M`, `$840K`) | Sortable metric. |
| **Liquidity** | Pool liquidity (`$142K`) with locked/burned % indicator | Filterable threshold (e.g. min $5k). |
| **Volume** | Multi-timeframe volume: 5m / 1h / 24h | Dynamic re-sortable column based on selected timeframe tab. |
| **TXNS / Flow** | Buy/Sell ratio breakdown (`420 B / 310 S`) | Activity velocity gauge. |
| **Token Safety** | Risk Flags: Mint Revoked, Freeze Revoked, LP Burn % | Color-coded badges (green = safe, red = risk). |
| **Holders / Dev** | Top 10 holder % + Dev wallet holding % | Concentration risk bar. |
| **Trend / Sparkline** | Inline 24h/1h mini trendline (SVG polyline) | Visual momentum indicator without full chart load. |
| **Momentum** | Algorithmic Momentum Score (`0-100`) | Proprietary velocity metric. |
| **Risk Score** | SolRadar Deterministic Risk Score (`0-100`) | Score badge (`<30` Safe, `30-70` Moderate, `>70` High Risk). |
| **Actions** | "Copy CA", "Snipe Alert", "Trade" (External Deep-link) | One-tap execution handoff to Jupiter/Axiom/Photon. |

### Filter & Control Bar
- **Timeframe Selector**: Quick toggles: `1m` | `5m` | `30m` | `1h` | `24h` which dynamically sort volume and transaction activity.
- **Safety Toggles**: "Mint Revoked Only", "Freeze Revoked Only", "Max Risk Score" slider.
- **Liquidity Floor**: Preset buttons: `> $5k`, `> $20k`, `> $50k`.
- **Search**: Instant filter by token symbol, name, or Solana mint address.

---

## 4. Pulse Launch Feed Architecture

Unlike standard decentralized exchanges that dump launches into static listings, Axiom separates live launches into lifecycle phases. To prevent user fatigue from multi-column overload, SolRadar implements a **unified, high-velocity stream** with distinct lifecycle stage tags:

1. **Lifecycle Stages**:
   - `NEW` (Genesis / Bonding Curve start on launchpad e.g., Pump.fun).
   - `CURVE` (Bonding Curve progress > 50%).
   - `MIGRATED` (Graduated to Raydium / AMM liquidity pool).
2. **Row Ergonomics**:
   - Micro-row format with reverse-chronological ordering (newest first).
   - Relative creation age badge (`12s ago`, `45s ago`) updated on a second-level ticker.
   - Integrated risk indicator pill immediately visible on launch.
   - Quick-action buttons: Copy Contract Address (CA), Bell icon (add to Snipe Alerts), and External Trade deep-link.
3. **Stream Interactions**:
   - Pause-on-scroll: User scrolling through historical launches pauses auto-scroll to avoid layout jumping.
   - "Live" ping badge with WebSocket / polling fallback heartbeat.
   - Quick filter: "Hide High Risk (> 70)".

---

## 5. Non-Custodial Snipe Alerts Architecture

While Axiom uses an embedded private-key signing engine for snipes, SolRadar operates strictly as a **high-speed intelligence and signaling engine**:

```
+-------------------+      +--------------------+      +--------------------+
|  Helius Webhook   | ---> | SolRadar Queue     | ---> | Alert Evaluator    |
|  New Token Mint   |      | (BullMQ Ingest)    |      | (Risk & Liquidity) |
+-------------------+      +--------------------+      +--------------------+
                                                                 |
                                 +-------------------------------+
                                 |
                                 v
                     +-----------------------+
                     | Instant Delivery:     |
                     | 1. Telegram Alert     |
                     | 2. Web In-App Toast   |
                     | 3. Pre-filled Links:  |
                     |    - Axiom Trade      |
                     |    - BullX            |
                     |    - Photon           |
                     |    - Jupiter          |
                     +-----------------------+
```

### Signal Structure
- **Trigger Conditions**: User specifies launchpad (e.g. Pump.fun, Raydium), minimum initial liquidity, maximum dev holding %, and maximum risk score.
- **Delivery Target**: `< 2s` from block inclusion to Telegram notification.
- **Deep-Link Architecture**: Every alert payload contains direct deep links with the token mint pre-filled:
  - `https://axiom.trade/trade/<mint>`
  - `https://bullx.io/terminal?chainId=1399811149&address=<mint>`
  - `https://photon-sol.tinyastro.io/en/lp/<mint>`
  - `https://jup.ag/swap/SOL-<mint>`
- **Absolute Non-Custody**: No wallet generation, no key input, no signing code in the codebase.

---

## 6. Portfolio Layout Analysis (Axiom-Style, Read-Only)

Axiom's portfolio view organizes spot memecoin assets and derivatives. SolRadar adapts this for **read-only public address monitoring**:

1. **Header Metric Summary**:
   - **Total Portfolio Value ($)** (Aggregated across tracked public addresses).
   - **Unrealized PnL ($ / %)** (Current valuation vs. acquisition baseline).
   - **Tradable SOL Balance** (Liquid SOL balance on tracked addresses).
2. **Navigation Tabs**:
   - `Spot` (Active holdings and tokens).
   - `Wallets` (Tracked public addresses management).
   - `Perpetuals` *(Disabled: "Coming Soon")*.
   - `Predictions` *(Disabled: "Coming Soon")*.
3. **Performance & Statistics**:
   - Net Realized PnL, Total Transaction Count, Win-Rate indicator.
4. **Active Positions Table**:
   - Columns: `Token`, `Bought ($)`, `Sold ($)`, `Remaining Balance`, `Net PnL ($ / %)`, `First Opened`.
5. **Activity Feed**:
   - Live stream of recent swaps, transfers, and burns detected on-chain for tracked addresses.
6. **Zero-Mock Policy**:
   - If no public addresses are connected, the view presents a clean empty state with an address input, never hardcoded demo figures.

---

## 7. Visual Language & Design Tokens

To achieve professional-grade aesthetic density without AI-generated visual cliches:

- **Palette**: Dark matte neutral black (`#0a0a0c` to `#111317`), eliminating glowing cyan gradients and noisy textures.
- **Accent**: Muted purple (`#8b5cf6` / `#7c3aed`), used with disciplined restraint on primary CTAs, active tab underlines, and focus rings.
- **Borders & Radii**: Sharp 4px to 6px radii (`--radius: 4px`), crisp 1px borders (`#1c1f26`).
- **Typography & Numbers**: Clean system sans-serif headers and labels; strictly tabular numeric styling (`font-variant-numeric: tabular-nums`) and monospace (`ui-monospace, SFMono-Regular, Menlo`) for contract addresses, prices, and timestamps.
- **Micro-Interactions**: All transitions bounded under `150ms`. No sluggish spring animations.

---

## 8. Implementation Roadmap Summary
- **Phase 1**: Design tokens & public landing page (`/`).
- **Phase 2**: Telegram authentication flow, session management, and account drawer.
- **Phase 3**: Real-time backend endpoints (`/api/tokens`, `/api/pulse`, `/api/tokens/:mint`) purging all static frontend token arrays.
- **Phase 4**: Production Discover table + Pulse stream with live pagination and pause-on-scroll.
- **Phase 5**: Non-custodial Snipe Alerts engine (rule definitions + Telegram notification delivery).
- **Phase 6**: Smart Wallets tracker + Read-only Axiom-style Portfolio.
- **Phase 7**: Working Referral program, Test-mode Billing, and Hidden Admin.
- **Phase 8**: Performance optimization, zero-key audit, and production build verification.
