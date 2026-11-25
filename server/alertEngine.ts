/**
 * Real alert evaluation against live Yahoo Finance data.
 * Each evaluator returns null when there is not enough real data to decide.
 */

import { getHistory, getAllTimeHigh } from "./yahooFinance";
import { getCurrentPrices, getRealSectorPerformance, getVolumeRatio, type Domain } from "./dataProvider";
import { calculateEMA } from "./indicators";
import { NSE_REGISTRY, US_REGISTRY, CRYPTO_REGISTRY, getSymbolDomain } from "./assetRegistry";

export type AlertType =
  | "ema_crossover" | "volume_spike" | "breakout_52w" | "breakout_ath"
  | "sector_momentum_shift" | "trend_reversal" | "relative_strength_change" | "price_target";

export interface AlertCondition {
  threshold?: number;
  direction?: "above" | "below" | "cross";
  ema1?: number;
  ema2?: number;
  sector?: string;
  timeframe?: string;
}

export interface AlertOutcome {
  triggered: boolean;
  message: string;
  value: number | null;
}

const BENCHMARK: Record<Domain, string> = { india: "NIFTY50", us: "SPX", crypto: "BTC" };

export function domainOf(symbol: string): Domain {
  const d = getSymbolDomain(symbol);
  if (d === "CRYPTO") return "crypto";
  if (d === "US") return "us";
  if (d === "INDEX") return symbol === "SPX" || symbol === "NDX" || symbol === "DJI" || symbol === "RUT" || symbol === "VIX" ? "us" : "india";
  return "india";
}

const fmt = (n: number) => (Math.abs(n) >= 1 ? n.toFixed(2) : n.toPrecision(4));

/** Daily closes with the live price in place of the still-forming last candle. */
function closesWithLive(candles: Array<{ close: number }>, price: number): number[] {
  const closes = candles.map(c => c.close);
  closes[closes.length - 1] = price;
  return closes;
}

function pctReturn(closes: number[], bars: number): number | null {
  if (closes.length <= bars) return null;
  const base = closes[closes.length - 1 - bars];
  return base > 0 ? ((closes[closes.length - 1] - base) / base) * 100 : null;
}

/** True if series a crossed series b between any two of the last `lookback` bars. */
function crossedRecently(a: number[], b: number[], lookback = 2): "up" | "down" | null {
  const n = Math.min(a.length, b.length);
  for (let i = n - 1; i > n - 1 - lookback && i > 0; i--) {
    if (a[i - 1] <= b[i - 1] && a[i] > b[i]) return "up";
    if (a[i - 1] >= b[i - 1] && a[i] < b[i]) return "down";
  }
  return null;
}

