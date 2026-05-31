import { eq, desc, asc, and, gte, lte, inArray, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, assets, marketData, technicalIndicators, sectorPerformance,
  marketSentiment, watchlists, watchlistItems, favoriteSectors, savedScans,
  alerts, alertHistory, scannerResults, historicalSnapshots,
  InsertUser, Asset,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const v = user[field];
    if (v !== undefined) { values[field] = v ?? null; updateSet[field] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Assets ───────────────────────────────────────────────────────────────────
export async function getAllAssets(assetType?: string, sector?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(assets.isActive, true)];
  if (assetType) conditions.push(eq(assets.assetType, assetType as any));
  if (sector) conditions.push(eq(assets.sector, sector));
  return db.select().from(assets).where(and(...conditions)).orderBy(asc(assets.symbol));
}

export async function getAssetBySymbol(symbol: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assets).where(eq(assets.symbol, symbol)).limit(1);
  return result[0];
}

export async function searchAssets(query: string) {
  const db = await getDb();
  if (!db) return [];
  // Escape LIKE special characters to prevent pattern injection
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  return db.select().from(assets).where(
    and(
      eq(assets.isActive, true),
      or(like(assets.symbol, `%${escaped}%`), like(assets.name, `%${escaped}%`))
    )
  ).limit(20);
}

export async function getAssetsByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db.select().from(assets).where(inArray(assets.id, ids));
}

// ─── Market Data ──────────────────────────────────────────────────────────────
export async function getOHLCV(assetId: number, timeframe: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketData)
    .where(and(eq(marketData.assetId, assetId), eq(marketData.timeframe, timeframe)))
    .orderBy(desc(marketData.timestamp))
    .limit(limit);
}

export async function getLatestPrice(assetId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(marketData)
    .where(and(eq(marketData.assetId, assetId), eq(marketData.timeframe, "1d")))
    .orderBy(desc(marketData.timestamp))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertMarketData(data: {
  assetId: number; timeframe: string; open: number; high: number;
  low: number; close: number; volume: number; timestamp: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(marketData).values({
    ...data,
    open: String(data.open), high: String(data.high),
    low: String(data.low), close: String(data.close),
  }).onDuplicateKeyUpdate({
    set: {
      open: String(data.open), high: String(data.high),
      low: String(data.low), close: String(data.close),
      volume: data.volume,
    }
  });
}

// ─── Technical Indicators ────────────────────────────────────────────────────
export async function getTechnicalIndicators(assetId: number, timeframe: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(technicalIndicators)
    .where(and(eq(technicalIndicators.assetId, assetId), eq(technicalIndicators.timeframe, timeframe)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertTechnicalIndicators(data: {
  assetId: number; timeframe: string; ema20?: number; ema50?: number; ema200?: number;
  rsi?: number; macd?: number; macdSignal?: number; macdHistogram?: number;
  volumeAvg20?: number; atr?: number; high52w?: number; low52w?: number;
  ath?: number; relativeStrength?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const strData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === "number" ? String(v) : v])
  );
  await db.insert(technicalIndicators).values({ ...strData, timestamp: new Date() } as any)
    .onDuplicateKeyUpdate({ set: { ...strData, updatedAt: new Date() } as any });
}

// ─── Sector Performance ──────────────────────────────────────────────────────
export async function getLatestSectorPerformance(timeframe = "1d") {
  const db = await getDb();
  if (!db) return [];
  const subq = db.select({ sector: sectorPerformance.sector, maxTs: sql<Date>`MAX(${sectorPerformance.timestamp})`.as("maxTs") })
    .from(sectorPerformance).where(eq(sectorPerformance.timeframe, timeframe)).groupBy(sectorPerformance.sector).as("sub");
  return db.select().from(sectorPerformance)
    .innerJoin(subq, and(
      eq(sectorPerformance.sector, subq.sector),
      eq(sectorPerformance.timestamp, subq.maxTs)
    ))
    .where(eq(sectorPerformance.timeframe, timeframe))
    .orderBy(asc(sectorPerformance.rank));
}

export async function getSectorHistory(sector: string, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(sectorPerformance)
    .where(and(eq(sectorPerformance.sector, sector), gte(sectorPerformance.timestamp, since)))
    .orderBy(asc(sectorPerformance.timestamp));
}

export async function upsertSectorPerformance(data: {
  sector: string; timeframe: string; performanceScore: number; momentumScore: number;
  strengthScore: number; volumeScore: number; breakoutFrequency: number;
  inflowOutflow: number; priceChange1d: number; priceChange1w: number;
  priceChange1m: number; rank: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(sectorPerformance).values({
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "number" ? String(v) : v])),
    timestamp: new Date(),
  } as any);
}

// ─── Market Sentiment ────────────────────────────────────────────────────────
export async function getLatestSentiment() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(marketSentiment)
    .orderBy(desc(marketSentiment.timestamp)).limit(1);
  return result[0] ?? null;
}

