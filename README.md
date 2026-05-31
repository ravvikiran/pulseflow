# PulseFlow — Multi-Market Intelligence Dashboard

PulseFlow is a real-time financial market intelligence platform that provides technical analysis, scanning, and monitoring across three market domains: Indian Stock Market (NSE), Cryptocurrency, and US Equities.

---

## What It Does

- **Multi-market monitoring** — Track 50 NSE stocks, 30 crypto assets, and 25 US stocks from a single dashboard
- **Technical scanning** — EMA alignment, volume spikes, 52-week breakouts, ATH breakouts, momentum continuation, relative strength
- **Chart pattern detection** — 14 pattern types (triangles, flags, head & shoulders, cup & handle, double top/bottom, etc.)
- **Sector rotation analysis** — Rank sectors by momentum, strength, volume, and inflow/outflow
- **Custom watchlists** — Create and manage watchlists across all markets
- **Alert system** — Set alerts for EMA crossovers, volume spikes, breakouts, sector shifts, price targets
- **In-app notifications** — Real-time notification center with 7 categories and severity levels
- **Historical analysis** — Sentiment trends, sector rotation history, scanner result archives
- **User settings** — Full preferences panel (theme, timeframes, alert config, scanner presets)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Wouter, Recharts, Framer Motion |
| UI Components | shadcn/ui (Radix primitives), Lucide icons |
| State/Data | TanStack React Query + tRPC React hooks |
| API Layer | tRPC 11 (type-safe RPC over Express) |
| Server | Express 4, Node.js (ESM) |
| Database | MySQL/TiDB via Drizzle ORM |
| Auth | Manus OAuth (session cookie-based) |
| Build | Vite 7 (client), esbuild (server), pnpm |
| Testing | Vitest |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- MySQL/TiDB database (connection string via `DATABASE_URL` env var)

### Install & Run

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server (client + server on same port)
pnpm dev
```

The app starts at `http://localhost:3000`. If port 3000 is busy, it auto-finds the next available port.

### Build for Production

```bash
pnpm build
pnpm start
```

### Run Tests

```bash
pnpm test
```

---

## Project Structure

```
pulseflow/
├── client/                       # Frontend (React SPA)
│   ├── src/
│   │   ├── App.tsx              # Route definitions
│   │   ├── main.tsx             # tRPC/QueryClient providers
│   │   ├── components/          # Layout, shared components, ui/
│   │   │   ├── PulseFlowLayout.tsx   # Main sidebar layout
│   │   │   ├── NotificationCenter.tsx # Bell + dropdown
│   │   │   ├── shared/          # Reusable widgets (AssetTable, SectorHeatmap, StatCard)
│   │   │   └── ui/             # shadcn/ui primitives (50+ components)
│   │   ├── pages/              # Feature pages
│   │   │   ├── HomeDashboard.tsx     # Global overview
│   │   │   ├── india/          # NSE Dashboard, Sectors, Scanner
│   │   │   ├── crypto/         # Crypto Dashboard, Scanner
│   │   │   ├── us/             # US Dashboard (future-ready)
│   │   │   ├── settings/       # 7-section settings panel
│   │   │   ├── Assets.tsx      # Asset tracker + detail
│   │   │   ├── Watchlists.tsx  # Watchlist management
│   │   │   ├── Alerts.tsx      # Alert rules
│   │   │   ├── Historical.tsx  # Historical analysis
│   │   │   ├── PatternScanner.tsx # Chart pattern scanner
│   │   │   └── Notifications.tsx  # Full notification history
│   │   ├── lib/trpc.ts         # tRPC client binding
│   │   └── contexts/           # ThemeContext
│   └── index.html
├── server/                       # Backend
│   ├── _core/                   # Framework plumbing (auth, OAuth, Vite bridge)
│   ├── routers.ts               # Main tRPC router (all procedures)
│   ├── routers/                 # Sub-routers
│   │   ├── settings.ts         # User preferences & scanner presets
│   │   └── notifications.ts    # Notification CRUD
│   ├── db.ts                    # Database query helpers
│   ├── marketEngine.ts          # Price generation, EMA/RSI, sector performance
│   ├── scannerEngine.ts         # Improved scanner (quality scoring, cooldowns)
│   ├── patternEngine.ts         # 14 chart pattern detectors
│   ├── assetRegistry.ts         # Asset registries (NSE/Crypto/US) + validation
│   └── scheduledJobs.ts         # Cron handlers (market refresh, alerts)
├── drizzle/                      # Database schema (16 tables)
│   └── schema.ts
├── shared/                       # Shared types & constants
└── package.json
```

