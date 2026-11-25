/**
 * PulseFlow technical indicators.
 * Pure functions over real price series. No data generation lives here.
 */

/** EMA series (seeded with the first price), same length as the input. */
export function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = prices[0];
  for (const price of prices) {
    const current = price * k + prev * (1 - k);
    ema.push(current);
    prev = current;
  }
  return ema;
}

/** Simple-average RSI over the last `period` changes. */
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** Last EMA value with an SMA seed (standard definition). */
export function emaCalc(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

/** Wilder's smoothed RSI. */
export function wilderRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** MACD (12, 26, 9): line, signal and histogram for the latest bar. */
export function macdCalc(prices: number[]): { line: number; signal: number; histogram: number } {
  if (prices.length < 35) return { line: 0, signal: 0, histogram: 0 };

  const k12 = 2 / 13;
  const k26 = 2 / 27;
  let e12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 12; i < 26; i++) e12 = prices[i] * k12 + e12 * (1 - k12);

  const macdLine: number[] = [];
  for (let i = 26; i < prices.length; i++) {
    e12 = prices[i] * k12 + e12 * (1 - k12);
    e26 = prices[i] * k26 + e26 * (1 - k26);
    macdLine.push(e12 - e26);
  }

  if (macdLine.length < 9) return { line: macdLine[macdLine.length - 1] ?? 0, signal: 0, histogram: 0 };

  const k9 = 2 / 10;
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i] * k9 + signal * (1 - k9);

  const line = macdLine[macdLine.length - 1];
  return { line, signal, histogram: line - signal };
}

/** Average True Range (Wilder smoothing). */
export function atrCalc(candles: Array<{ high: number; low: number; close: number }>, period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
    );
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return atr;
}

export function detectEMAAlignment(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number
): "bullish" | "bearish" | "mixed" {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return "bullish";
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return "bearish";
  return "mixed";
}

export function detectVolumeSpike(currentVolume: number, avgVolume: number, threshold = 2.0): boolean {
  return currentVolume > avgVolume * threshold;
}

export function detect52wHighBreakout(currentPrice: number, high52w: number): boolean {
  return currentPrice >= high52w * 0.99;
}

export function detectATHBreakout(currentPrice: number, ath: number): boolean {
  return currentPrice >= ath * 0.98;
}

/** Momentum score 0-100 from price change, RSI and volume ratio. */
export function calculateMomentumScore(
  priceChange1d: number,
  priceChange1w: number,
  priceChange1m: number,
  rsi: number,
  volumeRatio: number
): number {
  const priceScore = Math.min(100, Math.max(0, 50 + priceChange1m * 2));
  const rsiScore = rsi > 50 ? Math.min(100, (rsi - 50) * 2) : 0;
  const volumeScore = Math.min(100, (volumeRatio - 1) * 50);
  return Math.round(priceScore * 0.4 + rsiScore * 0.35 + volumeScore * 0.25);
}

export function calculateRelativeStrength(assetReturn: number, benchmarkReturn: number): number {
  return assetReturn - benchmarkReturn;
}
