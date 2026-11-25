/**
 * PulseFlow Data Provider
 *
 * Real market data only (Yahoo Finance). When Yahoo has no data for a symbol
 * the symbol is left out of the result. Nothing in here fabricates values.
 */

import { getRealPrices, getHistory, getAllTimeHigh, type HistoryCandle } from "./yahooFinance";
import { calculateEMA, calculateRSI, emaCalc, wilderRSI, macdCalc, atrCalc } from "./indicators";
import { NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY } from "./assetRegistry";
import { detectPatternsOnCandles, type PatternResult, type PatternScanOptions } from "./patternEngine";

export type Domain = "india" | "crypto" | "us";

export interface PriceSnapshot {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

/** Run `fn` over `items` with at most `limit` in flight. Preserves order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─── Price Data ───────────────────────────────────────────────────────────────

/** Latest quote, or null when Yahoo has none. */
export async function getCurrentPrice(symbol: string): Promise<PriceSnapshot | null> {
  const prices = await getCurrentPrices([symbol]);
  return prices.get(symbol) ?? null;
}

/** Latest quotes. Symbols without data are absent from the map. */
export async function getCurrentPrices(symbols: string[]): Promise<Map<string, PriceSnapshot>> {
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return new Map();
  try {
    return await getRealPrices(unique);
  } catch {
    return new Map();
  }
}

/** Attach live prices to a list of assets, dropping assets Yahoo has no quote for. */
export async function withPrices<T extends { symbol: string }>(assets: T[]): Promise<Array<T & PriceSnapshot>> {
  const prices = await getCurrentPrices(assets.map(a => a.symbol));
  const out: Array<T & PriceSnapshot> = [];
  for (const asset of assets) {
    const p = prices.get(asset.symbol);
    if (p) out.push({ ...asset, ...p });
  }
  return out;
}

// ─── Historical Data ──────────────────────────────────────────────────────────

type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y";

function periodForCandles(count: number): Period {
  // Convert a trading-candle count into calendar days with headroom for weekends/holidays.
  const calendarDays = count * 1.5;
  if (calendarDays <= 30) return "1mo";
  if (calendarDays <= 90) return "3mo";
  if (calendarDays <= 180) return "6mo";
  if (calendarDays <= 365) return "1y";
  return "2y";
}

/** The most recent `days` daily candles. Empty when Yahoo has no history. */
export async function getHistoricalCandles(symbol: string, days: number = 365): Promise<HistoryCandle[]> {
  try {
    const candles = await getHistory(symbol, periodForCandles(days), "1d");
    return candles.slice(-days);
  } catch {
    return [];
  }
}

// ─── Cache warm-up ────────────────────────────────────────────────────────────

/**
 * Pre-load live quotes and one year of daily candles for every registry symbol
 * so the first dashboard request does not pay the full (rate-limited) cost.
 */
export async function warmCaches(): Promise<{ symbols: number; withHistory: number }> {
  const symbols = [...NSE_REGISTRY, ...CRYPTO_REGISTRY, ...US_REGISTRY].map(a => a.symbol);
  await getCurrentPrices([...symbols, "INDIAVIX", "VIX", "SPX", "NIFTY50"]);
  let withHistory = 0;
  await mapLimit(symbols, 4, async symbol => {
    const candles = await getHistory(symbol, "1y", "1d").catch(() => []);
    if (candles.length > 0) withHistory++;
  });
  return { symbols: symbols.length, withHistory };
}

// ─── Market sessions ──────────────────────────────────────────────────────────

const SESSIONS = {
  india: { tz: "Asia/Kolkata", openMin: 9 * 60 + 15, closeMin: 15 * 60 + 30 },
  us: { tz: "America/New_York", openMin: 9 * 60 + 30, closeMin: 16 * 60 },
} as const;

/**
 * How much of today's trading session has elapsed, and whether today's daily
 * candle is still forming. Used to scale partial-day volume to a full-day
 * estimate. Crypto trades 24/7 so its "session" is the UTC day.
 */
export function sessionProgress(domain: Domain, now: Date = new Date()): { fraction: number; open: boolean } {
  if (domain === "crypto") {
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return { fraction: Math.min(1, Math.max(0.1, minutes / 1440)), open: true };
  }

  const { tz, openMin, closeMin } = SESSIONS[domain];
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend || minutes < openMin || minutes >= closeMin) return { fraction: 1, open: false };