export async function getSentimentHistory(days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(marketSentiment)
    .where(gte(marketSentiment.timestamp, since))
    .orderBy(asc(marketSentiment.timestamp));
}

export async function insertSentiment(data: {
  sentimentScore: number; marketState: "bullish" | "bearish" | "neutral";
  advanceCount: number; declineCount: number; unchangedCount: number;
  advanceDeclineRatio: number; breadthScore: number; volatilityIndex: number;
  btcDominance: number; totalMarketCap: number; fearGreedIndex: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(marketSentiment).values({
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "number" ? String(v) : v])),
    timestamp: new Date(),
  } as any);
}

// ─── Watchlists ───────────────────────────────────────────────────────────────
export async function getUserWatchlists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlists).where(eq(watchlists.userId, userId)).orderBy(asc(watchlists.createdAt));
}

export async function getWatchlistWithItems(watchlistId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const wl = await db.select().from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId))).limit(1);
  if (!wl[0]) return null;
  const items = await db.select({ item: watchlistItems, asset: assets })
    .from(watchlistItems)
    .innerJoin(assets, eq(watchlistItems.assetId, assets.id))
    .where(eq(watchlistItems.watchlistId, watchlistId));
  return { ...wl[0], items };
}

export async function createWatchlist(userId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(watchlists).values({ userId, name, description });
  return result[0];
}

export async function deleteWatchlist(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(watchlistItems).where(eq(watchlistItems.watchlistId, id));
  await db.delete(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
}

export async function addToWatchlist(watchlistId: number, assetId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(watchlistItems).values({ watchlistId, assetId }).onDuplicateKeyUpdate({ set: { assetId } });
}

export async function removeFromWatchlist(watchlistId: number, assetId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(watchlistItems)
    .where(and(eq(watchlistItems.watchlistId, watchlistId), eq(watchlistItems.assetId, assetId)));
}

// ─── Favorite Sectors ────────────────────────────────────────────────────────
export async function getFavoriteSectors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favoriteSectors).where(eq(favoriteSectors.userId, userId));
}

export async function toggleFavoriteSector(userId: number, sector: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(favoriteSectors)
    .where(and(eq(favoriteSectors.userId, userId), eq(favoriteSectors.sector, sector))).limit(1);
  if (existing[0]) {
    await db.delete(favoriteSectors)
      .where(and(eq(favoriteSectors.userId, userId), eq(favoriteSectors.sector, sector)));
    return false;
  } else {
    await db.insert(favoriteSectors).values({ userId, sector });
    return true;
  }
}

// ─── Saved Scans ─────────────────────────────────────────────────────────────
export async function getSavedScans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedScans).where(eq(savedScans.userId, userId)).orderBy(desc(savedScans.createdAt));
}

export async function createSavedScan(userId: number, name: string, config: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(savedScans).values({ userId, name, config });
}

export async function deleteSavedScan(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(savedScans).where(and(eq(savedScans.id, id), eq(savedScans.userId, userId)));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ alert: alerts, asset: assets })
    .from(alerts)
    .leftJoin(assets, eq(alerts.assetId, assets.id))
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt));
}

export async function createAlert(data: {
  userId: number; assetId?: number; alertType: string; condition?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(alerts).values(data as any);
}

export async function updateAlert(id: number, userId: number, updates: { isActive?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set(updates).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

export async function deleteAlert(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

export async function getUnreadAlertCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(alertHistory)
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, false)));
  return Number(result[0]?.count ?? 0);
}

export async function getAlertHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ history: alertHistory, asset: assets })
    .from(alertHistory)
    .leftJoin(alerts, eq(alertHistory.alertId, alerts.id))
    .leftJoin(assets, eq(alerts.assetId, assets.id))
    .where(eq(alertHistory.userId, userId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit);
}

export async function markAlertsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alertHistory).set({ isRead: true })
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, false)));
}

// ─── Scanner Results ──────────────────────────────────────────────────────────
export async function getRecentScanResults(scanType: string, timeframe: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select({ result: scannerResults, asset: assets })
    .from(scannerResults)
    .innerJoin(assets, eq(scannerResults.assetId, assets.id))
    .where(and(
      eq(scannerResults.scanType, scanType),
      eq(scannerResults.timeframe, timeframe),
      gte(scannerResults.matchedAt, since)
    ))
    .orderBy(desc(scannerResults.score))
    .limit(limit);
}

export async function insertScanResult(data: {
  assetId: number; timeframe: string; scanType: string; score: number; details?: any;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(scannerResults).values({ ...data, score: String(data.score), matchedAt: new Date() } as any);
}

// ─── Historical Snapshots ────────────────────────────────────────────────────
export async function getHistoricalSnapshots(type: string, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(historicalSnapshots)
    .where(and(eq(historicalSnapshots.snapshotType, type as any), gte(historicalSnapshots.timestamp, since)))
    .orderBy(asc(historicalSnapshots.timestamp));
}

export async function insertHistoricalSnapshot(type: string, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(historicalSnapshots).values({ snapshotType: type as any, data, timestamp: new Date() });
}
