# PulseFlow - Project TODO

> **For a structured requirements document with fulfillment tracking, see [REQUIREMENTS.md](./REQUIREMENTS.md)**
> **For user-facing documentation on how to run the app, see [README.md](./README.md)**

## Phase 1: Foundation & Theme
- [x] Create todo.md
- [x] Design dark institutional theme (CSS variables, typography, colors)
- [x] Set up PulseFlowLayout with sidebar navigation
- [x] Configure App.tsx routes for all pages
- [x] Install charting libraries (recharts)

## Phase 2: Database & Backend
- [x] Design and migrate database schema (14 tables: assets, market_data, technical_indicators, sector_performance, market_sentiment, watchlists, watchlist_items, favorite_sectors, saved_scans, alerts, alert_history, scanner_results, historical_snapshots, users)
- [x] Build market simulation engine (generateCurrentPrice, generateMarketData, generateMarketSentiment, generateSectorPerformance, runScanner, calculateEMA, calculateRSI, calculateMomentumScore, detect* functions)
- [x] Build tRPC router: market (sentiment, breadth, BTC dominance, overview, sentimentHistory)
- [x] Build tRPC router: sectors (list, detail, heatmap, favorites, toggleFavorite)
- [x] Build tRPC router: assets (list, search, detail, ohlcv, compare)
- [x] Build tRPC router: scanner (run, savedScans, saveScan, deleteSavedScan)
- [x] Build tRPC router: watchlists (list, detail, create, delete, addItem, removeItem)
- [x] Build tRPC router: alerts (list, unreadCount, history, create, toggle, delete, markRead)
- [x] Build tRPC router: historical (sectorRotation, sentiment, scannerResults, performance)

## Phase 3: Market Dashboard
- [x] Overall market sentiment score widget with gauge (bullish/bearish/neutral)
- [x] Sector heatmap with color-coded performance
- [x] Top gaining sectors panel
- [x] Top losing sectors panel
- [x] Market breadth indicators (advance/decline ratio, breadth score)
- [x] Volatility Index widget
- [x] BTC Dominance tracking widget
- [x] Fear & Greed Index widget
- [x] Sentiment Trend chart (14-day history)
- [x] Top Gainers / Top Losers (individual assets)
- [x] Auto-refresh every 60 seconds

## Phase 4: Sector Rotation Engine
- [x] Sector ranking table by momentum, relative strength, volume activity, breakout frequency
- [x] Visual sector strength scoring (0-100 with progress bars)
- [x] Sector inflow/outflow behavior visualization (bar chart)
- [x] Sector performance comparison chart
- [x] Sector detail drill-down with history
- [x] Favorite sector toggle (authenticated users)
- [x] Timeframe selector

## Phase 5: Market Scanner Engine
- [x] Scanner filter panel (timeframe, sector, asset type, volume threshold)
- [x] EMA alignment strategy scan
- [x] Volume spike detection scan
- [x] 52-Week High breakout detection scan
- [x] ATH breakout detection scan
- [x] Momentum continuation setups scan
- [x] Relative strength ranking scan
- [x] Scanner results table with scores and indicators
- [x] Save scan configuration feature (authenticated users)
- [x] Load saved scan configurations

## Phase 6: Multi-Asset Tracking
- [x] Asset list with search and filtering (NSE stocks, crypto, indices)
- [x] Asset detail page with candlestick chart (Recharts)
- [x] EMA overlays (EMA 20/50/200) on charts
- [x] Volume profile visualization
- [x] Technical indicators panel (RSI, EMA values, 52W High/Low, ATH, Volume Ratio)
- [x] Relative strength comparison chart (normalized returns)
- [x] EMA alignment status badge (bullish/bearish/mixed)

## Phase 7: Watchlists, Alerts & Historical Analysis
- [x] Custom watchlist creation/deletion
- [x] Add/remove assets from watchlists
- [x] Watchlist items table with live prices
- [x] Alert creation for EMA crossover, volume spike, breakout, sector momentum shift, trend reversal, RS changes, price target
- [x] Alert toggle (active/paused) and deletion
- [x] In-app alert history log with read/unread state
- [x] Mark all alerts as read
- [x] Unread alert count badge in navigation
- [x] Historical sector rotation page
- [x] Historical market sentiment page (90-day chart)
- [x] Historical scanner results page
- [x] Performance tracking over time (normalized returns)