---

## Routes & Navigation

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | Home Dashboard (global market overview) | No |
| `/india` | NSE Market Dashboard | No |
| `/india/sectors` | Sector Rotation Engine | No |
| `/india/scanner` | NSE Market Scanner | No |
| `/crypto` | Crypto Market Dashboard | No |
| `/crypto/scanner` | Crypto Scanner | No |
| `/us` | US Market Dashboard (future-ready) | No |
| `/assets` | Asset Tracker | No |
| `/assets/:symbol` | Asset Detail (chart + indicators) | No |
| `/patterns` | Chart Pattern Scanner | No |
| `/watchlists` | Watchlist Management | Yes |
| `/alerts` | Alert Rules | Yes |
| `/notifications` | Notification History | Yes |
| `/historical` | Historical Analysis | No |
| `/settings` | User Preferences | Yes |
| `/profile` | User Profile | Yes |

---

## API Structure (tRPC)

All API calls go through `/api/trpc` using tRPC's type-safe RPC protocol.

### Public Procedures (no auth required)
- `global.overview` — Cross-market summary (India, Crypto, US)
- `global.patterns` — Cross-market pattern scanner
- `global.validateRegistry` — Asset registry integrity audit
- `india.dashboard` — NSE dashboard data
- `india.sectorHeatmap` / `india.sectorRotation` / `india.sectorDetail`
- `india.scanner` — NSE scanner (improved accuracy engine)
- `india.patterns` — NSE pattern scanner
- `india.stocks` / `india.indices` / `india.sentimentHistory`
- `crypto.dashboard` — Crypto dashboard data
- `crypto.heatmap` / `crypto.scanner` / `crypto.patterns`
- `crypto.assets` / `crypto.btcDominanceHistory` / `crypto.fearGreedHistory`
- `us.dashboard` / `us.sectorHeatmap` / `us.scanner` / `us.stocks` / `us.indices`
- `assets.search` / `assets.detail` / `assets.ohlcv` / `assets.compare`
- `historical.*` — Sector rotation, sentiment, performance history

### Protected Procedures (auth required)
- `watchlists.*` — CRUD for watchlists and items
- `alerts.*` — CRUD for alerts, unread count, history
- `settings.getPreferences` / `settings.updatePreferences`
- `settings.getScannerPresets` / `settings.createScannerPreset` / etc.
- `notifications.*` — List, mark read, dismiss, seed demo
- `india.favoriteSectors` / `india.savedScans`
- `crypto.savedScans`
- `global.recentAlerts`

---

## Database Schema (16 Tables)

| Table | Purpose |
|-------|---------|
| `users` | OAuth users with role (admin/user) |
| `assets` | Symbol registry (stock/crypto/index) |
| `market_data` | OHLCV candles per asset/timeframe |
| `technical_indicators` | EMA, RSI, MACD, ATR, 52W high/low |
| `sector_performance` | Sector scoring (momentum, strength, volume) |
| `market_sentiment` | Sentiment score, advance/decline, fear/greed |
| `watchlists` | User watchlists |
| `watchlist_items` | Assets in watchlists |
| `favorite_sectors` | User's favorited sectors |
| `saved_scans` | Saved scanner configurations |
| `alerts` | Alert rules |
| `alert_history` | Alert trigger history |
| `scanner_results` | Persisted scanner output |
| `user_preferences` | Full user settings |
| `scanner_presets` | Named scanner parameter presets |
| `notifications` | In-app notification system |
| `historical_snapshots` | Time-series snapshots |

