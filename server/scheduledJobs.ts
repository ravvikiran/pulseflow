/**
 * PulseFlow Scheduled Job Handlers
 * Heartbeat (HTTP cron) handlers for:
 * - Market data refresh (every 15 min)
 * - Sector scoring recalculation (every 30 min)
 * - Market sentiment update (every 30 min)
 * - Scanner results processing (every hour)
 * - Alert evaluation (every 15 min)
 */
import type { Request, Response } from "express";
import { getDb, upsertMarketData, upsertSectorPerformance, insertSentiment, insertScanResult } from "./db";
import { alerts, alertHistory, assets } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  generateCurrentPrice,
  generateSectorPerformance,
  generateMarketSentiment,
} from "./marketEngine";
import { runImprovedScanner, type ScanType } from "./scannerEngine";

async function authenticateCron(req: Request, res: Response): Promise<boolean> {
  // In production, protect these endpoints with an API key or other mechanism
  // For now, they're accessible directly (suitable for local dev and internal cron)
  const apiKey = req.headers["x-api-key"];
  if (process.env.CRON_API_KEY && apiKey !== process.env.CRON_API_KEY) {
    res.status(403).json({ error: "invalid api key" });
    return false;
  }
  return true;
}

// ─── Market Data Refresh ─────────────────────────────────────────────────────
export async function handleMarketDataRefresh(req: Request, res: Response) {
  const authed = await authenticateCron(req, res);
  if (!authed) return;

  try {
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const allAssets = await db.select().from(assets).limit(200);
    if (!allAssets.length) return res.json({ ok: true, skipped: "no-assets" });

    let refreshed = 0;
    for (const asset of allAssets) {
      try {
        const data = generateCurrentPrice(asset.symbol);
        await upsertMarketData({
          assetId: asset.id,
          timeframe: "1d",
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.price,
          volume: data.volume,
          timestamp: new Date(),
        });
        refreshed++;
      } catch {
        // continue on individual asset failure
      }
    }

    console.log(`[MarketDataRefresh] Refreshed ${refreshed}/${allAssets.length} assets`);
    res.json({ ok: true, refreshed, total: allAssets.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[MarketDataRefresh] Error:", error);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

// ─── Sector Scoring ──────────────────────────────────────────────────────────
export async function handleSectorScoring(req: Request, res: Response) {
  const authed = await authenticateCron(req, res);
  if (!authed) return;

  try {
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const sectors = [
      "Information Technology", "Banking & Finance", "Energy & Oil",
      "Healthcare & Pharma", "Consumer Goods", "Metals & Mining", "Automobile",
      "Real Estate", "Telecom", "FMCG", "Cryptocurrency", "Infrastructure",
    ];

    let updated = 0;
    for (const sector of sectors) {
      try {
        const perf = generateSectorPerformance(sector);
        // Rank is assigned after all sectors are scored
        await upsertSectorPerformance({
          sector: perf.sector,
          timeframe: "1d",
          performanceScore: perf.performanceScore,
          momentumScore: perf.momentumScore,
          strengthScore: perf.strengthScore,
          volumeScore: perf.volumeScore,
          breakoutFrequency: perf.breakoutFrequency,
          inflowOutflow: perf.inflowOutflow,
          priceChange1d: perf.priceChange1d,
          priceChange1w: perf.priceChange1w,
          priceChange1m: perf.priceChange1m,
          rank: updated + 1,
        });
        updated++;
      } catch {
        // continue
      }
    }

    console.log(`[SectorScoring] Updated ${updated} sectors`);
    res.json({ ok: true, sectors: updated, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[SectorScoring] Error:", error);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

// ─── Market Sentiment Update ─────────────────────────────────────────────────
export async function handleSentimentUpdate(req: Request, res: Response) {
  const authed = await authenticateCron(req, res);
  if (!authed) return;

  try {
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const sentiment = generateMarketSentiment();
    await insertSentiment(sentiment);

    console.log(`[SentimentUpdate] Score: ${sentiment.sentimentScore} (${sentiment.marketState})`);
    res.json({ ok: true, sentiment: sentiment.marketState, score: sentiment.sentimentScore, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[SentimentUpdate] Error:", error);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

// ─── Scanner Results Processing ──────────────────────────────────────────────
export async function handleScannerProcessing(req: Request, res: Response) {
  const authed = await authenticateCron(req, res);
  if (!authed) return;

  try {
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const allAssets = await db.select().from(assets).limit(200);
    const scanTypes: ScanType[] = [
      "ema_alignment", "volume_spike", "breakout_52w",
      "ath_breakout", "momentum_continuation", "relative_strength",
    ];
    const domains: ("india" | "crypto" | "us")[] = ["india", "crypto", "us"];

    let totalInserted = 0;
    for (const domain of domains) {
      for (const scanType of scanTypes) {
        const results = runImprovedScanner({
          domain,
          scanType,
          timeframe: "1D",
          minQualityScore: 40,
          maxResults: 10,
          respectCooldown: false,
        });
        for (const result of results) {
          try {
            const assetRow = allAssets.find(a => a.symbol === result.symbol);
            if (!assetRow) continue;
            await insertScanResult({
              assetId: assetRow.id,
              timeframe: "1D",
              scanType,
              score: result.qualityScore,
              details: {
                ...result.details,
                volumeRatio: result.volumeRatio,
                confidence: result.confidence,
                signals: result.signals,
              },
            });
            totalInserted++;
          } catch {
            // continue
          }
        }
      }
    }

    console.log(`[ScannerProcessing] Inserted ${totalInserted} scanner results`);
    res.json({ ok: true, inserted: totalInserted, scanTypes: scanTypes.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[ScannerProcessing] Error:", error);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

// ─── Alert Evaluation ────────────────────────────────────────────────────────
export async function handleAlertEvaluation(req: Request, res: Response) {
  const authed = await authenticateCron(req, res);
  if (!authed) return;

  try {
    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const activeAlerts = await db.select().from(alerts).where(eq(alerts.isActive, true));
    let triggered = 0;

    const messages: Record<string, string> = {
      ema_crossover: "EMA 20 crossed above EMA 50 — bullish signal detected",
      volume_spike: "Unusual volume detected — 3.2x above 20-day average",
      breakout_52w: "Price approaching 52-Week High — breakout imminent",
      breakout_ath: "ATH Breakout detected — price at all-time high",
      sector_momentum_shift: "Sector momentum shifted to bullish — inflows increasing",
      trend_reversal: "Trend reversal detected — price crossed above EMA 200",
      relative_strength_change: "Relative Strength improved significantly vs benchmark",
      price_target: "Price target reached",
    };

    for (const alert of activeAlerts) {
      try {
        // 5% chance per evaluation cycle for demo purposes
        if (Math.random() < 0.05) {
          await db.insert(alertHistory).values({
            alertId: alert.id,
            userId: alert.userId,
            message: messages[alert.alertType] ?? "Alert triggered",
            isRead: false,
            triggeredAt: new Date(),
          });
          await db.update(alerts)
            .set({ triggerCount: (alert.triggerCount ?? 0) + 1, lastTriggered: new Date() })
            .where(eq(alerts.id, alert.id));
          triggered++;
        }
      } catch {
        // continue
      }
    }

    console.log(`[AlertEvaluation] Evaluated ${activeAlerts.length}, triggered ${triggered}`);
    res.json({ ok: true, evaluated: activeAlerts.length, triggered, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[AlertEvaluation] Error:", error);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

