/**
 * Market-level analytics derived from real Yahoo Finance data:
 * breadth, sentiment, volatility and their histories.
 */

import { getHistory, type HistoryCandle } from "./yahooFinance";
import { getCurrentPrices, mapLimit, type PriceSnapshot } from "./dataProvider";
import { NSE_REGISTRY, US_REGISTRY } from "./assetRegistry";

export type MarketState = "bullish" | "bearish" | "neutral";

export interface MarketSentiment {
  sentimentScore: number; // -100 (all decliners) .. +100 (all advancers)
  marketState: MarketState;
  advanceCount: number;
  declineCount: number;
  unchangedCount: number;
  advanceDeclineRatio: number;
  breadthScore: number; // % of movers that advanced
  volatilityIndex: number | null; // India VIX / CBOE VIX, null if unavailable
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const FLAT_BAND = 0.1; // |change| below this percent counts as unchanged

export function stateFromScore(score: number): MarketState {
  return score > 15 ? "bullish" : score < -15 ? "bearish" : "neutral";
}

/** Breadth-based sentiment from a set of daily percentage changes. */
export function sentimentFromChanges(changes: number[]): Omit<MarketSentiment, "volatilityIndex"> {
  let adv = 0;
  let dec = 0;
  let flat = 0;
  for (const c of changes) {
    if (c > FLAT_BAND) adv++;
    else if (c < -FLAT_BAND) dec++;
    else flat++;
  }
  const movers = adv + dec;
  const score = movers > 0 ? Math.round(((adv - dec) / movers) * 100) : 0;
  return {
    sentimentScore: score,
    marketState: stateFromScore(score),
    advanceCount: adv,
    declineCount: dec,
    unchangedCount: flat,
    advanceDeclineRatio: dec > 0 ? round2(adv / dec) : adv > 0 ? adv : 1,
    breadthScore: movers > 0 ? Math.round((adv / movers) * 100) : 50,
  };
}

async function volatilityIndex(symbol: "INDIAVIX" | "VIX"): Promise<number | null> {
  const prices = await getCurrentPrices([symbol]);
  const v = prices.get(symbol)?.price;
  return v != null ? round2(v) : null;
}

/** Live sentiment for a domain from the registry's constituents. */
export async function getMarketSentiment(
  domain: "india" | "us",
  priceMap?: Map<string, PriceSnapshot>
): Promise<MarketSentiment | null> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  const prices = priceMap ?? (await getCurrentPrices(registry.map(a => a.symbol)));
  const changes = registry.map(a => prices.get(a.symbol)?.changePercent).filter((c): c is number => c != null);
  if (changes.length === 0) return null;
  const vol = await volatilityIndex(domain === "india" ? "INDIAVIX" : "VIX");
  return { ...sentimentFromChanges(changes), volatilityIndex: vol };
}

// ─── Histories ────────────────────────────────────────────────────────────────

const dayKey = (iso: string) => iso.slice(0, 10);

type CloseSeries = Map<string, number>; // YYYY-MM-DD -> close

function toSeries(candles: HistoryCandle[]): CloseSeries {
  return new Map(candles.map(c => [dayKey(c.timestamp), c.close]));
}

function periodForDays(days: number): "3mo" | "6mo" | "1y" | "2y" {
  const calendar = days * 1.5 + 30; // headroom for weekends plus warm-up bars
  if (calendar <= 90) return "3mo";
  if (calendar <= 180) return "6mo";
  if (calendar <= 365) return "1y";
  return "2y";
}

async function loadSeries(symbols: string[], days: number): Promise<Map<string, CloseSeries>> {
  const period = periodForDays(days);
  const out = new Map<string, CloseSeries>();
  await mapLimit(symbols, 6, async symbol => {
    const candles = await getHistory(symbol, period, "1d").catch(() => []);
    if (candles.length > 1) out.set(symbol, toSeries(candles));
  });
  return out;
}

/**
 * Constituents trading within 2% of their 52-week high / low, from real daily
 * candles. Null when no history is available.
 */
export async function getHighLowCounts(
  domain: "india" | "us",
  priceMap: Map<string, PriceSnapshot>
): Promise<{ nearHighs: number; nearLows: number; total: number } | null> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  let nearHighs = 0;
  let nearLows = 0;
  let total = 0;
  await mapLimit<{ symbol: string }, void>(registry, 6, async asset => {
    const quote = priceMap.get(asset.symbol);
    if (!quote) return;
    const candles = await getHistory(asset.symbol, "1y", "1d").catch(() => []);
    if (candles.length < 30) return;
    total++;
    const high = Math.max(...candles.map(c => c.high), quote.price);
    const low = Math.min(...candles.map(c => c.low), quote.price);
    if (quote.price >= high * 0.98) nearHighs++;
    if (quote.price <= low * 1.02) nearLows++;
  });
  return total > 0 ? { nearHighs, nearLows, total } : null;
}

