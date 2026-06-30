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
| API | tRPC 11 (type-safe, end-to-end) over Express 4 |
| Data | Yahoo Finance (`yahoo-finance2` v3) |
| Database | MySQL via Drizzle ORM (optional — works without) |
| Auth | JWT session cookies |
| Build | Vite 7 + esbuild, pnpm |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **pnpm** (required — `npm install -g pnpm`)
- **MySQL** (optional — app works fully without database using live Yahoo data)

### Setup

```bash
# Install dependencies (MUST use pnpm, not npm)
pnpm install

# Create env file (optional)
cp .env.example .env

# Start dev server
pnpm dev
```

Open `http://localhost:3000`. Both frontend and backend run on the same port.

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
├── dataProvider.ts           # Yahoo Finance + fallback logic
├── yahooFinance.ts           # Yahoo API wrapper with caching
├── marketEngine.ts           # Simulated data (fallback)
├── scannerEngine.ts          # Synthetic scanner (for cron jobs)
├── patternEngine.ts          # 14 chart pattern detectors
├── assetRegistry.ts          # 120+ assets (NSE/Crypto/US)
└── scheduledJobs.ts          # Background refresh handlers
drizzle/schema.ts             # 16 database tables
```

---

## Market Data

All price data comes from **Yahoo Finance** (free, no API key needed):

| Market | Delay | Coverage |
|--------|-------|----------|
| NSE India | ~15 min | 50 stocks (NIFTY50 + midcaps) |
| Crypto | ~1-2 min | 30 assets (BTC, ETH, SOL, etc.) |
| US | ~15 min | 25 stocks (FAANG, financials, etc.) |
| Indices | ~15 min | NIFTY50, SENSEX, S&P500, NASDAQ, etc. |

Data is cached for 60 seconds to avoid rate limits. Historical charts show 1 year of daily candles.

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
DATABASE_URL=mysql://user:pass@host:3306/db  # Optional
JWT_SECRET=any-random-string                  # For session auth
PORT=3000                                     # Server port
USE_SIMULATED_DATA=true                       # Force offline mode
CRON_API_KEY=                                 # Protect cron endpoints
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Use `pnpm install` |
| Scanner shows no results | Normal on quiet market days — relaxed gates show 5-15 results typically |
| Yahoo errors for some symbols | Demerged/restructured tickers (e.g., TATAMOTORS) — falls back to simulated |
| Charts not loading | Check browser console — ensure `lightweight-charts` loaded correctly |
| Sector heatmap shows zeros | Sector names must match `assetRegistry.ts` exactly |
