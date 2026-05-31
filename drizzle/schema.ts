import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  bigint,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  preferences: json("preferences").$type<{
    alertEmail?: boolean;
    alertInApp?: boolean;
    defaultTimeframe?: string;
    defaultSector?: string;
  }>(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  assetType: mysqlEnum("assetType", ["stock", "crypto", "index", "sector_index"]).notNull(),
  sector: varchar("sector", { length: 100 }),
  exchange: varchar("exchange", { length: 50 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_symbol").on(t.symbol),
  index("idx_sector").on(t.sector),
  index("idx_asset_type").on(t.assetType),
]);

export type Asset = typeof assets.$inferSelect;

// ─── Market Data (OHLCV) ─────────────────────────────────────────────────────
export const marketData = mysqlTable("market_data", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull().references(() => assets.id),
  timeframe: varchar("timeframe", { length: 10 }).notNull(), // '1h','4h','1d','1w'
  open: decimal("open", { precision: 20, scale: 8 }),
  high: decimal("high", { precision: 20, scale: 8 }),
  low: decimal("low", { precision: 20, scale: 8 }),
  close: decimal("close", { precision: 20, scale: 8 }),
  volume: bigint("volume", { mode: "number" }),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_asset_time").on(t.assetId, t.timestamp),
  index("idx_timeframe").on(t.timeframe),
  uniqueIndex("idx_unique_ohlcv").on(t.assetId, t.timeframe, t.timestamp),
]);

// ─── Technical Indicators ────────────────────────────────────────────────────
export const technicalIndicators = mysqlTable("technical_indicators", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull().references(() => assets.id),
  timeframe: varchar("timeframe", { length: 10 }).notNull(),
  ema20: decimal("ema20", { precision: 20, scale: 8 }),
  ema50: decimal("ema50", { precision: 20, scale: 8 }),
  ema200: decimal("ema200", { precision: 20, scale: 8 }),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 20, scale: 8 }),
  macdSignal: decimal("macdSignal", { precision: 20, scale: 8 }),
  macdHistogram: decimal("macdHistogram", { precision: 20, scale: 8 }),
  volumeAvg20: bigint("volumeAvg20", { mode: "number" }),
  atr: decimal("atr", { precision: 20, scale: 8 }),
  high52w: decimal("high52w", { precision: 20, scale: 8 }),
  low52w: decimal("low52w", { precision: 20, scale: 8 }),
  ath: decimal("ath", { precision: 20, scale: 8 }),
  relativeStrength: decimal("relativeStrength", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_ti_asset_time").on(t.assetId, t.timestamp),
  uniqueIndex("idx_unique_ti").on(t.assetId, t.timeframe),
]);

// ─── Sector Performance ──────────────────────────────────────────────────────
export const sectorPerformance = mysqlTable("sector_performance", {
  id: int("id").autoincrement().primaryKey(),
  sector: varchar("sector", { length: 100 }).notNull(),
  timeframe: varchar("timeframe", { length: 10 }).notNull(),
  performanceScore: decimal("performanceScore", { precision: 6, scale: 2 }),
  momentumScore: decimal("momentumScore", { precision: 5, scale: 2 }),
  strengthScore: decimal("strengthScore", { precision: 5, scale: 2 }),
  volumeScore: decimal("volumeScore", { precision: 5, scale: 2 }),
  breakoutFrequency: decimal("breakoutFrequency", { precision: 5, scale: 2 }),
  inflowOutflow: decimal("inflowOutflow", { precision: 10, scale: 2 }), // positive = inflow
  priceChange1d: decimal("priceChange1d", { precision: 6, scale: 2 }),
  priceChange1w: decimal("priceChange1w", { precision: 6, scale: 2 }),
  priceChange1m: decimal("priceChange1m", { precision: 6, scale: 2 }),
  rank: int("rank"),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_sector_time").on(t.sector, t.timestamp),
  index("idx_sector_rank").on(t.rank),
]);