---

## Market Data

PulseFlow currently uses a **simulation engine** for market data. All prices, indicators, and scanner results are generated algorithmically using seeded random functions for deterministic, realistic-looking data.

This design allows the full application to run without external API dependencies. The simulation engine can be replaced with real market data APIs (NSE, Binance, Alpha Vantage, etc.) by swapping the implementations in `marketEngine.ts` and `scannerEngine.ts`.

### Asset Coverage

- **India (NSE):** 50 stocks across 11 sectors (IT, Banking, Pharma, FMCG, Metals, Auto, etc.)
- **Crypto:** 30 assets (BTC, ETH, SOL, Layer 1/2, DeFi, Meme, Gaming, Privacy)
- **US:** 25 stocks (Tech, Finance, Healthcare, Energy, Consumer, Industrial)
- **Indices:** 15 (NIFTY50, SENSEX, S&P 500, NASDAQ 100, etc.)

---

## Background Jobs (Cron Endpoints)

These endpoints are called by the platform's cron scheduler:

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `POST /api/scheduled/market-data-refresh` | Every 15 min | Refresh OHLCV data for all assets |
| `POST /api/scheduled/sector-scoring` | Every 30 min | Recalculate sector performance scores |
| `POST /api/scheduled/sentiment-update` | Every 30 min | Update market sentiment indicators |
| `POST /api/scheduled/scanner-processing` | Every hour | Run all scanner types, persist results |
| `POST /api/scheduled/alert-evaluation` | Every 15 min | Evaluate active alerts, trigger notifications |

All cron endpoints require authentication via the platform SDK.

---

## Scanner Engine

The scanner uses a multi-factor quality scoring system (0-100) with:

- **Volume confirmation** — Current volume vs 20-day average
- **RSI zone validation** — Appropriate RSI range per scan type
- **EMA alignment** — Price position relative to EMA 20/50/200
- **Trend alignment** — Confirming the broader trend direction
- **Cooldown logic** — Prevents signal flooding (15-min cooldown per symbol)
- **Deduplication** — Same signal within cooldown window is skipped

### Scan Types

| Type | Description |
|------|-------------|
| EMA Alignment | Price > EMA20 > EMA50 > EMA200 (bullish stack) |
| Volume Spike | Current volume > Nx 20-day average with price movement |
| 52-Week Breakout | Price breaking above 52-week high with volume |
| ATH Breakout | Price at all-time high with strong volume |
| Momentum Continuation | 3/5 green candles + positive 20-day return + RSI 50-80 |
| Relative Strength | Outperforming benchmark by 5%+ over 63 days |

---

## Pattern Scanner

Detects 14 chart patterns with confidence scoring:

Ascending Triangle, Descending Triangle, Symmetrical Triangle, Bull Flag, Bear Flag, Cup and Handle, Double Top, Double Bottom, Head and Shoulders, Inverse Head and Shoulders, Breakout Consolidation, Support/Resistance Breakout, Channel Breakout, Trendline Breakout

Each pattern result includes: confidence score, volume confirmation, breakout level, stop loss zone, and target level.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth backend URL |
| `PORT` | Server port (default: 3000) |

---

## Scripts

```bash
pnpm dev        # Start dev server (hot reload)
pnpm build      # Build for production
pnpm start      # Run production build
pnpm test       # Run Vitest test suite
pnpm check      # TypeScript type check
pnpm format     # Prettier formatting
pnpm db:push    # Generate + apply DB migrations
```

---

## Future Enhancements

- Real market data API integration (replace simulation with live feeds)
- Email/Telegram alert delivery
- Push notifications for mobile
- Portfolio P&L tracking
- Advanced charting with lightweight-charts library
- News feed integration
- CSV export for watchlists and scanner results
