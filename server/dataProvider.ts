/**
 * PulseFlow Data Provider
 * Unified interface for market data. Uses Yahoo Finance for real data,
 * falls back to simulation engine if Yahoo is unavailable.
 */

import { getRealPrice, getRealPrices, getHistory, type QuoteResult } from "./yahooFinance";
import { generateCurrentPrice, generateMarketData, calculateEMA, calculateRSI } from "./marketEngine";
import { NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY } from "./assetRegistry";

// ─── Configuration ────────────────────────────────────────────────────────────

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

// ─── Sector Performance (Real Data) ──────────────────────────────────────────

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

  for (const sector of sectors) {
    const sectorStocks = registry.filter(a => a.sector === sector);
    if (sectorStocks.length === 0) {
      results.push({ sector, priceChange1d: 0, priceChange1w: 0, priceChange1m: 0, momentumScore: 50, strengthScore: 50, volumeScore: 50, breakoutFrequency: 0, inflowOutflow: 0, performanceScore: 50 });
      continue;
    }

    const symbols = sectorStocks.map(a => a.symbol);
    const priceMap = await getCurrentPrices(symbols);

    let totalChange = 0, totalVolume = 0, count = 0;
    for (const stock of sectorStocks) {
      const price = priceMap.get(stock.symbol);
      if (price) { totalChange += price.changePercent; totalVolume += price.volume; count++; }
    }

    const avgChange = count > 0 ? totalChange / count : 0;
    const momentumScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 10)));
    const strengthScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 8)));
    const volumeScore = Math.max(0, Math.min(100, Math.round(40 + Math.min(40, (totalVolume / (count || 1)) / 2000000))));
    const performanceScore = Math.round((momentumScore * 0.4 + strengthScore * 0.3 + volumeScore * 0.3) * 100) / 100;

    results.push({
      sector,
      priceChange1d: Math.round(avgChange * 100) / 100,
      priceChange1w: Math.round(avgChange * 3.5 * 100) / 100, // estimate
      priceChange1m: Math.round(avgChange * 12 * 100) / 100, // estimate
      momentumScore, strengthScore, volumeScore,
      breakoutFrequency: Math.round(Math.abs(avgChange) * 3 * 100) / 100,
      inflowOutflow: Math.round(avgChange * 500 * 100) / 100,
      performanceScore,
    });
  }

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

// ─── Real Scanner ─────────────────────────────────────────────────────────────

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
  assets = assets.slice(0, 25); // limit API calls

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

    let candles;
    try { candles = await getHistory(asset.symbol, "3mo", "1d"); } catch { continue; }
    if (!candles || candles.length < 20) continue;

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const ema20 = emaCalc(closes, 20);
    const ema50 = emaCalc(closes, 50);
    const rsi = rsiCalc(closes);
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volumeRatio = avgVol > 0 ? cp.volume / avgVol : 1;
    const high3m = Math.max(...closes);
    const lastClose = closes[closes.length - 1];

    let matches = false, score = 0;
    const signals: string[] = [];

    switch (scanType) {
      case "ema_alignment":
        if (lastClose > ema20 && ema20 > ema50) {
          matches = true;
          score = 60 + (volumeRatio > 1.5 ? 20 : 0) + (rsi > 50 && rsi < 70 ? 15 : 0);
          signals.push(`Price > EMA20 (${ema20.toFixed(2)}) > EMA50 (${ema50.toFixed(2)})`);
          signals.push(`RSI: ${rsi.toFixed(1)}`);
          if (volumeRatio > 1.5) signals.push(`Volume ${volumeRatio.toFixed(1)}x avg`);
        }
        break;
      case "volume_spike":
        if (volumeRatio >= 1.8 && Math.abs(cp.changePercent) > 0.3) {
          matches = true;
          score = 50 + Math.min(30, volumeRatio * 10);
          signals.push(`Volume ${volumeRatio.toFixed(1)}x above average`);
          signals.push(`Change: ${cp.changePercent > 0 ? "+" : ""}${cp.changePercent.toFixed(2)}%`);
        }
        break;
      case "breakout_52w":
      case "ath_breakout":
        if (cp.price >= high3m * 0.97 && volumeRatio >= 1.2) {
          matches = true;
          score = 70 + (volumeRatio >= 2 ? 15 : 0);
          signals.push(`Near 3-month high: ${high3m.toFixed(2)}`);
          signals.push(`Volume: ${volumeRatio.toFixed(1)}x avg`);
        }
        break;
      case "momentum_continuation": {
        const ret5d = closes.length >= 6 ? (lastClose - closes[closes.length - 6]) / closes[closes.length - 6] * 100 : 0;
        if (ret5d > 2 && rsi > 50 && rsi < 75 && lastClose > ema20) {
          matches = true;
          score = 55 + (ret5d > 5 ? 20 : 0) + (volumeRatio > 1.2 ? 10 : 0);
          signals.push(`5-day return: +${ret5d.toFixed(1)}%`);
          signals.push(`RSI: ${rsi.toFixed(1)}`);
        }
        break;
      }
      case "relative_strength": {
        const ret30d = closes.length >= 31 ? (lastClose - closes[closes.length - 31]) / closes[closes.length - 31] * 100 : 0;
        if (ret30d > 3 && lastClose > ema50) {
          matches = true;
          score = 50 + Math.min(30, ret30d * 2);
          signals.push(`30-day return: +${ret30d.toFixed(1)}%`);
          signals.push(`Above EMA50`);
        }
        break;
      }
    }

    if (matches && score >= 40) {
      results.push({
        symbol: asset.symbol, name: asset.name, sector: asset.sector, exchange: asset.exchange,
        price: cp.price, changePercent: cp.changePercent, volume: cp.volume,
        qualityScore: Math.min(100, Math.round(score)),
        confidence: score >= 75 ? "high" : score >= 55 ? "medium" : "low",
        signals, marketDomain: domain, scanType,
      });
    }
  }

  return results.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, maxResults);
}

function emaCalc(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function rsiCalc(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + (gains / period) / (losses / period));
}