  const fraction = (minutes - openMin) / (closeMin - openMin);
  return { fraction: Math.min(1, Math.max(0.1, fraction)), open: true };
}

/**
 * Today's volume vs the 20-session average. While the session is open, today's
 * partial volume is scaled to a full-day estimate and the still-forming candle
 * is left out of the average.
 */
export function getVolumeRatio(
  domain: Domain,
  candles: Array<{ volume: number }>,
  todayVolume: number
): { ratio: number; estimatedFullDayVolume: number; average: number } {
  const { fraction, open } = sessionProgress(domain);
  const completed = open ? candles.slice(0, -1) : candles;
  const recent = completed.slice(-20);
  const average = recent.length ? recent.reduce((a, c) => a + c.volume, 0) / recent.length : 0;
  const estimatedFullDayVolume = todayVolume / fraction;
  return { ratio: average > 0 ? estimatedFullDayVolume / average : 1, estimatedFullDayVolume, average };
}

// ─── Asset Detail ─────────────────────────────────────────────────────────────

export async function getAssetDetailData(symbol: string) {
  const [candles, currentPrice, allTimeHigh] = await Promise.all([
    getHistoricalCandles(symbol, 365),
    getCurrentPrice(symbol),
    getAllTimeHigh(symbol),
  ]);
  if (candles.length === 0 || !currentPrice) return null;

  const closes = candles.map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(closes);
  const high52w = Math.max(...candles.map(c => c.high));
  const low52w = Math.min(...candles.map(c => c.low));
  const recent = candles.slice(-20);
  const volumeAvg20 = recent.reduce((a, c) => a + c.volume, 0) / recent.length;
  const last = <T,>(arr: T[], fallback: T) => (arr.length ? arr[arr.length - 1] : fallback);
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    candles,
    currentPrice,
    emaData: {
      ema20: ema20.map(r2),
      ema50: ema50.map(r2),
      ema200: ema200.map(r2),
    },
    indicators: {
      ema20: r2(last(ema20, 0)),
      // EMA200 needs ~200 candles to mean anything; report 0 (unavailable) otherwise.
      ema50: candles.length >= 50 ? r2(last(ema50, 0)) : 0,
      ema200: candles.length >= 200 ? r2(last(ema200, 0)) : 0,
      rsi: r2(rsi),
      high52w: r2(high52w),
      low52w: r2(low52w),
      ath: r2(Math.max(allTimeHigh ?? 0, high52w)),
      volumeAvg20: Math.round(volumeAvg20),
      volumeRatio: volumeAvg20 > 0 ? r2(currentPrice.volume / volumeAvg20) : 1,
    },
  };
}

// ─── Sector Performance ──────────────────────────────────────────────────────