export async function evaluateAlert(
  type: AlertType,
  condition: AlertCondition | null | undefined,
  symbol: string | null
): Promise<AlertOutcome | null> {
  const cond = condition ?? {};

  if (type === "sector_momentum_shift") return evaluateSector(cond);
  if (!symbol) return null;

  const domain = domainOf(symbol);
  const prices = await getCurrentPrices([symbol, BENCHMARK[domain]]);
  const quote = prices.get(symbol);
  if (!quote) return null;
  const price = quote.price;

  if (type === "price_target") {
    if (cond.threshold == null) return null;
    const dir = cond.direction ?? "above";
    const hit = dir === "below" ? price <= cond.threshold : price >= cond.threshold;
    return {
      triggered: hit,
      value: price,
      message: `${symbol} is ${fmt(price)}, ${dir === "below" ? "at or below" : "at or above"} your target of ${fmt(cond.threshold)}`,
    };
  }

  const candles = await getHistory(symbol, "1y", "1d").catch(() => []);
  if (candles.length < 30) return null;
  const closes = closesWithLive(candles, price);

  switch (type) {
    case "ema_crossover": {
      const p1 = cond.ema1 ?? 20;
      const p2 = cond.ema2 ?? 50;
      if (closes.length < Math.max(p1, p2) + 5) return null;
      const cross = crossedRecently(calculateEMA(closes, p1), calculateEMA(closes, p2));
      const wanted = cond.direction === "above" ? "up" : cond.direction === "below" ? "down" : null;
      const hit = cross !== null && (wanted === null || wanted === cross);
      return {
        triggered: hit,
        value: price,
        message: `${symbol}: EMA ${p1} crossed ${cross === "down" ? "below" : "above"} EMA ${p2} (price ${fmt(price)})`,
      };
    }

    case "volume_spike": {
      const threshold = cond.threshold ?? 2;
      const { ratio } = getVolumeRatio(domain, candles, quote.volume);
      return {
        triggered: ratio >= threshold,
        value: Math.round(ratio * 100) / 100,
        message: `${symbol}: volume is ${ratio.toFixed(1)}x its 20-day average (alert level ${threshold}x)`,
      };
    }

    case "breakout_52w": {
      const high = Math.max(...candles.map(c => c.high), price);
      return {
        triggered: price >= high * 0.995,
        value: price,
        message: `${symbol} is at its 52-week high area: ${fmt(price)} vs high ${fmt(high)}`,
      };
    }

    case "breakout_ath": {
      const high52 = Math.max(...candles.map(c => c.high), price);
      const ath = Math.max((await getAllTimeHigh(symbol)) ?? 0, high52);
      return {
        triggered: price >= ath * 0.995,
        value: price,
        message: `${symbol} is at its all-time high area: ${fmt(price)} vs ATH ${fmt(ath)}`,
      };
    }

    case "trend_reversal": {
      const period = closes.length >= 200 ? 200 : 50;
      if (closes.length < period + 5) return null;
      const ema = calculateEMA(closes, period);
      const cross = crossedRecently(closes, ema);
      const wanted = cond.direction === "above" ? "up" : cond.direction === "below" ? "down" : null;
      const hit = cross !== null && (wanted === null || wanted === cross);
      return {
        triggered: hit,
        value: price,
        message: `${symbol}: price crossed ${cross === "down" ? "below" : "above"} EMA ${period} (trend reversal), now ${fmt(price)}`,
      };
    }

    case "relative_strength_change": {
      const bench = prices.get(BENCHMARK[domain]);
      const benchCandles = await getHistory(BENCHMARK[domain], "1y", "1d").catch(() => []);
      if (!bench || benchCandles.length < 31) return null;
      const own = pctReturn(closes, 30);
      const ref = pctReturn(closesWithLive(benchCandles, bench.price), 30);
      if (own === null || ref === null) return null;
      const rs = own - ref;
      const threshold = cond.threshold ?? 5;
      const hit = cond.direction === "below" ? rs <= -threshold : rs >= threshold;
      return {
        triggered: hit,
        value: Math.round(rs * 100) / 100,
        message: `${symbol}: 30-day return ${own.toFixed(1)}% vs ${BENCHMARK[domain]} ${ref.toFixed(1)}% (relative strength ${rs >= 0 ? "+" : ""}${rs.toFixed(1)} pts)`,
      };
    }
  }
  return null;
}

async function evaluateSector(cond: AlertCondition): Promise<AlertOutcome | null> {
  if (!cond.sector) return null;
  const domain: "india" | "us" | null = NSE_REGISTRY.some(a => a.sector === cond.sector)
    ? "india"
    : US_REGISTRY.some(a => a.sector === cond.sector) ? "us" : null;
  if (!domain) return null;

  const [perf] = await getRealSectorPerformance([cond.sector], domain);
  if (!perf) return null;

  const below = cond.direction === "below";
  const threshold = cond.threshold ?? (below ? 35 : 65);
  const hit = below ? perf.momentumScore <= threshold : perf.momentumScore >= threshold;
  return {
    triggered: hit,
    value: perf.momentumScore,
    message: `${cond.sector} momentum score is ${perf.momentumScore} (${below ? "at or below" : "at or above"} ${threshold}); sector moved ${perf.priceChange1d >= 0 ? "+" : ""}${perf.priceChange1d}% today`,
  };
}

/** Registry-backed list of every symbol the app can alert on. */
export const ALERTABLE_SYMBOLS = new Set([
  ...NSE_REGISTRY.map(a => a.symbol),
  ...US_REGISTRY.map(a => a.symbol),
  ...CRYPTO_REGISTRY.map(a => a.symbol),
]);