export interface SentimentHistoryPoint {
  timestamp: Date;
  sentimentScore: number;
  marketState: MarketState;
  volatilityIndex: number | null;
  advanceDeclineRatio: number;
}

/**
 * Daily breadth sentiment for the last `days` sessions, rebuilt from each NSE
 * constituent's real daily closes. Volatility is India VIX's real close.
 */
export async function getIndiaSentimentHistory(days: number): Promise<SentimentHistoryPoint[]> {
  const symbols = NSE_REGISTRY.map(a => a.symbol);
  const [series, vix] = await Promise.all([loadSeries(symbols, days), loadSeries(["INDIAVIX"], days)]);
  if (series.size === 0) return [];

  // Trading calendar = union of dates seen across constituents.
  const dates = [...new Set([...series.values()].flatMap(s => [...s.keys()]))].sort();
  const vixSeries = vix.get("INDIAVIX");
  const points: SentimentHistoryPoint[] = [];

  for (let i = 1; i < dates.length; i++) {
    const changes: number[] = [];
    for (const s of series.values()) {
      const today = s.get(dates[i]);
      const prev = s.get(dates[i - 1]);
      if (today != null && prev != null && prev > 0) changes.push(((today - prev) / prev) * 100);
    }
    if (changes.length < Math.max(5, series.size * 0.5)) continue; // partial trading day / holiday
    const sentiment = sentimentFromChanges(changes);
    points.push({
      timestamp: new Date(`${dates[i]}T00:00:00Z`),
      sentimentScore: sentiment.sentimentScore,
      marketState: sentiment.marketState,
      volatilityIndex: vixSeries?.get(dates[i]) != null ? round2(vixSeries.get(dates[i])!) : null,
      advanceDeclineRatio: sentiment.advanceDeclineRatio,
    });
  }
  return points.slice(-days);
}

export interface SectorRotationPoint {
  timestamp: Date;
  data: Array<{ sector: string; rank: number; score: number }>;
}

/**
 * Daily sector ranking for the last `days` sessions. A sector's score is
 * 50 + 8 x its constituents' mean 5-session return (clamped 0-100), using
 * real daily closes. Rank 1 is the strongest sector that day.
 */
export async function getSectorRotationHistory(
  domain: "india" | "us",
  sectors: string[],
  days: number
): Promise<SectorRotationPoint[]> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  const members = registry.filter(a => sectors.includes(a.sector));
  const series = await loadSeries(members.map(m => m.symbol), days + 5);
  if (series.size === 0) return [];

  const dates = [...new Set([...series.values()].flatMap(s => [...s.keys()]))].sort();
  const points: SectorRotationPoint[] = [];

  for (let i = 5; i < dates.length; i++) {
    const rows: Array<{ sector: string; score: number }> = [];
    for (const sector of sectors) {
      const returns: number[] = [];
      for (const m of members.filter(x => x.sector === sector)) {
        const s = series.get(m.symbol);
        const now = s?.get(dates[i]);
        const then = s?.get(dates[i - 5]);
        if (now != null && then != null && then > 0) returns.push(((now - then) / then) * 100);
      }
      if (returns.length === 0) continue;
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      rows.push({ sector, score: round2(Math.min(100, Math.max(0, 50 + avg * 8))) });
    }
    if (rows.length < Math.max(2, Math.floor(sectors.length / 2))) continue;
    rows.sort((a, b) => b.score - a.score);
    points.push({
      timestamp: new Date(`${dates[i]}T00:00:00Z`),
      data: rows.map((r, idx) => ({ ...r, rank: idx + 1 })),
    });
  }
  return points.slice(-days);
}

/** Daily closes for one sector over the last `days` sessions (mean of constituent 1-day changes). */
export async function getSectorDailyHistory(
  domain: "india" | "us",
  sector: string,
  days: number
): Promise<Array<{ timestamp: Date; priceChange1d: number; performanceScore: number }>> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  const members = registry.filter(a => a.sector === sector);
  const series = await loadSeries(members.map(m => m.symbol), days);
  if (series.size === 0) return [];

  const dates = [...new Set([...series.values()].flatMap(s => [...s.keys()]))].sort();
  const out: Array<{ timestamp: Date; priceChange1d: number; performanceScore: number }> = [];
  for (let i = 1; i < dates.length; i++) {
    const changes: number[] = [];
    for (const s of series.values()) {
      const today = s.get(dates[i]);
      const prev = s.get(dates[i - 1]);
      if (today != null && prev != null && prev > 0) changes.push(((today - prev) / prev) * 100);
    }
    if (changes.length === 0) continue;
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    out.push({
      timestamp: new Date(`${dates[i]}T00:00:00Z`),
      priceChange1d: round2(avg),
      performanceScore: round2(Math.min(100, Math.max(0, 50 + avg * 8))),
    });
  }
  return out.slice(-days);
}