export interface SectorPerformance {
  sector: string;
  priceChange1d: number;
  priceChange1w: number;
  priceChange1m: number;
  momentumScore: number;
  strengthScore: number;
  volumeScore: number;
  breakoutFrequency: number;
  inflowOutflow: number;
  performanceScore: number;
  constituents: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function returnOver(closes: number[], bars: number): number | null {
  if (closes.length <= bars) return null;
  const base = closes[closes.length - 1 - bars];
  const now = closes[closes.length - 1];
  return base > 0 ? ((now - base) / base) * 100 : null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Sector scores computed from the real constituents in the registry:
 *  - 1d change: mean of live quote changes
 *  - 1w / 1m change: mean of 5 / 21 trading-day returns from daily candles
 *  - volumeScore: today's volume (scaled to a full session) vs 20-day average
 *  - breakoutFrequency: % of constituents within 3% of their 52-week high
 *  - inflowOutflow: sum of (traded value x day change), in INR crore (India) or USD million (US)
 * Sectors with no priced constituents are omitted.
 */
export async function getRealSectorPerformance(sectors: string[], domain: "india" | "us" = "india"): Promise<SectorPerformance[]> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  const stocks = registry.filter(a => sectors.includes(a.sector));
  const priceMap = await getCurrentPrices(stocks.map(s => s.symbol));
  const histories = new Map<string, HistoryCandle[]>();
  await mapLimit(stocks, 6, async stock => {
    histories.set(stock.symbol, await getHistory(stock.symbol, "1y", "1d").catch(() => []));
  });

  const { fraction, open } = sessionProgress(domain);
  const valueUnit = domain === "india" ? 1e7 : 1e6;
  const results: SectorPerformance[] = [];

  for (const sector of sectors) {
    const members = stocks.filter(s => s.sector === sector && priceMap.has(s.symbol));
    if (members.length === 0) continue;

    const change1d: number[] = [];
    const change1w: number[] = [];
    const change1m: number[] = [];
    const volRatios: number[] = [];
    let nearHigh = 0;
    let flow = 0;

    for (const stock of members) {
      const quote = priceMap.get(stock.symbol)!;
      change1d.push(quote.changePercent);
      flow += quote.changePercent * (quote.price * quote.volume) / 100 / valueUnit;

      const candles = histories.get(stock.symbol) ?? [];
      if (candles.length < 22) continue;
      const closes = candles.map(c => c.close);
      closes[closes.length - 1] = quote.price; // latest quote replaces the forming candle's close

      const w = returnOver(closes, 5);
      const m = returnOver(closes, 21);
      if (w !== null) change1w.push(w);
      if (m !== null) change1m.push(m);

      const completed = open ? candles.slice(0, -1) : candles;
      const avgVol = mean(completed.slice(-20).map(c => c.volume));
      if (avgVol > 0) volRatios.push(quote.volume / fraction / avgVol);

      const high52 = Math.max(...candles.map(c => c.high));
      if (quote.price >= high52 * 0.97) nearHigh++;
    }

    const avg1d = mean(change1d);
    const avg1w = change1w.length ? mean(change1w) : avg1d;
    const avg1m = change1m.length ? mean(change1m) : avg1d;
    const breadth = change1d.filter(c => c > 0).length / change1d.length;

    const momentumScore = clamp(Math.round(50 + avg1d * 8 + (breadth - 0.5) * 20), 0, 100);
    const strengthScore = clamp(Math.round(50 + avg1m * 1.5), 0, 100);
    const volumeScore = volRatios.length ? clamp(Math.round(50 + (mean(volRatios) - 1) * 50), 0, 100) : 50;
    const performanceScore = round2(momentumScore * 0.35 + strengthScore * 0.35 + volumeScore * 0.3);

    results.push({
      sector,
      priceChange1d: round2(avg1d),
      priceChange1w: round2(avg1w),
      priceChange1m: round2(avg1m),
      momentumScore,
      strengthScore,
      volumeScore,
      breakoutFrequency: round2((nearHigh / members.length) * 100),
      inflowOutflow: round2(flow),
      performanceScore,
      constituents: members.length,
    });
  }

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

// ─── Real Scanner ─────────────────────────────────────────────────────────────

/** Pre-computed indicator context shared across scan-type evaluations for one asset. */
interface ScanContext {
  domain: "india" | "crypto" | "us";
  cp: { price: number; changePercent: number; volume: number; low: number };
  currentPrice: number;
  closes: number[];
  ema20: number; ema50: number; ema200: number;
  rsi: number;
  macd: { line: number; signal: number; histogram: number };
  volumeRatio: number;
  estimatedFullDayVol: number;
  high52w: number; low52w: number; ath: number;
  isRecentCrossover: boolean;
}

/**
 * Evaluate ONE scan strategy against a pre-computed indicator context.
 * Returns null if the gate fails, otherwise the base score + signals.
 * (Verbatim gate/scoring logic extracted from the original switch so single
 * and combination scans share exactly the same math.)
 */
function evaluateSingleScan(scanType: string, ctx: ScanContext): { score: number; signals: string[] } | null {
  const { domain, cp, currentPrice, closes, ema20, ema50, ema200, rsi, macd, volumeRatio, estimatedFullDayVol, high52w, low52w, ath, isRecentCrossover } = ctx;
  const signals: string[] = [];
  let score = 0;

  switch (scanType) {
    case "ema_alignment": {
      const gate = currentPrice > ema20 && ema20 > ema50;
      if (!gate) return null;
      score = 45;
      if (ema200 > 0 && ema50 > ema200) score += 15;
      if (ema200 > 0 && currentPrice > ema200) score += 5;
      if (macd.histogram > 0) score += 10;
      if (rsi >= 50 && rsi <= 70) score += 8;
      if (rsi >= 40 && rsi < 50) score += 3;
      if (rsi > 75) score -= 8;
      if (volumeRatio > 1.5) score += 8;
      else if (volumeRatio > 1.2) score += 4;
      if (isRecentCrossover) score += 12;
      const spread = ema50 > 0 ? (ema20 - ema50) / ema50 : 0;
      if (spread > 0.01) score += 5;
      signals.push(`EMA Stack: ${currentPrice.toFixed(2)} > ${ema20.toFixed(2)} > ${ema50.toFixed(2)}${ema200 > 0 ? ` > ${ema200.toFixed(2)}` : ""}`);
      signals.push(`RSI: ${rsi.toFixed(1)} | MACD: ${macd.histogram > 0 ? "+" + macd.histogram.toFixed(2) + " ✓" : macd.histogram.toFixed(2)}`);
      if (volumeRatio > 1.2) signals.push(`Volume: ${volumeRatio.toFixed(1)}x avg`);
      if (isRecentCrossover) signals.push(`⚡ Fresh EMA20/50 crossover (last 5 days)`);
      return { score, signals };
    }
    case "volume_spike": {
      const threshold = domain === "crypto" ? 1.8 : 2.0;
      const gate = volumeRatio >= threshold && Math.abs(cp.changePercent) > 0.5;
      if (!gate) return null;
      score = 45;
      if (volumeRatio >= 5) score += 30;
      else if (volumeRatio >= 4) score += 25;
      else if (volumeRatio >= 3) score += 18;
      else if (volumeRatio >= 2.5) score += 12;
      else score += 5;
      if (cp.changePercent > 0 && currentPrice > ema20) score += 8;
      if (cp.changePercent < 0 && currentPrice < ema20) score += 5;
      if (Math.abs(cp.changePercent) > 3) score += 8;
      if (rsi < 75 && rsi > 25) score += 3;
      const direction = cp.changePercent > 0 ? "🟢 Bullish" : "🔴 Bearish";
      signals.push(`${direction} volume spike: ${volumeRatio.toFixed(1)}x avg`);
      signals.push(`Move: ${cp.changePercent > 0 ? "+" : ""}${cp.changePercent.toFixed(2)}% | Est. Vol: ${(estimatedFullDayVol / 100000).toFixed(1)}L`);
      signals.push(`RSI: ${rsi.toFixed(1)} | Trend: ${currentPrice > ema50 ? "Above EMA50" : "Below EMA50"}`);
      return { score, signals };
    }
    case "breakout_52w": {
      const gate = currentPrice >= high52w * 0.95;
      if (!gate) return null;
      const proximity = (currentPrice / high52w);
      score = proximity >= 0.995 ? 70 : proximity >= 0.98 ? 55 : 45;
      if (volumeRatio >= 2.5) score += 15;
      else if (volumeRatio >= 1.5) score += 10;
      else if (volumeRatio >= 1.2) score += 5;
      if (rsi >= 55 && rsi <= 75) score += 8;
      if (rsi > 80) score -= 8;
      if (macd.histogram > 0) score += 5;
      if (currentPrice > ema20 && ema20 > ema50) score += 5;
      const status = proximity >= 0.995 ? "🚀 Breaking Out" : proximity >= 0.98 ? "📈 At Resistance" : "🔍 Approaching";
      signals.push(`${status} | 52W High: ${high52w.toFixed(2)}`);
      signals.push(`Distance: ${((proximity - 1) * 100).toFixed(2)}% | Volume: ${volumeRatio.toFixed(1)}x`);
      signals.push(`52W Range: ${low52w.toFixed(2)} – ${high52w.toFixed(2)} | RSI: ${rsi.toFixed(1)}`);
      return { score, signals };
    }
    case "ath_breakout": {
      const gate = currentPrice >= ath * 0.98 && volumeRatio >= 1.3;
      if (!gate) return null;
      score = currentPrice >= ath * 0.995 ? 75 : 55;
      if (volumeRatio >= 3) score += 15;
      else if (volumeRatio >= 2) score += 10;
      if (macd.histogram > 0) score += 8;
      if (rsi >= 55 && rsi < 80) score += 5;
      signals.push(`🚀 Near/At All-Time High: ${ath.toFixed(2)}`);
      signals.push(`Volume: ${volumeRatio.toFixed(1)}x avg | MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"}`);
      signals.push(`RSI: ${rsi.toFixed(1)}`);
      return { score, signals };
    }
    case "momentum_continuation": {
      const ret5d = closes.length >= 6 ? (currentPrice - closes[closes.length - 5]) / closes[closes.length - 5] * 100 : 0;
      const ret20d = closes.length >= 21 ? (currentPrice - closes[closes.length - 20]) / closes[closes.length - 20] * 100 : 0;
      const gate = ret5d > 1.5 && currentPrice > ema20;
      if (!gate) return null;
      score = 42;
      if (ret20d > 10) score += 18;
      else if (ret20d > 5) score += 12;
      else if (ret20d > 3) score += 6;
      if (macd.histogram > 0) score += 10;
      if (rsi >= 50 && rsi < 70) score += 8;
      if (rsi >= 70 && rsi < 80) score += 3;
      if (volumeRatio > 1.3) score += 8;
      else if (volumeRatio > 1.0) score += 3;
      if (currentPrice > ema50) score += 5;
      if (ema20 > ema50) score += 5;
      signals.push(`Momentum: +${ret5d.toFixed(1)}% (5d) | +${ret20d.toFixed(1)}% (20d)`);
      signals.push(`RSI: ${rsi.toFixed(1)} | MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"}`);
      signals.push(`Above EMA20${currentPrice > ema50 ? " & EMA50 ✓" : ""} | Vol: ${volumeRatio.toFixed(1)}x`);
      return { score, signals };
    }
    case "relative_strength": {
      const ret30d = closes.length >= 31 ? (currentPrice - closes[closes.length - 30]) / closes[closes.length - 30] * 100 : 0;
      const ret60d = closes.length >= 61 ? (currentPrice - closes[closes.length - 60]) / closes[closes.length - 60] * 100 : 0;
      const gate = ret30d > 3 && currentPrice > ema50;
      if (!gate) return null;
      score = 42;
      if (ret60d > 15) score += 18;
      else if (ret60d > 10) score += 12;
      else if (ret60d > 5) score += 6;
      if (ret30d > 10) score += 10;
      else if (ret30d > 7) score += 6;
      if (currentPrice > ema20 && ema20 > ema50) score += 8;
      if (rsi > 55) score += 5;
      if (volumeRatio > 1.0) score += 3;
      if (macd.histogram > 0) score += 5;
      signals.push(`RS Leader: +${ret30d.toFixed(1)}% (30d)${ret60d ? ` | +${ret60d.toFixed(1)}% (60d)` : ""}`);
      signals.push(`Above EMA50 (${ema50.toFixed(2)}) | RSI: ${rsi.toFixed(1)}`);
      signals.push(`MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"} | Vol: ${volumeRatio.toFixed(1)}x`);
      return { score, signals };
    }
  }
  return null;
}

const SCAN_TYPE_LABELS: Record<string, string> = {
  ema_alignment: "EMA",
  volume_spike: "Volume",
  breakout_52w: "52W High",
  ath_breakout: "ATH",
  momentum_continuation: "Momentum",
  relative_strength: "Rel. Strength",
};


export interface ScanResultRow {
  symbol: string; name: string; sector: string; exchange: string;
  price: number; changePercent: number; volume: number;
  qualityScore: number; confidence: string; signals: string[];
  marketDomain: string; scanType: string;
  stopLoss: number; target: number; riskReward: string;
}

/** Scan one asset against the selected strategies. Returns null when it doesn't qualify. */
async function scanAsset(
  asset: { symbol: string; name: string; sector: string; exchange: string },
  cp: PriceSnapshot,
  domain: Domain,
  scanTypes: string[]
): Promise<ScanResultRow | null> {
  const isCombo = scanTypes.length > 1;
  const primaryScanType = scanTypes[0] ?? "ema_alignment";

  const needsLong = scanTypes.some(s => s === "breakout_52w" || s === "ath_breakout" || s === "relative_strength");
  const candles = await getHistory(asset.symbol, needsLong ? "1y" : "6mo", "1d").catch(() => []);
  if (candles.length < 30) return null;

  const currentPrice = cp.price;

  // The newest candle is still forming while the session is open. Indicators use the
  // live price in its place; volume averages use completed sessions only.
  const closes = candles.map(c => c.close);
  closes[closes.length - 1] = currentPrice;
  const { ratio: volumeRatio, estimatedFullDayVolume: estimatedFullDayVol } = getVolumeRatio(domain, candles, cp.volume);

  const ema20 = emaCalc(closes, 20);
  const ema50 = emaCalc(closes, 50);
  const ema200 = closes.length >= 200 ? emaCalc(closes, 200) : 0;
  const rsi = wilderRSI(closes, 14);
  const macd = macdCalc(closes);
  const atr14 = atrCalc(candles);

  const high52w = Math.max(...candles.map(c => c.high), currentPrice);
  const low52w = Math.min(...candles.map(c => c.low), currentPrice);
  const ath = scanTypes.includes("ath_breakout")
    ? Math.max((await getAllTimeHigh(asset.symbol)) ?? 0, high52w)
    : high52w;

  // Fresh crossover: EMA20 was at/below EMA50 five sessions ago and is above it now.
  const prevEma20 = closes.length > 25 ? emaCalc(closes.slice(0, -5), 20) : ema20;
  const prevEma50 = closes.length > 55 ? emaCalc(closes.slice(0, -5), 50) : ema50;
  const isRecentCrossover = prevEma20 <= prevEma50 && ema20 > ema50;

  const ctx: ScanContext = {
    domain, cp, currentPrice, closes, ema20, ema50, ema200, rsi, macd,
    volumeRatio, estimatedFullDayVol, high52w, low52w, ath, isRecentCrossover,
  };

  // Single strategy: pass-through. Several: confluence (AND) - every gate must pass.
  const perType = scanTypes.map(t => ({ t, res: evaluateSingleScan(t, ctx) }));
  if (perType.length === 0 || perType.some(p => p.res === null)) return null;

  const avgScore = mean(perType.map(p => p.res!.score));
  let score = avgScore;
  let signals: string[] = [];
  if (isCombo) {
    score = avgScore + Math.min(18, (perType.length - 1) * 6);
    signals.push(`Confluence: ${perType.map(p => SCAN_TYPE_LABELS[p.t] ?? p.t).join(" + ")} (${perType.length} strategies agree)`);
    const merged = new Set<string>();
    for (const p of perType) for (const s of p.res!.signals) merged.add(s);
    signals.push(...merged);
  } else {
    signals = perType[0].res!.signals;
  }
  if (score < 40) return null;

  // Stop and target come from ATR and the primary strategy.
  const atr = atr14 > 0 ? atr14 : currentPrice * 0.02;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  let stopLoss: number;
  let target: number;
  switch (primaryScanType) {
    case "ema_alignment":
      stopLoss = r2(Math.max(ema20 * 0.99, currentPrice - atr * 1.5));
      target = r2(currentPrice + (currentPrice - stopLoss) * 2);
      break;
    case "volume_spike":
      stopLoss = r2(Math.max(cp.low, currentPrice - atr * 2));
      target = r2(currentPrice + (currentPrice - stopLoss) * 1.5);
      break;
    case "breakout_52w":
    case "ath_breakout":
      stopLoss = r2(Math.max(high52w * 0.95, currentPrice - atr * 2));
      target = r2(currentPrice + (high52w - low52w) * 0.5);
      break;
    case "momentum_continuation":
      stopLoss = r2(Math.min(ema20 * 0.98, currentPrice - atr * 1.5));
      target = r2(currentPrice + (currentPrice - stopLoss) * 2.5);
      break;
    case "relative_strength":
      stopLoss = r2(Math.max(ema50 * 0.98, currentPrice - atr * 2));
      target = r2(currentPrice + (currentPrice - stopLoss) * 3);
      break;
    default:
      stopLoss = r2(currentPrice - atr * 1.5);
      target = r2(currentPrice + atr * 3);
  }

  const risk = currentPrice - stopLoss;
  const reward = target - currentPrice;
  const riskReward = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : "N/A";
  signals.push(`SL: ${stopLoss.toFixed(2)} | Target: ${target.toFixed(2)} (${riskReward})`);

  return {
    symbol: asset.symbol, name: asset.name, sector: asset.sector, exchange: asset.exchange,
    price: cp.price, changePercent: cp.changePercent, volume: cp.volume,
    qualityScore: Math.min(100, Math.round(score)),
    confidence: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
    signals, marketDomain: domain,
    scanType: scanTypes.join("+"),
    stopLoss, target, riskReward,
  };
}

export async function runRealScanner(options: {
  domain: Domain;
  scanType: string | string[];
  sector?: string;
  maxResults?: number;
}): Promise<ScanResultRow[]> {
  const { domain, sector, maxResults = 15 } = options;
  const scanTypes = (Array.isArray(options.scanType) ? options.scanType : [options.scanType])
    .filter((s, i, arr) => s && arr.indexOf(s) === i);
  const registry = domain === "india" ? NSE_REGISTRY : domain === "crypto" ? CRYPTO_REGISTRY : US_REGISTRY;
  const assets = sector ? registry.filter(a => a.sector.toLowerCase() === sector.toLowerCase()) : [...registry];

  const priceMap = await getCurrentPrices(assets.map(a => a.symbol));
  const scanned = await mapLimit(assets, 6, async asset => {
    const cp = priceMap.get(asset.symbol);
    if (!cp) return null;
    try {
      return await scanAsset(asset, cp, domain, scanTypes);
    } catch {
      return null;
    }
  });

  return scanned
    .filter((r): r is ScanResultRow => r !== null)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, maxResults);
}

// ─── Real Pattern Scanner ─────────────────────────────────────────────────────

/** Run the chart-pattern detectors over real daily candles from Yahoo Finance. */
export async function runRealPatternScanner(
  assets: Array<{ symbol: string; sector?: string | null }>,
  options: PatternScanOptions = {}
): Promise<PatternResult[]> {
  const { minConfidence = 50 } = options;
  // Yahoo serves daily and weekly candles for free over long ranges; intraday
  // history is too short for these patterns, so only 1d and 1w are supported.
  const timeframes = (options.timeframes ?? ["1d"]).filter((t): t is "1d" | "1w" => t === "1d" || t === "1w");
  if (timeframes.length === 0) timeframes.push("1d");

  const perAsset = await mapLimit(assets, 6, async asset => {
    const found: PatternResult[] = [];
    for (const timeframe of timeframes) {
      try {
        const candles = timeframe === "1w"
          ? await getHistory(asset.symbol, "2y", "1wk")
          : await getHistory(asset.symbol, "6mo", "1d");
        if (candles.length < 30) continue;
        const patternCandles = candles.map(c => ({
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
          timestamp: new Date(c.timestamp).getTime(),
        }));
        found.push(
          ...detectPatternsOnCandles(patternCandles, asset.symbol, options, timeframe)
            .filter(r => r.confidenceScore >= minConfidence)
        );
      } catch {
        // skip this asset/timeframe
      }
    }
    return found;
  });

  return perAsset
    .flat()
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 50);
}