// ─── Market Sentiment ────────────────────────────────────────────────────────
export const marketSentiment = mysqlTable("market_sentiment", {
  id: int("id").autoincrement().primaryKey(),
  sentimentScore: decimal("sentimentScore", { precision: 5, scale: 2 }).notNull(), // -100 to 100
  marketState: mysqlEnum("marketState", ["bullish", "bearish", "neutral"]).notNull(),
  advanceCount: int("advanceCount"),
  declineCount: int("declineCount"),
  unchangedCount: int("unchangedCount"),
  advanceDeclineRatio: decimal("advanceDeclineRatio", { precision: 8, scale: 4 }),
  breadthScore: decimal("breadthScore", { precision: 5, scale: 2 }),
  volatilityIndex: decimal("volatilityIndex", { precision: 8, scale: 4 }),
  btcDominance: decimal("btcDominance", { precision: 5, scale: 2 }),
  totalMarketCap: decimal("totalMarketCap", { precision: 20, scale: 2 }),
  fearGreedIndex: decimal("fearGreedIndex", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_sentiment_time").on(t.timestamp),
]);

// ─── Watchlists ───────────────────────────────────────────────────────────────
export const watchlists = mysqlTable("watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_watchlist_user").on(t.userId),
]);

export const watchlistItems = mysqlTable("watchlist_items", {
  id: int("id").autoincrement().primaryKey(),
  watchlistId: int("watchlistId").notNull().references(() => watchlists.id),
  assetId: int("assetId").notNull().references(() => assets.id),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  notes: text("notes"),
}, (t) => [
  uniqueIndex("idx_unique_watchlist_asset").on(t.watchlistId, t.assetId),
]);

// ─── Favorite Sectors ────────────────────────────────────────────────────────
export const favoriteSectors = mysqlTable("favorite_sectors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sector: varchar("sector", { length: 100 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_unique_fav_sector").on(t.userId, t.sector),
]);

// ─── Saved Scans ─────────────────────────────────────────────────────────────
export const savedScans = mysqlTable("saved_scans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  config: json("config").$type<{
    scanType: string;
    timeframe: string;
    sector?: string;
    minVolume?: number;
    emaConfig?: { ema1: number; ema2: number };
    priceMin?: number;
    priceMax?: number;
  }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_saved_scan_user").on(t.userId),
]);

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  assetId: int("assetId").references(() => assets.id),
  alertType: mysqlEnum("alertType", [
    "ema_crossover",
    "volume_spike",
    "breakout_52w",
    "breakout_ath",
    "sector_momentum_shift",
    "trend_reversal",
    "relative_strength_change",
    "price_target",
  ]).notNull(),
  condition: json("condition").$type<{
    threshold?: number;
    direction?: "above" | "below" | "cross";
    ema1?: number;
    ema2?: number;
    sector?: string;
    timeframe?: string;
  }>(),
  isActive: boolean("isActive").default(true).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  lastTriggered: timestamp("lastTriggered"),
  triggerCount: int("triggerCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_alert_user").on(t.userId, t.isActive),
  index("idx_alert_asset").on(t.assetId),
]);

export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull().references(() => alerts.id),
  userId: int("userId").notNull().references(() => users.id),
  message: text("message").notNull(),
  value: decimal("value", { precision: 20, scale: 8 }),
  sentVia: mysqlEnum("sentVia", ["in_app", "email", "telegram"]).default("in_app"),
  isRead: boolean("isRead").default(false).notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
}, (t) => [
  index("idx_ah_user_read").on(t.userId, t.isRead),
  index("idx_ah_alert").on(t.alertId),
]);

// ─── Scanner Results ──────────────────────────────────────────────────────────
export const scannerResults = mysqlTable("scanner_results", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull().references(() => assets.id),
  timeframe: varchar("timeframe", { length: 10 }).notNull(),
  scanType: varchar("scanType", { length: 50 }).notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  details: json("details").$type<{
    ema20?: number;
    ema50?: number;
    ema200?: number;
    volumeRatio?: number;
    rsi?: number;
    priceChange?: number;
    breakoutLevel?: number;
    relativeStrength?: number;
  }>(),
  matchedAt: timestamp("matchedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_scan_type_time").on(t.scanType, t.matchedAt),
  index("idx_scan_asset").on(t.assetId, t.matchedAt),
]);

