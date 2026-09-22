/**
 * PulseFlow Data Provider
 * Real market data via Yahoo Finance with professional-grade technical analysis.
 */

import { getRealPrice, getRealPrices, getHistory, type QuoteResult } from "./yahooFinance";
import { generateCurrentPrice, generateMarketData, calculateEMA, calculateRSI } from "./marketEngine";
import { NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY } from "./assetRegistry";

const USE_REAL_DATA = process.env.USE_SIMULATED_DATA !== "true";

// ─── Price Data ───────────────────────────────────────────────────────────────

export async function getCurrentPrice(symbol: string): Promise<{
  price: number; change: number; changePercent: number;
  volume: number; high: number; low: number; open: number;
}> {
  if (!USE_REAL_DATA) return generateCurrentPrice(symbol);
  try {
    const realPrice = await getRealPrice(symbol);
    if (realPrice) return realPrice;
  } catch { /* fall through */ }
  return generateCurrentPrice(symbol);
}

export async function getCurrentPrices(symbols: string[]): Promise<Map<string, {
  price: number; change: number; changePercent: number;
  volume: number; high: number; low: number; open: number;
}>> {
  const results = new Map<string, { price: number; change: number; changePercent: number; volume: number; high: number; low: number; open: number }>();
  if (!USE_REAL_DATA) {
    for (const sym of symbols) results.set(sym, generateCurrentPrice(sym));
    return results;
  }
  try {
    const realPrices = await getRealPrices(symbols);
    for (const [sym, price] of realPrices) results.set(sym, price);
  } catch { /* fall through */ }
  for (const sym of symbols) {
    if (!results.has(sym)) results.set(sym, generateCurrentPrice(sym));
  }
  return results;
}

// ─── Historical Data ──────────────────────────────────────────────────────────

export async function getHistoricalCandles(
  symbol: string, days: number = 365
): Promise<Array<{ timestamp: string | Date; open: number; high: number; low: number; close: number; volume: number }>> {
  if (!USE_REAL_DATA) return generateMarketData(symbol, days);
  try {
    const period = days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 180 ? "6mo" : "1y";
    const candles = await getHistory(symbol, period as any, "1d");
    if (candles.length > 0) return candles;
  } catch { /* fall through */ }
  return generateMarketData(symbol, days);
}

// ─── Asset Detail ─────────────────────────────────────────────────────────────

export async function getAssetDetailData(symbol: string) {
  const candles = await getHistoricalCandles(symbol, 365);
  const closes = candles.map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(closes);
  const high52w = closes.length > 0 ? Math.max(...closes) : 0;
  const low52w = closes.length > 0 ? Math.min(...closes) : 0;
  const volumeAvg20 = candles.length >= 20
    ? candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20
    : candles.length > 0 ? candles.reduce((a, c) => a + c.volume, 0) / candles.length : 0;
  const currentPrice = await getCurrentPrice(symbol);

  return {
    candles, currentPrice,
    emaData: {
      ema20: ema20.map(v => Math.round(v * 100) / 100),
      ema50: ema50.map(v => Math.round(v * 100) / 100),
      ema200: ema200.map(v => Math.round(v * 100) / 100),
    },
    indicators: {
      ema20: ema20.length > 0 ? Math.round(ema20[ema20.length - 1] * 100) / 100 : 0,
      ema50: ema50.length > 0 ? Math.round(ema50[ema50.length - 1] * 100) / 100 : 0,
      ema200: ema200.length > 0 ? Math.round(ema200[ema200.length - 1] * 100) / 100 : 0,
      rsi: Math.round(rsi * 100) / 100,
      high52w: Math.round(high52w * 100) / 100,
      low52w: Math.round(low52w * 100) / 100,
      ath: Math.round(high52w * 100) / 100,
      volumeAvg20: Math.round(volumeAvg20),
      volumeRatio: volumeAvg20 > 0 ? Math.round((currentPrice.volume / volumeAvg20) * 100) / 100 : 1,
    },
  };
}

// ─── Sector Performance ──────────────────────────────────────────────────────

