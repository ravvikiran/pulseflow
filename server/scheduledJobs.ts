/**
 * PulseFlow Scheduled Job Handlers (HTTP cron endpoints)
 * All jobs use live Yahoo Finance / public-API data. Nothing is generated.
 *  - Market data refresh (every 15 min)
 *  - Sector scoring (every 30 min)
 *  - Market sentiment (every 30 min)
 *  - Scanner results (every hour)
 *  - Alert evaluation (every 15 min)
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb, upsertMarketData, upsertSectorPerformance, insertSentiment, insertScanResult } from "./db";
import { alerts, alertHistory, assets, notifications } from "../drizzle/schema";
import { getCurrentPrices, getRealSectorPerformance, runRealScanner, type Domain } from "./dataProvider";
import { getMarketSentiment } from "./marketAnalytics";
import { evaluateAlert, domainOf, type AlertType } from "./alertEngine";
import { NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY, INDEX_REGISTRY, getSectorsByDomain } from "./assetRegistry";

/** Constant-time string comparison (hash first so lengths always match). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Guard for /api/scheduled/* endpoints.
 * - CRON_API_KEY set: require a matching `x-api-key` header (timing-safe).
 * - CRON_API_KEY unset: allowed outside production (local dev convenience),
 *   refused in production so the endpoints are never accidentally public.
 */
async function authenticateCron(req: Request, res: Response): Promise<boolean> {
  const expected = process.env.CRON_API_KEY;

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "scheduled jobs disabled: CRON_API_KEY not configured" });
      return false;
    }
    return true;
  }

  const header = req.headers["x-api-key"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: "invalid api key" });
    return false;
  }
  return true;
}

/** Log the real error server-side; return a generic message to the caller. */
function jobError(res: Response, job: string, error: unknown) {
  console.error(`[${job}] Error:`, error);
  res.status(500).json({ error: "job failed", timestamp: new Date().toISOString() });
}

// Only one run of each job at a time; a slow Yahoo response must not stack up runs.
const running = new Set<string>();
async function guarded(job: string, req: Request, res: Response, run: () => Promise<Record<string, unknown>>) {
  if (!(await authenticateCron(req, res))) return;
  if (running.has(job)) {
    res.status(409).json({ error: "job already running" });
    return;
  }
  running.add(job);
  try {
    const db = await getDb();
    if (!db) return void res.json({ ok: true, skipped: "no-db" });
    const result = await run();
    res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    jobError(res, job, error);
  } finally {
    running.delete(job);
  }
}

type AssetKind = "stock" | "crypto" | "index";
interface RegistryRow { symbol: string; name: string; sector: string; exchange: string; currency: string; kind: AssetKind }

const REGISTRY_ROWS: RegistryRow[] = [
  ...NSE_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, kind: "stock" as const })),
  ...CRYPTO_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, kind: "crypto" as const })),
  ...US_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, kind: "stock" as const })),
  ...INDEX_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, kind: "index" as const })),
];

/** Make sure every registry symbol has a row in `assets`, then return symbol -> id. */
async function ensureAssetRows(): Promise<Map<string, number>> {
  const db = (await getDb())!;
  const existing = await db.select().from(assets);
  const have = new Map(existing.map(a => [a.symbol, a.id]));
  const missing = REGISTRY_ROWS.filter(r => !have.has(r.symbol));
  for (const r of missing) {
    await db.insert(assets).values({
      symbol: r.symbol, name: r.name, assetType: r.kind, sector: r.sector,
      exchange: r.exchange, currency: r.currency, isActive: true,
    }).onDuplicateKeyUpdate({ set: { isActive: true } });
  }
  if (missing.length === 0) return have;
  const refreshed = await db.select().from(assets);
  return new Map(refreshed.map(a => [a.symbol, a.id]));
}

// ─── Market Data Refresh ─────────────────────────────────────────────────────
export async function handleMarketDataRefresh(req: Request, res: Response) {
  return guarded("MarketDataRefresh", req, res, async () => {
    const ids = await ensureAssetRows();
    const symbols = [...ids.keys()];
    const prices = await getCurrentPrices(symbols);

    let refreshed = 0;
    for (const [symbol, p] of prices) {
      const assetId = ids.get(symbol);
      if (!assetId) continue;
      try {
        await upsertMarketData({
          assetId, timeframe: "1d",
          open: p.open, high: p.high, low: p.low, close: p.price, volume: p.volume,
          timestamp: new Date(),
        });
        refreshed++;
      } catch (error) {
        console.warn(`[MarketDataRefresh] ${symbol}:`, (error as Error).message);
      }
    }
    console.log(`[MarketDataRefresh] Refreshed ${refreshed}/${symbols.length} assets`);
    return { refreshed, total: symbols.length, unavailable: symbols.length - prices.size };
  });
}

// ─── Sector Scoring ──────────────────────────────────────────────────────────
export async function handleSectorScoring(req: Request, res: Response) {
  return guarded("SectorScoring", req, res, async () => {
    let updated = 0;
    for (const domain of ["india", "us"] as const) {
      const sectors = getSectorsByDomain(domain === "india" ? "INDIA" : "US");
      const scored = await getRealSectorPerformance(sectors, domain); // sorted best-first
      for (const [i, s] of scored.entries()) {
        await upsertSectorPerformance({
          sector: s.sector, timeframe: "1d",
          performanceScore: s.performanceScore, momentumScore: s.momentumScore,
          strengthScore: s.strengthScore, volumeScore: s.volumeScore,
          breakoutFrequency: s.breakoutFrequency, inflowOutflow: s.inflowOutflow,
          priceChange1d: s.priceChange1d, priceChange1w: s.priceChange1w, priceChange1m: s.priceChange1m,
          rank: i + 1,
        });
        updated++;
      }
    }
    console.log(`[SectorScoring] Updated ${updated} sectors`);
    return { sectors: updated };
  });
}

