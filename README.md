# PulseFlow — Multi-Market Intelligence Dashboard

A real-time financial market intelligence platform providing technical analysis, scanning, and monitoring across Indian Stock Market (NSE), Cryptocurrency, and US Equities — powered by live Yahoo Finance data.

---

## Features

- **Live market data** — Real prices via Yahoo Finance (15-min delayed for stocks, near real-time for crypto)
- **Technical scanner** — EMA alignment, volume spikes, 52-week breakouts, momentum, relative strength
- **TradingView charts** — Professional candlestick charts with EMA overlays and volume (lightweight-charts)
- **Sector rotation** — Real sector performance calculated from constituent stock changes
- **14 chart patterns** — Triangles, flags, H&S, cup & handle, double tops/bottoms, breakouts
- **Multi-market** — 50 NSE stocks, 30 crypto, 25 US stocks, 15 indices
- **Watchlists & alerts** — Custom tracking with EMA/volume/breakout alerts
- **Notification center** — 7 categories, severity-based routing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Wouter, lightweight-charts, Recharts |
| UI | shadcn/ui (Radix primitives), Lucide icons, Framer Motion |
| API | tRPC 11 (type-safe, end-to-end) over Express 5 |
| Data | Yahoo Finance (`yahoo-finance2` v4) |
| Database | MySQL via Drizzle ORM (optional — works without) |
| Auth | None (single-user local tool). Do not expose publicly without adding auth |
| Build | Vite 8 (Rolldown) + esbuild, TypeScript 7, Vitest 5, pnpm |

---

## Getting Started

### Prerequisites

- **Node.js 22.12+** (see `.nvmrc`; required by Vite 8, Vitest 5 and yahoo-finance2)
- **pnpm** (required — `npm install -g pnpm`)
- **MySQL** (optional — app works fully without database using live Yahoo data)

### Setup

```bash
# Install dependencies (MUST use pnpm, not npm)
pnpm install

# Start dev server
pnpm dev
```

Open `http://localhost:3000`. All features work immediately — no login required.

### Scripts

```bash
pnpm dev        # Dev server with hot reload
pnpm build      # Production build
pnpm start      # Run production
pnpm test       # Vitest suite
pnpm check      # TypeScript check
pnpm db:push    # Push DB schema (if using MySQL)
```

### Important: Use pnpm

This project **requires pnpm**. Using `npm install` will fail with peer dependency errors.

---

## Project Structure

```
client/src/
├── App.tsx                    # Routes
├── components/
│   ├── PulseFlowLayout.tsx   # Sidebar layout
│   ├── NotificationCenter.tsx
│   └── shared/TradingViewChart.tsx  # Candlestick chart
├── pages/
│   ├── HomeDashboard.tsx     # Global overview
│   ├── india/                # NSE Dashboard, Sectors, Scanner
│   ├── crypto/               # Crypto Dashboard, Scanner
│   ├── us/                   # US Dashboard
│   ├── Assets.tsx            # Asset detail + chart
│   ├── PatternScanner.tsx    # Chart patterns
│   └── settings/             # User preferences
server/
├── _core/                    # Express server, tRPC setup, auth
├── routers.ts                # All tRPC procedures
├── dataProvider.ts           # Real prices/history, sector scores, scanners (no fallbacks)
├── yahooFinance.ts           # Yahoo API wrapper with caching
├── indicators.ts             # EMA, RSI, MACD, ATR (pure math)
├── marketAnalytics.ts        # Breadth, sentiment and history from real closes
├── externalData.ts           # Fear & Greed, CoinGecko, NSE FII/DII
├── alertEngine.ts            # Real alert evaluation
├── patternEngine.ts          # 14 chart pattern detectors
├── assetRegistry.ts          # 120+ assets (NSE/Crypto/US)
└── scheduledJobs.ts          # Background refresh handlers
drizzle/schema.ts             # 16 database tables
```

---

## Data Policy