// ─── User Preferences ───────────────────────────────────────────────────────
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id).unique(),
  // General
  theme: mysqlEnum("theme", ["dark", "light", "system"]).default("dark").notNull(),
  defaultLandingPage: mysqlEnum("defaultLandingPage", ["home", "india", "crypto", "us"]).default("home").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Asia/Kolkata").notNull(),
  currency: varchar("currency", { length: 10 }).default("INR").notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  // Market Preferences
  defaultWatchlistId: int("defaultWatchlistId"),
  preferredModules: json("preferredModules").$type<string[]>().default(["india", "crypto"]),
  preferredTimeframe: varchar("preferredTimeframe", { length: 10 }).default("1d").notNull(),
  scannerRefreshInterval: int("scannerRefreshInterval").default(60).notNull(), // seconds
  heatmapRefreshInterval: int("heatmapRefreshInterval").default(30).notNull(), // seconds
  defaultChartInterval: varchar("defaultChartInterval", { length: 10 }).default("1d").notNull(),
  // Alerts & Notifications
  alertEmail: boolean("alertEmail").default(false).notNull(),
  alertEmailAddress: varchar("alertEmailAddress", { length: 320 }),
  alertTelegram: boolean("alertTelegram").default(false).notNull(),
  alertTelegramHandle: varchar("alertTelegramHandle", { length: 100 }),
  alertInApp: boolean("alertInApp").default(true).notNull(),
  alertVolumeSpike: boolean("alertVolumeSpike").default(true).notNull(),
  alertEmaCrossover: boolean("alertEmaCrossover").default(true).notNull(),
  alertBreakout: boolean("alertBreakout").default(true).notNull(),
  alertSectorMomentum: boolean("alertSectorMomentum").default(true).notNull(),
  alertSensitivity: mysqlEnum("alertSensitivity", ["low", "medium", "high"]).default("medium").notNull(),
  // Data & Performance
  autoRefresh: boolean("autoRefresh").default(true).notNull(),
  realTimeUpdates: boolean("realTimeUpdates").default(true).notNull(),
  performanceMode: boolean("performanceMode").default(false).notNull(),
  dataRetentionDays: int("dataRetentionDays").default(90).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_user_prefs_user").on(t.userId),
]);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// ─── Scanner Presets ─────────────────────────────────────────────────────────
export const scannerPresets = mysqlTable("scanner_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  config: json("config").$type<{
    ema1: number;
    ema2: number;
    ema3: number;
    volumeMultiplier: number;
    breakoutThreshold: number;
    rsMin: number;
    rsMax: number;
    trendStrengthMin: number;
    scanType: string;
    timeframe: string;
    sector?: string;
    assetType?: string;
  }>().notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_preset_user").on(t.userId),
]);

export type ScannerPreset = typeof scannerPresets.$inferSelect;
export type InsertScannerPreset = typeof scannerPresets.$inferInsert;

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  category: mysqlEnum("category", [
    "breakout",
    "volume_spike",
    "ema_crossover",
    "sector_momentum",
    "pattern_detected",
    "system",
    "alert_triggered",
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  symbol: varchar("symbol", { length: 30 }),
  sector: varchar("sector", { length: 100 }),
  marketDomain: mysqlEnum("marketDomain", ["india", "crypto", "us", "global"]).default("global").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_notif_user_read").on(t.userId, t.isRead),
  index("idx_notif_user_time").on(t.userId, t.createdAt),
  index("idx_notif_category").on(t.category),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Historical Snapshots ────────────────────────────────────────────────────
export const historicalSnapshots = mysqlTable("historical_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotType: mysqlEnum("snapshotType", ["sector_rotation", "market_sentiment", "scanner_summary"]).notNull(),
  data: json("data").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_snapshot_type_time").on(t.snapshotType, t.timestamp),
]);