// ─── Sentiment Update ────────────────────────────────────────────────────────
export async function handleSentimentUpdate(req: Request, res: Response) {
  return guarded("SentimentUpdate", req, res, async () => {
    const s = await getMarketSentiment("india");
    if (!s) return { skipped: "no-market-data" };
    await insertSentiment({
      sentimentScore: s.sentimentScore, marketState: s.marketState,
      advanceCount: s.advanceCount, declineCount: s.declineCount, unchangedCount: s.unchangedCount,
      advanceDeclineRatio: s.advanceDeclineRatio, breadthScore: s.breadthScore,
      volatilityIndex: s.volatilityIndex,
    });
    console.log(`[SentimentUpdate] India score ${s.sentimentScore} (${s.marketState})`);
    return { sentiment: s.marketState, score: s.sentimentScore };
  });
}

// ─── Scanner Results Processing ──────────────────────────────────────────────
const SCAN_TYPES = ["ema_alignment", "volume_spike", "breakout_52w", "ath_breakout", "momentum_continuation", "relative_strength"];

export async function handleScannerProcessing(req: Request, res: Response) {
  return guarded("ScannerProcessing", req, res, async () => {
    const ids = await ensureAssetRows();
    let inserted = 0;

    for (const domain of ["india", "crypto", "us"] as Domain[]) {
      for (const scanType of SCAN_TYPES) {
        const results = await runRealScanner({ domain, scanType, maxResults: 10 });
        for (const r of results) {
          const assetId = ids.get(r.symbol);
          if (!assetId) continue;
          await insertScanResult({
            assetId, timeframe: "1D", scanType, score: r.qualityScore,
            // `source` marks rows written from live data; the history view only shows these.
            details: { source: "yahoo", confidence: r.confidence, signals: r.signals, stopLoss: r.stopLoss, target: r.target, riskReward: r.riskReward },
          });
          inserted++;
        }
      }
    }
    console.log(`[ScannerProcessing] Inserted ${inserted} scanner results`);
    return { inserted, scanTypes: SCAN_TYPES.length };
  });
}

// ─── Alert Evaluation ────────────────────────────────────────────────────────
const NOTIFICATION_CATEGORY: Record<AlertType, "breakout" | "volume_spike" | "ema_crossover" | "sector_momentum" | "alert_triggered"> = {
  ema_crossover: "ema_crossover",
  volume_spike: "volume_spike",
  breakout_52w: "breakout",
  breakout_ath: "breakout",
  sector_momentum_shift: "sector_momentum",
  trend_reversal: "alert_triggered",
  relative_strength_change: "alert_triggered",
  price_target: "alert_triggered",
};

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function handleAlertEvaluation(req: Request, res: Response) {
  return guarded("AlertEvaluation", req, res, async () => {
    const db = (await getDb())!;
    const rows = await db
      .select({ alert: alerts, symbol: assets.symbol, sector: assets.sector })
      .from(alerts)
      .leftJoin(assets, eq(alerts.assetId, assets.id))
      .where(eq(alerts.isActive, true));

    let triggered = 0;
    let skipped = 0;
    for (const { alert, symbol, sector } of rows) {
      if (alert.lastTriggered && Date.now() - new Date(alert.lastTriggered).getTime() < ALERT_COOLDOWN_MS) {
        skipped++;
        continue;
      }
      try {
        const outcome = await evaluateAlert(alert.alertType, alert.condition, symbol ?? null);
        if (!outcome) { skipped++; continue; }
        if (!outcome.triggered) continue;

        const now = new Date();
        await db.insert(alertHistory).values({
          alertId: alert.id, userId: alert.userId, message: outcome.message,
          value: outcome.value != null ? String(outcome.value) : null,
          isRead: false, triggeredAt: now,
        });
        await db.insert(notifications).values({
          userId: alert.userId,
          category: NOTIFICATION_CATEGORY[alert.alertType],
          severity: "info",
          title: `Alert: ${symbol ?? alert.condition?.sector ?? "Market"}`,
          message: outcome.message,
          symbol: symbol ?? null,
          sector: sector ?? alert.condition?.sector ?? null,
          marketDomain: symbol ? domainOf(symbol) : "global",
          metadata: { alertId: alert.id, alertType: alert.alertType, value: outcome.value },
          isRead: false,
        });
        await db.update(alerts)
          .set({
            triggerCount: (alert.triggerCount ?? 0) + 1,
            lastTriggered: now,
            // A price target is a one-shot alert.
            ...(alert.alertType === "price_target" ? { isActive: false } : {}),
          })
          .where(eq(alerts.id, alert.id));
        triggered++;
      } catch (error) {
        console.warn(`[AlertEvaluation] alert ${alert.id}:`, (error as Error).message);
      }
    }

    console.log(`[AlertEvaluation] Evaluated ${rows.length}, triggered ${triggered}`);
    return { evaluated: rows.length, triggered, skipped };
  });
}