PulseFlow shows **real data only**. Nothing is generated, simulated or randomised. When a source has no data for a symbol or widget, the symbol is left out or the widget says it is unavailable.

| Data | Source (all free, no API key) |
|------|-------------------------------|
| Prices, history, indices, VIX | Yahoo Finance |
| Crypto Fear & Greed (+ history) | Alternative.me |
| BTC/ETH dominance, total market cap, exchange volume | CoinGecko |
| FII / DII activity (INR crore) | NSE India |

Sentiment, breadth, sector scores and their histories are calculated from the real Yahoo closes. Requests are rate-limited and retried, so first loads can take several seconds.

## Market Data

All price data comes from **Yahoo Finance** (free, no API key needed):

| Market | Delay | Coverage |
|--------|-------|----------|
| NSE India | ~15 min | 50 stocks (NIFTY50 + midcaps) |
| Crypto | ~1-2 min | 30 assets (BTC, ETH, SOL, etc.) |
| US | ~15 min | 25 stocks (FAANG, financials, etc.) |
| Indices | ~15 min | NIFTY50, SENSEX, S&P500, NASDAQ, etc. |

Quotes are cached for 60 seconds. After that they are still served instantly for up to 15 minutes while a fresh copy loads in the background (stale-while-revalidate), so pages never wait on Yahoo after a short idle. Daily history is cached for 30 minutes and pre-loaded at startup. Historical charts show 1 year of daily candles.

---

## Scanner Logic

Uses a **Gate + Scoring** model:

| Scan Type | Gate (must-pass) | Scoring Factors |
|-----------|-----------------|-----------------|
| EMA Alignment | Price > EMA20 > EMA50 | +EMA200, +MACD, +RSI zone, +volume, +fresh crossover |
| Volume Spike | Vol ≥ 2x avg + move > 0.5% | +magnitude, +direction, +trend context |
| 52W Breakout | Within 5% of 52W high | +proximity, +volume, +RSI, +MACD |
| Momentum | 5d return > 1.5% + above EMA20 | +20d return, +MACD, +volume, +EMA50 |
| Relative Strength | 30d return > 3% + above EMA50 | +60d return, +EMA structure, +MACD |

Confidence levels: **High (80+)**, **Medium (60-79)**, **Low (40-59)**

Indicators used: Wilder's RSI(14), MACD(12,26,9), EMA(20/50/200), ATR(14), Volume Ratio

---

## Environment Variables

```bash
DATABASE_URL=mysql://user:pass@host:3306/db  # Optional — for persistence
PORT=3000                                     # Server port (production fails fast if busy)
CRON_API_KEY=                                 # 16+ chars; required for /api/scheduled/* in production
TRUST_PROXY=1                                 # Proxy hops, when behind a reverse proxy
API_RATE_LIMIT_PER_MIN=300                    # Per-IP limit on /api (0 = off)
```

Variables are validated at startup in `server/_core/env.ts`.

---

## Production Notes

- **Health check:** `GET /api/health` returns status and uptime.
- **Security headers:** Helmet with a strict Content-Security-Policy in production, gzip compression, 1 MB body limit, per-IP rate limiting on `/api`.
- **Scheduled jobs:** `POST /api/scheduled/*` requires the `x-api-key` header matching `CRON_API_KEY`. Without a key they run freely in development and are disabled in production.
- **Shutdown:** `SIGTERM`/`SIGINT` drain connections and close the database pool.
- **Caching:** `dist/public/assets/*` is served `immutable`; `index.html`, `sw.js` and `manifest.json` always revalidate.
- **CI:** `.github/workflows/ci.yml` runs typecheck, tests and build.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Use `pnpm install` |
| Scanner shows no results | Normal on quiet market days — relaxed gates show 5-15 results typically |
| Yahoo errors for some tickers | Some delisted/restructured tickers may not have data — app handles gracefully |
| Charts not loading | Refresh the page — lightweight-charts needs a clean mount |