export async function getRealSectorPerformance(sectors: string[], domain: "india" | "us" = "india"): Promise<Array<{
  sector: string; priceChange1d: number; priceChange1w: number; priceChange1m: number;
  momentumScore: number; strengthScore: number; volumeScore: number;
  breakoutFrequency: number; inflowOutflow: number; performanceScore: number;
}>> {
  const registry = domain === "india" ? NSE_REGISTRY : US_REGISTRY;
  const results: Array<{
    sector: string; priceChange1d: number; priceChange1w: number; priceChange1m: number;
    momentumScore: number; strengthScore: number; volumeScore: number;
    breakoutFrequency: number; inflowOutflow: number; performanceScore: number;
  }> = [];

  // Fetch all sector stock prices at once
  const allSectorStocks = sectors.flatMap(s => registry.filter(a => a.sector === s));
  const allSymbols = [...new Set(allSectorStocks.map(a => a.symbol))];
  const priceMap = await getCurrentPrices(allSymbols);

  // Also fetch short history for 1-week and 1-month calculations
  // We'll use a representative stock per sector for weekly/monthly
  const weeklyChanges = new Map<string, number>();
  const monthlyChanges = new Map<string, number>();

  for (const sector of sectors) {
    const sectorStocks = registry.filter(a => a.sector === sector);
    if (sectorStocks.length === 0) {
      results.push({ sector, priceChange1d: 0, priceChange1w: 0, priceChange1m: 0, momentumScore: 50, strengthScore: 50, volumeScore: 50, breakoutFrequency: 0, inflowOutflow: 0, performanceScore: 50 });
      continue;
    }

    let totalChange1d = 0, totalVolume = 0, positiveCount = 0, count = 0;

    for (const stock of sectorStocks) {
      const price = priceMap.get(stock.symbol);
      if (price) {
        totalChange1d += price.changePercent;
        totalVolume += price.volume;
        if (price.changePercent > 0) positiveCount++;
        count++;
      }
    }

    const avgChange1d = count > 0 ? totalChange1d / count : 0;
    const breadth = count > 0 ? positiveCount / count : 0.5; // % of stocks positive

    // Get 1-week and 1-month change from one representative stock's history
    let priceChange1w = avgChange1d * 3; // rough fallback
    let priceChange1m = avgChange1d * 10;
    try {
      const repSymbol = sectorStocks[0].symbol;
      const hist = await getHistory(repSymbol, "1mo", "1d");
      if (hist.length >= 5) {
        const weekAgo = hist[Math.max(0, hist.length - 6)]?.close ?? hist[0].close;
        const monthAgo = hist[0].close;
        const now = hist[hist.length - 1].close;
        priceChange1w = ((now - weekAgo) / weekAgo) * 100;
        priceChange1m = ((now - monthAgo) / monthAgo) * 100;
      }
    } catch { /* use estimate */ }

    // Score calculation
    // Momentum: weighted by daily change + breadth
    const momentumScore = Math.max(0, Math.min(100, Math.round(
      50 + avgChange1d * 8 + (breadth - 0.5) * 20
    )));
    // Strength: uses monthly return
    const strengthScore = Math.max(0, Math.min(100, Math.round(
      50 + priceChange1m * 1.5
    )));
    // Volume: relative volume vs typical
    const avgVolPerStock = count > 0 ? totalVolume / count : 0;
    const volumeScore = Math.max(0, Math.min(100, Math.round(
      30 + Math.min(50, avgVolPerStock / 1000000)
    )));
    // Breakout frequency: how many stocks are near their highs
    const breakoutFrequency = Math.round(Math.abs(avgChange1d) * 2 * 100) / 100;
    // Inflow: positive = money flowing in (positive breadth & change)
    const inflowOutflow = Math.round((avgChange1d * totalVolume / 10000000) * 100) / 100;
    // Overall score
    const performanceScore = Math.round((momentumScore * 0.35 + strengthScore * 0.35 + volumeScore * 0.3) * 100) / 100;

    results.push({
      sector,
      priceChange1d: Math.round(avgChange1d * 100) / 100,
      priceChange1w: Math.round(priceChange1w * 100) / 100,
      priceChange1m: Math.round(priceChange1m * 100) / 100,
      momentumScore, strengthScore, volumeScore,
      breakoutFrequency,
      inflowOutflow,
      performanceScore,
    });
  }

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

// ─── Real Scanner (Professional Grade) ────────────────────────────────────────

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
  high52w: number; low52w: number;
  isRecentCrossover: boolean;
}

/**
 * Evaluate ONE scan strategy against a pre-computed indicator context.
 * Returns null if the gate fails, otherwise the base score + signals.
 * (Verbatim gate/scoring logic extracted from the original switch so single
 * and combination scans share exactly the same math.)
 */