## Phase 8: Background Jobs
- [x] Heartbeat handler: market data refresh (/api/scheduled/market-data-refresh)
- [x] Heartbeat handler: sector scoring (/api/scheduled/sector-scoring)
- [x] Heartbeat handler: sentiment update (/api/scheduled/sentiment-update)
- [x] Heartbeat handler: scanner processing (/api/scheduled/scanner-processing)
- [x] Heartbeat handler: alert evaluation (/api/scheduled/alert-evaluation)
- [x] All handlers mounted in Express before Vite fallthrough
- [x] Cron authentication via sdk.authenticateRequest

## Phase 9: Polish & Delivery
- [x] Responsive design (mobile + desktop)
- [x] Smooth animations and transitions
- [x] Loading states and empty states throughout
- [x] Error handling throughout
- [x] 48 Vitest unit tests passing (market engine + tRPC routers)
- [x] CSS dark theme fixed (no @apply with custom utilities)
- [x] Final checkpoint and delivery

## Future Enhancements
- [ ] Real market data API integration (replace simulation engine with live data)
- [ ] Email alert delivery via SMTP
- [ ] Push notifications for mobile
- [ ] Portfolio P&L tracking
- [ ] Advanced charting with true candlestick library (lightweight-charts)
- [ ] Screener with more technical patterns (head & shoulders, double top/bottom)
- [ ] News feed integration
- [ ] Export watchlist/scan results to CSV

## Refactor: Multi-Market Modular Architecture

### Phase R1: Architecture & Navigation
- [x] Refactor sidebar navigation into multi-market structure (Home, India, Crypto, US, Shared)
- [x] Create /modules directory structure: india-market, crypto-market, us-market, shared, core
- [x] Update App.tsx routing for all new module routes
- [x] Add market-switcher tabs and theme accents per module (India=emerald, Crypto=amber, US=blue)
- [x] Refactor PulseFlowLayout to support market-domain context and active module highlighting

### Phase R2: Shared Component Library
- [x] Create shared/SectorHeatmap.tsx (configurable for any asset set)
- [x] Create shared/AssetTable.tsx (reusable gainers/losers/scanner table)
- [x] Create shared/MiniSparkline.tsx (sparkline chart widget)
- [x] Create shared/StatCard.tsx (reusable stat card component)

### Phase R3: Home Dashboard
- [x] Global market overview with 3 market summary cards (India, Crypto, US)
- [x] Market sentiment summary (one per market domain)
- [x] Quick navigation tiles to each market module
- [x] Global market overview widgets (combined breadth, global indices)
- [x] Recent alerts summary across all markets

### Phase R4: India Market Module
- [x] India Market Dashboard page with NSE-only data
- [x] NSE sector heatmap (India sectors only, no crypto)
- [x] India Top Gainers (NSE stocks only)
- [x] India Top Losers (NSE stocks only)
- [x] India Sector Rotation Engine (NSE sectors only)
- [x] NSE Market Scanner (stocks only)
- [x] FII/DII Activity widget
- [x] India Market Breadth (NSE advance/decline)
- [x] Indian Indices panel (NIFTY50, BANKNIFTY, NIFTY IT, etc.)
- [x] India Market Sentiment widget
- [x] Sector-specific analytics drill-down

### Phase R5: Crypto Market Module
- [x] Crypto Market Dashboard page (crypto-only data)
- [x] Crypto Heatmap (crypto assets only, no NSE stocks)
- [x] BTC Dominance widget
- [x] Altcoin Momentum tracker
- [x] Crypto Top Gainers (crypto only)
- [x] Crypto Top Losers (crypto only)
- [x] Crypto Scanner Engine (crypto only)
- [x] Volume Spike detection (crypto)
- [x] Exchange Activity widget
- [x] Fear & Greed Index widget (crypto-specific)

