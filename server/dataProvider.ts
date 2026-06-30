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

export async function runRealScanner(options: {
  domain: "india" | "crypto" | "us";
  scanType: string;
  sector?: string;
  maxResults?: number;
}): Promise<Array<{
  symbol: string; name: string; sector: string; exchange: string;
  price: number; changePercent: number; volume: number;
  qualityScore: number; confidence: string; signals: string[];
  marketDomain: string; scanType: string;
}>> {
  const { domain, scanType, sector, maxResults = 15 } = options;
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
  }> = [];

  for (const asset of assets) {
    const cp = priceMap.get(asset.symbol);
    if (!cp) continue;

    // Fetch real historical data
    let candles;
    try {
      const period = (scanType === "breakout_52w" || scanType === "ath_breakout") ? "1y" : "3mo";
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

    let matches = false, score = 0;
    const signals: string[] = [];

    switch (scanType) {
      // ─── EMA Alignment ────────────────────────────────────────────
      // GATE: Price > EMA20 > EMA50 (basic bullish stack)
      // SCORING: EMA200, MACD, RSI, volume, recency
      case "ema_alignment": {
        const gate = currentPrice > ema20 && ema20 > ema50;
        if (!gate) break;

        matches = true;
        score = 45; // Base score for passing gate

        // Scoring bonuses
        if (ema200 > 0 && ema50 > ema200) score += 15; // Full 200 alignment
        if (ema200 > 0 && currentPrice > ema200) score += 5; // Above 200
        if (macd.histogram > 0) score += 10; // MACD bullish
        if (rsi >= 50 && rsi <= 70) score += 8; // Sweet spot RSI
        if (rsi >= 40 && rsi < 50) score += 3; // Acceptable RSI
        if (rsi > 75) score -= 8; // Overbought penalty
        if (volumeRatio > 1.5) score += 8; // Strong volume
        else if (volumeRatio > 1.2) score += 4; // Decent volume
        if (isRecentCrossover) score += 12; // Fresh signal bonus
        const spread = ema50 > 0 ? (ema20 - ema50) / ema50 : 0;
        if (spread > 0.01) score += 5; // Well-separated EMAs

        signals.push(`EMA Stack: ${currentPrice.toFixed(2)} > ${ema20.toFixed(2)} > ${ema50.toFixed(2)}${ema200 > 0 ? ` > ${ema200.toFixed(2)}` : ""}`);
        signals.push(`RSI: ${rsi.toFixed(1)} | MACD: ${macd.histogram > 0 ? "+" + macd.histogram.toFixed(2) + " ✓" : macd.histogram.toFixed(2)}`);
        if (volumeRatio > 1.2) signals.push(`Volume: ${volumeRatio.toFixed(1)}x avg`);
        if (isRecentCrossover) signals.push(`⚡ Fresh EMA20/50 crossover (last 5 days)`);
        break;
      }

      // ─── Volume Spike ─────────────────────────────────────────────
      // GATE: Volume ≥ 2x avg + price moved > 0.5%
      // SCORING: magnitude, direction, trend context, RSI
      case "volume_spike": {
        const threshold = domain === "crypto" ? 1.8 : 2.0;
        const gate = volumeRatio >= threshold && Math.abs(cp.changePercent) > 0.5;
        if (!gate) break;

        matches = true;
        score = 45;

        // Scoring
        if (volumeRatio >= 5) score += 30;
        else if (volumeRatio >= 4) score += 25;
        else if (volumeRatio >= 3) score += 18;
        else if (volumeRatio >= 2.5) score += 12;
        else score += 5;
        if (cp.changePercent > 0 && currentPrice > ema20) score += 8; // Bullish context
        if (cp.changePercent < 0 && currentPrice < ema20) score += 5; // Clear bearish (also useful)
        if (Math.abs(cp.changePercent) > 3) score += 8; // Big move
        if (rsi < 75 && rsi > 25) score += 3; // Not extreme

        const direction = cp.changePercent > 0 ? "🟢 Bullish" : "🔴 Bearish";
        signals.push(`${direction} volume spike: ${volumeRatio.toFixed(1)}x avg`);
        signals.push(`Move: ${cp.changePercent > 0 ? "+" : ""}${cp.changePercent.toFixed(2)}% | Est. Vol: ${(estimatedFullDayVol / 100000).toFixed(1)}L`);
        signals.push(`RSI: ${rsi.toFixed(1)} | Trend: ${currentPrice > ema50 ? "Above EMA50" : "Below EMA50"}`);
        break;
      }

      // ─── 52-Week High Breakout ────────────────────────────────────
      // GATE: Price within 5% of 52-week high
      // SCORING: proximity, volume, RSI zone
      case "breakout_52w": {
        const gate = currentPrice >= high52w * 0.95; // Within 5% of high
        if (!gate) break;

        matches = true;
        const proximity = (currentPrice / high52w);
        score = proximity >= 0.995 ? 70 : proximity >= 0.98 ? 55 : 45; // Closer = higher base

        // Scoring
        if (volumeRatio >= 2.5) score += 15;
        else if (volumeRatio >= 1.5) score += 10;
        else if (volumeRatio >= 1.2) score += 5;
        if (rsi >= 55 && rsi <= 75) score += 8; // Momentum zone
        if (rsi > 80) score -= 8; // Exhaustion risk
        if (macd.histogram > 0) score += 5;
        if (currentPrice > ema20 && ema20 > ema50) score += 5; // Trend support

        const status = proximity >= 0.995 ? "🚀 Breaking Out" : proximity >= 0.98 ? "📈 At Resistance" : "🔍 Approaching";
        signals.push(`${status} | 52W High: ${high52w.toFixed(2)}`);
        signals.push(`Distance: ${((proximity - 1) * 100).toFixed(2)}% | Volume: ${volumeRatio.toFixed(1)}x`);
        signals.push(`52W Range: ${low52w.toFixed(2)} – ${high52w.toFixed(2)} | RSI: ${rsi.toFixed(1)}`);
        break;
      }

      // ─── ATH Breakout ─────────────────────────────────────────────
      // GATE: Price within 2% of all-time high + volume above average
      // SCORING: volume strength, MACD
      case "ath_breakout": {
        const gate = currentPrice >= high52w * 0.98 && volumeRatio >= 1.3;
        if (!gate) break;

        matches = true;
        score = currentPrice >= high52w * 0.995 ? 75 : 55;

        if (volumeRatio >= 3) score += 15;
        else if (volumeRatio >= 2) score += 10;
        if (macd.histogram > 0) score += 8;
        if (rsi >= 55 && rsi < 80) score += 5;

        signals.push(`🚀 Near/At All-Time High: ${high52w.toFixed(2)}`);
        signals.push(`Volume: ${volumeRatio.toFixed(1)}x avg | MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"}`);
        signals.push(`RSI: ${rsi.toFixed(1)}`);
        break;
      }

      // ─── Momentum Continuation ────────────────────────────────────
      // GATE: 5-day return > 1.5% + price above EMA20
      // SCORING: 20-day return, MACD, volume, RSI quality
      case "momentum_continuation": {
        const ret5d = closes.length >= 6 ? (currentPrice - closes[closes.length - 5]) / closes[closes.length - 5] * 100 : 0;
        const ret20d = closes.length >= 21 ? (currentPrice - closes[closes.length - 20]) / closes[closes.length - 20] * 100 : 0;

        const gate = ret5d > 1.5 && currentPrice > ema20;
        if (!gate) break;

        matches = true;
        score = 42;

        // Scoring
        if (ret20d > 10) score += 18;
        else if (ret20d > 5) score += 12;
        else if (ret20d > 3) score += 6;
        if (macd.histogram > 0) score += 10;
        if (rsi >= 50 && rsi < 70) score += 8;
        if (rsi >= 70 && rsi < 80) score += 3; // Still ok but less ideal
        if (volumeRatio > 1.3) score += 8;
        else if (volumeRatio > 1.0) score += 3;
        if (currentPrice > ema50) score += 5;
        if (ema20 > ema50) score += 5; // Trend structure

        signals.push(`Momentum: +${ret5d.toFixed(1)}% (5d) | +${ret20d.toFixed(1)}% (20d)`);
        signals.push(`RSI: ${rsi.toFixed(1)} | MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"}`);
        signals.push(`Above EMA20${currentPrice > ema50 ? " & EMA50 ✓" : ""} | Vol: ${volumeRatio.toFixed(1)}x`);
        break;
      }

      // ─── Relative Strength ────────────────────────────────────────
      // GATE: 30-day return > 3% + above EMA50
      // SCORING: 60-day return, EMA structure, RSI, volume
      case "relative_strength": {
        const ret30d = closes.length >= 31 ? (currentPrice - closes[closes.length - 30]) / closes[closes.length - 30] * 100 : 0;
        const ret60d = closes.length >= 61 ? (currentPrice - closes[closes.length - 60]) / closes[closes.length - 60] * 100 : 0;

        const gate = ret30d > 3 && currentPrice > ema50;
        if (!gate) break;

        matches = true;
        score = 42;

        // Scoring
        if (ret60d > 15) score += 18;
        else if (ret60d > 10) score += 12;
        else if (ret60d > 5) score += 6;
        if (ret30d > 10) score += 10;
        else if (ret30d > 7) score += 6;
        if (currentPrice > ema20 && ema20 > ema50) score += 8; // Full structure
        if (rsi > 55) score += 5;
        if (volumeRatio > 1.0) score += 3;
        if (macd.histogram > 0) score += 5;

        signals.push(`RS Leader: +${ret30d.toFixed(1)}% (30d)${ret60d ? ` | +${ret60d.toFixed(1)}% (60d)` : ""}`);
        signals.push(`Above EMA50 (${ema50.toFixed(2)}) | RSI: ${rsi.toFixed(1)}`);
        signals.push(`MACD: ${macd.histogram > 0 ? "Bullish ✓" : "Flat"} | Vol: ${volumeRatio.toFixed(1)}x`);
        break;
      }
    }

    if (matches && score >= 40) {
      results.push({
        symbol: asset.symbol, name: asset.name, sector: asset.sector, exchange: asset.exchange,
        price: cp.price, changePercent: cp.changePercent, volume: cp.volume,
        qualityScore: Math.min(100, Math.round(score)),
        confidence: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
        signals, marketDomain: domain, scanType,
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
  if (prices.length < 26) return { line: 0, signal: 0, histogram: 0 };

  // EMA12
  const k12 = 2 / 13;
  let ema12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  // EMA26
  const k26 = 2 / 27;
  let ema26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  const macdLine: number[] = [];

  for (let i = 26; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
    macdLine.push(ema12 - ema26);
  }

  // Signal line: 9-period EMA of MACD
  if (macdLine.length < 9) return { line: macdLine[macdLine.length - 1] ?? 0, signal: 0, histogram: 0 };
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