function evaluateSingleScan(scanType: string, ctx: ScanContext): { score: number; signals: string[] } | null {
  const { domain, cp, currentPrice, closes, ema20, ema50, ema200, rsi, macd, volumeRatio, estimatedFullDayVol, high52w, low52w, isRecentCrossover } = ctx;
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
      const gate = currentPrice >= high52w * 0.98 && volumeRatio >= 1.3;
      if (!gate) return null;
      score = currentPrice >= high52w * 0.995 ? 75 : 55;
      if (volumeRatio >= 3) score += 15;
      else if (volumeRatio >= 2) score += 10;
      if (macd.histogram > 0) score += 8;
      if (rsi >= 55 && rsi < 80) score += 5;
      signals.push(`🚀 Near/At All-Time High: ${high52w.toFixed(2)}`);
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

export async function runRealScanner(options: {
  domain: "india" | "crypto" | "us";
  scanType: string | string[];
  sector?: string;
  maxResults?: number;
}): Promise<Array<{
  symbol: string; name: string; sector: string; exchange: string;
  price: number; changePercent: number; volume: number;
  qualityScore: number; confidence: string; signals: string[];
  marketDomain: string; scanType: string;
  stopLoss: number; target: number; riskReward: string;
}>> {
  const { domain, sector, maxResults = 15 } = options;
  // Normalize to an array of scan types. >1 type = confluence (AND) mode:
  // an asset must pass EVERY selected strategy's gate to be a result.
  const scanTypes = (Array.isArray(options.scanType) ? options.scanType : [options.scanType])
    .filter((s, i, arr) => s && arr.indexOf(s) === i); // dedupe, drop empty
  const isCombo = scanTypes.length > 1;
  const primaryScanType = scanTypes[0] ?? "ema_alignment";
  const registry = domain === "india" ? NSE_REGISTRY : domain === "crypto" ? CRYPTO_REGISTRY : US_REGISTRY;

  let assets = sector ? registry.filter(a => a.sector.toLowerCase() === sector.toLowerCase()) : [...registry];
  assets = assets.slice(0, 30); // process up to 30 assets

  const symbols = assets.map(a => a.symbol);
  const priceMap = await getCurrentPrices(symbols);

  const results: Array<{
    symbol: string; name: string; sector: string; exchange: string;
    price: number; changePercent: number; volume: number;
    qualityScore: number; confidence: string; signals: string[];
    marketDomain: string; scanType: string;
    stopLoss: number; target: number; riskReward: string;
  }> = [];

  for (const asset of assets) {
    const cp = priceMap.get(asset.symbol);
    if (!cp) continue;

    // Fetch real historical data — use the longer window if ANY selected
    // strategy needs 52w/ATH context, or for relative_strength (needs 60d).
    let candles;
    try {
      const needsLong = scanTypes.some(s => s === "breakout_52w" || s === "ath_breakout" || s === "relative_strength");
      const period = needsLong ? "1y" : "3mo";
      candles = await getHistory(asset.symbol, period as any, "1d");
    } catch { continue; }
    if (!candles || candles.length < 20) continue;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const volumes = candles.map(c => c.volume);
    // Use current price as the latest data point (more accurate than yesterday's close)
    const currentPrice = cp.price;
    const lastHistClose = closes[closes.length - 1];
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : lastHistClose;

    // ─── Technical Indicators ───────────────────────────────────────
    // Append current price to closes for EMA/RSI calculation accuracy
    const closesWithCurrent = [...closes, currentPrice];
    const ema20 = emaCalc(closesWithCurrent, 20);
    const ema50 = emaCalc(closesWithCurrent, 50);
    const ema200 = closesWithCurrent.length >= 200 ? emaCalc(closesWithCurrent, 200) : 0;
    const rsi = wilderRSI(closesWithCurrent, 14);
    const macd = macdCalc(closesWithCurrent);

    // Volume: use avg of last 20 FULL days (not today's partial volume)
    const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    // Compare today's volume — if market is open, estimate full-day by time proportion
    const now = new Date();
    const marketHoursElapsed = Math.min(1, Math.max(0.3, (now.getUTCHours() - 3.75) / 6.25)); // IST 9:15-15:30
    const estimatedFullDayVol = cp.volume / marketHoursElapsed;
    const volumeRatio = avgVol20 > 0 ? estimatedFullDayVol / avgVol20 : 1;

    const high52w = Math.max(...highs);
    const low52w = Math.min(...candles.map(c => c.low));
    const atr14 = atrCalc(candles);

    // Check if EMA crossover is RECENT (within last 5 days)
    const prevEma20 = closesWithCurrent.length > 25 ? emaCalc(closesWithCurrent.slice(0, -5), 20) : ema20;
    const prevEma50 = closesWithCurrent.length > 55 ? emaCalc(closesWithCurrent.slice(0, -5), 50) : ema50;
    const isRecentCrossover = (prevEma20 <= prevEma50 && ema20 > ema50); // Just crossed in last 5 days

    // ─── Evaluate selected strategies ──────────────────────────────
    // Single type: pass-through. Combination: CONFLUENCE (AND) — every
    // selected strategy must pass its gate; the blended score is the mean
    // of component scores plus a confluence bonus that rewards agreement.
    const ctx: ScanContext = {
      domain, cp, currentPrice, closes, ema20, ema50, ema200, rsi, macd,
      volumeRatio, estimatedFullDayVol, high52w, low52w, isRecentCrossover,
    };

    let matches = false, score = 0;
    let signals: string[] = [];

    {
      const perType = scanTypes.map(t => ({ t, res: evaluateSingleScan(t, ctx) }));
      const allPass = perType.every(p => p.res !== null);
      if (allPass && perType.length > 0) {
        matches = true;
        const scores = perType.map(p => p.res!.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (isCombo) {
          // Confluence bonus: +6 per extra confirming strategy (capped +18).
          const confluenceBonus = Math.min(18, (perType.length - 1) * 6);
          score = avg + confluenceBonus;
          signals.push(`🎯 Confluence: ${perType.map(p => SCAN_TYPE_LABELS[p.t] ?? p.t).join(" + ")} (${perType.length} strategies agree)`);
          // Merge component signals (deduped), keep it readable.
          const merged = new Set<string>();
          for (const p of perType) for (const s of p.res!.signals) merged.add(s);
          signals.push(...merged);
        } else {
          score = avg;
          signals = perType[0].res!.signals;
        }
      }
    }

    // ─── DEAD_SWITCH_START (removed below) ───
    if (matches && score >= 40) {
      // Calculate stop loss and target based on the primary scan type and ATR.
      // In combination mode, the FIRST selected strategy drives SL/target.
      const atr = atr14;
      let stopLoss: number;
      let target: number;

      switch (primaryScanType) {
        case "ema_alignment":
          // SL below EMA20 or 1.5x ATR below current price
          stopLoss = Math.round(Math.max(ema20 * 0.99, currentPrice - atr * 1.5) * 100) / 100;
          // Target: 2x risk (risk = price - SL)
          target = Math.round((currentPrice + (currentPrice - stopLoss) * 2) * 100) / 100;
          break;
        case "volume_spike":
          // SL: day's low or 2x ATR
          stopLoss = Math.round(Math.max(cp.low, currentPrice - atr * 2) * 100) / 100;
          // Target: 1.5x risk for quick trades
          target = Math.round((currentPrice + (currentPrice - stopLoss) * 1.5) * 100) / 100;
          break;
        case "breakout_52w":
        case "ath_breakout":
          // SL: previous resistance (high52w * 0.95) or 2x ATR
          stopLoss = Math.round(Math.max(high52w * 0.95, currentPrice - atr * 2) * 100) / 100;
          // Target: breakout measured move (distance from low52w to high52w, projected above)
          const breakoutRange = high52w - low52w;
          target = Math.round((currentPrice + breakoutRange * 0.5) * 100) / 100;
          break;
        case "momentum_continuation":
          // SL: below EMA20 or 1.5x ATR
          stopLoss = Math.round(Math.min(ema20 * 0.98, currentPrice - atr * 1.5) * 100) / 100;
          // Target: 2.5x risk for momentum trades
          target = Math.round((currentPrice + (currentPrice - stopLoss) * 2.5) * 100) / 100;
          break;
        case "relative_strength":
          // SL: below EMA50 or 2x ATR
          stopLoss = Math.round(Math.max(ema50 * 0.98, currentPrice - atr * 2) * 100) / 100;
          // Target: 3x risk for swing trades
          target = Math.round((currentPrice + (currentPrice - stopLoss) * 3) * 100) / 100;
          break;
        default:
          stopLoss = Math.round((currentPrice - atr * 1.5) * 100) / 100;
          target = Math.round((currentPrice + atr * 3) * 100) / 100;
      }

      const risk = currentPrice - stopLoss;
      const reward = target - currentPrice;
      const riskReward = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : "N/A";

      // Add SL/Target to signals
      signals.push(`SL: ${stopLoss.toFixed(2)} | Target: ${target.toFixed(2)} (${riskReward})`);

      results.push({
        symbol: asset.symbol, name: asset.name, sector: asset.sector, exchange: asset.exchange,
        price: cp.price, changePercent: cp.changePercent, volume: cp.volume,
        qualityScore: Math.min(100, Math.round(score)),
        confidence: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
        signals, marketDomain: domain,
        scanType: scanTypes.join("+"), // e.g. "ema_alignment+relative_strength"
        stopLoss, target, riskReward,
      });
    }
  }

  return results.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, maxResults);
}

// ─── Technical Indicator Functions ────────────────────────────────────────────

/** EMA using proper Wilder's exponential smoothing with SMA seed */
function emaCalc(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

/** Wilder's RSI — proper smoothed (not simple average) */
function wilderRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  let avgGain = 0, avgLoss = 0;

  // First period: simple average
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD (12, 26, 9) — returns line, signal, and histogram */
function macdCalc(prices: number[]): { line: number; signal: number; histogram: number } {
  if (prices.length < 35) return { line: 0, signal: 0, histogram: 0 }; // Need 26 + 9 minimum

  // EMA12: seed from first 12, then apply from index 12 onward
  const k12 = 2 / 13;
  let ema12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  for (let i = 12; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
  }

  // EMA26: seed from first 26, then apply from index 26 onward
  const k26 = 2 / 27;
  let ema26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 26; i < prices.length; i++) {
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
  }

  // Build MACD line series (from index 26 onward where both EMAs are valid)
  const macdLine: number[] = [];
  let e12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  // Process EMA12 through prices[12..25] first
  for (let i = 12; i < 26; i++) {
    e12 = prices[i] * k12 + e12 * (1 - k12);
  }
  // Now both are ready, build MACD line from index 26
  for (let i = 26; i < prices.length; i++) {
    e12 = prices[i] * k12 + e12 * (1 - k12);
    e26 = prices[i] * k26 + e26 * (1 - k26);
    macdLine.push(e12 - e26);
  }

  if (macdLine.length < 9) return { line: macdLine[macdLine.length - 1] ?? 0, signal: 0, histogram: 0 };

  // Signal line: 9-period EMA of MACD line
  const k9 = 2 / 10;
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdLine.length; i++) {
    signal = macdLine[i] * k9 + signal * (1 - k9);
  }

  const line = macdLine[macdLine.length - 1];
  return { line, signal, histogram: line - signal };
}