### Phase R6: US Market Module (Future-Ready Shell)
- [x] US Market Dashboard shell page
- [x] US Indices panel (S&P 500, NASDAQ, DOW)
- [x] US Sector Heatmaps (placeholder)
- [x] US Market Breadth (placeholder)
- [x] US Top Movers (placeholder)
- [x] "Future Ready" state with professional UI
- [x] Backend router isolation: india.*, crypto.*, us.*, global.*

### Phase R7: Shared Watchlists & Alerts Refactor
- [x] Alerts: sector picker grouped by market domain (India NSE / Crypto)
- [x] Asset Tracker: market domain badge on asset detail header
- [x] Historical Analysis: using domain-specific router procedures

### Phase R8: Polish & Tests
- [x] Verify no asset class mixing in any heatmap, scanner, or gainers/losers
- [x] India module theme accent: emerald (#10b981)
- [x] Crypto module theme accent: amber (#f59e0b)
- [x] US module theme accent: blue (#3b82f6)
- [x] Updated vitest tests for new router structure (63 tests passing)
- [x] Final checkpoint saved

## Settings Module

### Phase S1: Backend
- [x] Add user_preferences table to schema (theme, landing page, timezone, currency, market prefs, alert prefs, scanner presets, data prefs)
- [x] Add scanner_presets table (name, config JSON, userId)
- [x] Generate and apply migration SQL
- [x] Build settings tRPC router: getPreferences, updatePreferences, getScannerPresets, createPreset, updatePreset, duplicatePreset, deletePreset

### Phase S2: Settings Shell & Navigation
- [x] Build Settings page with left navigation panel (7 sections)
- [x] Sticky section headers with smooth scroll-to-section
- [x] Responsive layout (sidebar collapses on mobile)
- [x] Settings saved confirmation toast

### Phase S3: General & Market & Data Sections
- [x] General: theme switcher (dark/light/system), default landing page, timezone, currency, language (future-ready)
- [x] Market Preferences: default watchlist, preferred modules, preferred timeframe, scanner refresh interval, heatmap refresh, default chart interval
- [x] Data & Performance: cache settings, auto-refresh toggle, real-time updates toggle, performance mode, data retention

### Phase S4: Alerts & Scanner Sections
- [x] Alerts & Notifications: email/telegram/in-app toggles, volume spike/EMA crossover/breakout/sector momentum toggles, alert sensitivity sliders
- [x] Scanner Configuration: EMA values, volume multiplier, breakout threshold, RS filters, trend strength filters
- [x] Scanner presets: save, edit, duplicate, delete

### Phase S5: Profile & Security Sections
- [x] User Profile: username, email, avatar placeholder, subscription placeholder, API connection status, last sync status
- [x] Security: change password UI, session management, device activity placeholder, 2FA placeholder

### Phase S6: Integration & Polish
- [x] Wire /settings route in App.tsx
- [x] Add Settings link in PulseFlowLayout sidebar
- [x] Write vitest tests for settings router (18 tests)
- [x] All 81 tests passing — final checkpoint saved

## Enhancement Batch 2

### Feature E1: In-App Notification Center
- [ ] Add notifications table to DB schema (userId, category, severity, title, message, assetSymbol, isRead, isDismissed, createdAt)
- [ ] Build notifications tRPC router: list, unreadCount, markRead, markAllRead, dismiss, dismissAll, create
- [ ] Notification bell icon in top navigation with unread count badge
- [ ] Notification dropdown panel (compact cards, time labels, severity colors)
- [ ] Dedicated /notifications page with full history, filter by category/severity
- [ ] Toast popup notifications for new alerts
- [ ] 7 notification categories: EMA crossover, breakout detection, unusual volume, sector momentum shift, trend reversal, watchlist alerts, market sentiment alerts
- [ ] 4 severity levels: bullish, bearish, warning, neutral
- [ ] Dismiss individual notifications
- [ ] Clear all notifications
- [ ] Read/unread state with visual indicator
- [ ] Notifications persist in DB (survive refresh/re-login)

### Feature E2: Chart Pattern Scanning Engine
- [ ] Build patternEngine.ts with 14 pattern detectors: ascending triangle, descending triangle, symmetrical triangle, bull flag, bear flag, cup and handle, double top, double bottom, head and shoulders, inverse head and shoulders, breakout consolidation, support/resistance breakout, channel breakout, trendline breakout
- [ ] Confidence scoring (0-100) per pattern
- [ ] Pattern strength scoring
- [ ] Volume confirmation logic
- [ ] Breakout confirmation logic
- [ ] False breakout filtering
- [ ] Multi-timeframe support (1d, 4h, 1h, 15m)
- [ ] Each result includes: asset, timeframe, pattern type, breakout level, stop loss zone, confidence score
- [ ] Pattern scanner tRPC router: scan, getResults, getByAsset
- [ ] Dedicated /scanner/patterns page (Pattern Scanner page)
- [ ] Pattern results appear in India Scanner and Crypto Scanner pages
- [ ] Pattern alerts auto-create notifications

### Feature E3: Asset Registry & Data Validation
- [ ] Build assetRegistry.ts with separate NSE, Crypto, US registries
- [ ] NSE registry: 50+ real NSE stock symbols with sector, exchange, market cap category
- [ ] Crypto registry: 30+ real crypto pairs with exchange, category (DeFi/Layer1/Layer2/etc.)
- [ ] US registry: 20+ real US stock symbols with sector, exchange
- [ ] Symbol normalization (uppercase, trim, validate format)
- [ ] Duplicate prevention logic
- [ ] Exchange mapping (NSE/BSE for India, Binance/Coinbase for crypto, NYSE/NASDAQ for US)
- [ ] Sector mapping validation
- [ ] Market category tagging (large-cap/mid-cap/small-cap for stocks, L1/L2/DeFi for crypto)
- [ ] Data integrity validation (no cross-contamination between markets)
- [ ] Build dataValidation.ts with validateAsset, validateSector, validateExchange functions
- [ ] Add validation logs to scheduled jobs
- [ ] Sync status monitoring endpoint

### Feature E4: Scanner Accuracy Improvements
- [ ] Improve EMA calculation: use proper exponential smoothing with sufficient lookback (min 2x period)
- [ ] Accurate volume analysis: compare against 20-period average volume
- [ ] Cooldown logic: prevent same signal for same asset within configurable window (default 4h)
- [ ] Signal deduplication: hash-based dedup to prevent identical alerts
- [ ] Quality scoring: combine confidence + volume confirmation + trend alignment
- [ ] False positive filtering: require minimum 3 confirming factors
- [ ] Timeframe-specific calculations (daily vs intraday lookbacks)
- [ ] Historical lookback validation (require minimum candle count)

### Feature E5: Integration & Polish
- [ ] Wire pattern scanner into India Scanner and Crypto Scanner pages as a new tab
- [ ] Wire notifications bell into PulseFlowLayout top bar
- [ ] Update alert evaluation background job to create notifications
- [ ] Update scanner processing background job to use improved accuracy engine
- [ ] Data validation logs accessible in Settings > Data & Performance section
- [ ] Run all tests, fix any failures
- [ ] Final checkpoint

## Enhancement Batch 2 — Phase 6: Wire Everything Together

- [x] Wire `runImprovedScanner` into `india.scanner` and `crypto.scanner` tRPC procedures
- [x] Add `patterns` sub-router with `india.patterns` and `crypto.patterns` procedures
- [x] Build `PatternScanner.tsx` page with confidence scores, pattern types, volume confirmation
- [x] Add `/patterns` route to App.tsx
- [x] Add Pattern Scanner link to PulseFlowLayout sidebar under Intelligence
- [x] Add `global.validateRegistry` procedure calling `runDataValidation()` from assetRegistry.ts
- [x] Write Vitest tests for notifications router, scannerEngine, patternEngine
- [x] Run full test suite — all tests passing
- [x] Save checkpoint