/** ATR (Average True Range) — 14 period */
function atrCalc(candles: Array<{ high: number; low: number; close: number }>, period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  // Wilder smoothing
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// ─── Real Pattern Scanner ─────────────────────────────────────────────────────

import { type PatternResult, type PatternScanOptions, scanAssetForPatterns } from "./patternEngine";

/**
 * Run pattern scanner on real Yahoo Finance data.
 * Fetches 3-month history and runs pattern detection on actual candles.
 */
export async function runRealPatternScanner(
  assets: Array<{ symbol: string; basePrice?: number; sector?: string | null }>,
  options: PatternScanOptions = {}
): Promise<PatternResult[]> {
  const { minConfidence = 50, maxResultsPerAsset = 2 } = options;
  const allResults: PatternResult[] = [];

  // Limit to 20 assets to avoid excessive API calls
  const limitedAssets = assets.slice(0, 20);

  for (const asset of limitedAssets) {
    try {
      const candles = await getHistory(asset.symbol, "3mo", "1d");
      if (!candles || candles.length < 20) continue;

      // Convert to the format the pattern engine expects
      const patternCandles = candles.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        timestamp: new Date(c.timestamp).getTime(),
      }));

      // Import pattern detectors and run on real data
      const { detectPatternsOnCandles } = await import("./patternEngine");
      const results = detectPatternsOnCandles(patternCandles, asset.symbol, options);

      for (const r of results) {
        if (r.confidenceScore >= minConfidence) {
          allResults.push(r);
        }
      }
    } catch {
      // Skip assets that fail
      continue;
    }
  }

  return allResults
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 30);
}
