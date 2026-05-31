/**
 * PulseFlow Chart Pattern Scanning Engine
 *
 * Implements rule-based detection for 14 technical chart patterns across
 * NSE stocks, crypto assets, and indices. Each pattern uses multi-factor
 * confirmation (price structure + volume + momentum) to reduce false positives.
 */

import { generateCandle } from "./marketEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatternType =
  | "ascending_triangle"
  | "descending_triangle"
  | "symmetrical_triangle"
  | "bull_flag"
  | "bear_flag"
  | "cup_and_handle"
  | "double_top"
  | "double_bottom"
  | "head_and_shoulders"
  | "inverse_head_and_shoulders"
  | "breakout_consolidation"
  | "support_resistance_breakout"
  | "channel_breakout"
  | "trendline_breakout";

export type PatternSeverity = "bullish" | "bearish" | "neutral";

export type Timeframe = "15m" | "1h" | "4h" | "1d" | "1w";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface PatternResult {
  symbol: string;
  patternType: PatternType;
  patternName: string;
  timeframe: Timeframe;
  severity: PatternSeverity;
  confidenceScore: number;     // 0-100
  patternStrength: number;     // 0-100
  volumeConfirmed: boolean;
  breakoutConfirmed: boolean;
  isFalseBreakout: boolean;
  breakoutLevel: number;
  stopLossZone: number;
  targetLevel: number;
  description: string;
  detectedAt: number;
  candles?: Candle[];          // last N candles used for detection
}

export interface PatternScanOptions {
  timeframes?: Timeframe[];
  minConfidence?: number;
  requireVolumeConfirmation?: boolean;
  filterFalseBreakouts?: boolean;
  maxResultsPerAsset?: number;
}

// ─── Candle Generation ────────────────────────────────────────────────────────

/** Generate a synthetic OHLCV series with configurable trend and volatility */
function generateCandleSeries(
  basePrice: number,
  symbol: string,
  count: number,
  trend: number = 0,
  timeframe: Timeframe = "1d",
  seed: number = 0
): Candle[] {
  const candles: Candle[] = [];
  const symbolSeed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tfMultiplier: Record<Timeframe, number> = { "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000, "1w": 604800000 };
  const now = Date.now();
  let price = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const candleSeed = symbolSeed + seed + i * 7;
    const candle = generateCandle(price, candleSeed, trend);
    candles.push({
      ...candle,
      timestamp: now - i * tfMultiplier[timeframe],
    });
    price = candle.close;
  }
  return candles;
}

// ─── Technical Helpers ────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  const x = values.map((_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi) => a + xi * values[xi], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function avgVolume(candles: Candle[], period = 20): number {
  const slice = candles.slice(-Math.min(period, candles.length));
  return avg(slice.map(c => c.volume));
}

function isVolumeSpike(candles: Candle[], multiplier = 1.5): boolean {
  const recent = candles[candles.length - 1];
  const historical = avgVolume(candles.slice(0, -1));
  return recent.volume > historical * multiplier;
}

function findLocalMaxima(values: number[], window = 3): number[] {
  const maxima: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    const slice = values.slice(i - window, i + window + 1);
    if (values[i] === Math.max(...slice)) maxima.push(i);
  }
  return maxima;
}

function findLocalMinima(values: number[], window = 3): number[] {
  const minima: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    const slice = values.slice(i - window, i + window + 1);
    if (values[i] === Math.min(...slice)) minima.push(i);
  }
  return minima;
}

// ─── Pattern Detectors ────────────────────────────────────────────────────────

function detectAscendingTriangle(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 20) return null;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const recent = candles.slice(-20);
  const recentHighs = recent.map(c => c.high);
  const recentLows = recent.map(c => c.low);

  const maxHigh = Math.max(...recentHighs);
  const highVariance = stdDev(recentHighs) / maxHigh;
  const lowRegression = linearRegression(recentLows);
  const isResistanceFlat = highVariance < 0.025;
  const isSupportRising = lowRegression.slope > 0;

  if (!isResistanceFlat || !isSupportRising) return null;

  const breakoutLevel = maxHigh;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice > breakoutLevel * 0.995;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isResistanceFlat ? 30 : 0) +
    (isSupportRising ? 30 : 0) +
    (breakoutConfirmed ? 25 : 0) +
    (volumeConfirmed ? 15 : 0)
  );
  if (confidence < 45) return null;

  const supportBase = Math.min(...recentLows.slice(-5));
  const patternHeight = breakoutLevel - supportBase;

  return {
    symbol, patternType: "ascending_triangle", patternName: "Ascending Triangle",
    timeframe, severity: "bullish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(breakoutLevel * 100) / 100,
    stopLossZone: Math.round(supportBase * 100) / 100,
    targetLevel: Math.round((breakoutLevel + patternHeight) * 100) / 100,
    description: `Ascending triangle with flat resistance at ${breakoutLevel.toFixed(2)} and rising support. ${breakoutConfirmed ? "Breakout confirmed." : "Approaching breakout zone."}`,
    detectedAt: Date.now(),
  };
}

function detectDescendingTriangle(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);
  const recentHighs = recent.map(c => c.high);
  const recentLows = recent.map(c => c.low);
  const closes = candles.map(c => c.close);

  const minLow = Math.min(...recentLows);
  const lowVariance = stdDev(recentLows) / (minLow || 1);
  const highRegression = linearRegression(recentHighs);
  const isSupportFlat = lowVariance < 0.025;
  const isResistanceFalling = highRegression.slope < 0;

  if (!isSupportFlat || !isResistanceFalling) return null;

  const breakoutLevel = minLow;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice < breakoutLevel * 1.005;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isSupportFlat ? 30 : 0) +
    (isResistanceFalling ? 30 : 0) +
    (breakoutConfirmed ? 25 : 0) +
    (volumeConfirmed ? 15 : 0)
  );
  if (confidence < 45) return null;

  const resistanceTop = Math.max(...recentHighs.slice(-5));
  const patternHeight = resistanceTop - breakoutLevel;

  return {
    symbol, patternType: "descending_triangle", patternName: "Descending Triangle",
    timeframe, severity: "bearish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(breakoutLevel * 100) / 100,
    stopLossZone: Math.round(resistanceTop * 100) / 100,
    targetLevel: Math.round((breakoutLevel - patternHeight) * 100) / 100,
    description: `Descending triangle with flat support at ${breakoutLevel.toFixed(2)} and falling resistance. ${breakoutConfirmed ? "Breakdown confirmed." : "Approaching breakdown zone."}`,
    detectedAt: Date.now(),
  };
}

function detectSymmetricalTriangle(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);
  const recentHighs = recent.map(c => c.high);
  const recentLows = recent.map(c => c.low);
  const closes = candles.map(c => c.close);

  const highRegression = linearRegression(recentHighs);
  const lowRegression = linearRegression(recentLows);
  const isResistanceFalling = highRegression.slope < -0.001;
  const isSupportRising = lowRegression.slope > 0.001;
  const isConverging = isResistanceFalling && isSupportRising;

  if (!isConverging) return null;

  const currentPrice = closes[closes.length - 1];
  const projectedHigh = highRegression.intercept + highRegression.slope * (recent.length - 1);
  const projectedLow = lowRegression.intercept + lowRegression.slope * (recent.length - 1);
  const midpoint = (projectedHigh + projectedLow) / 2;
  const breakoutConfirmed = Math.abs(currentPrice - midpoint) / midpoint > 0.02;
  const severity: PatternSeverity = currentPrice > midpoint ? "bullish" : "bearish";
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isConverging ? 40 : 0) +
    (breakoutConfirmed ? 30 : 0) +
    (volumeConfirmed ? 20 : 0) +
    10
  );
  if (confidence < 50) return null;

  return {
    symbol, patternType: "symmetrical_triangle", patternName: "Symmetrical Triangle",
    timeframe, severity,
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.85),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(projectedHigh * 100) / 100,
    stopLossZone: Math.round(projectedLow * 100) / 100,
    targetLevel: Math.round((currentPrice > midpoint ? projectedHigh * 1.05 : projectedLow * 0.95) * 100) / 100,
    description: `Symmetrical triangle with converging trendlines. ${breakoutConfirmed ? `${severity === "bullish" ? "Bullish" : "Bearish"} breakout confirmed.` : "Coiling for breakout."}`,
    detectedAt: Date.now(),
  };
}

function detectBullFlag(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 25) return null;
  const closes = candles.map(c => c.close);
  const pole = candles.slice(-25, -10);
  const flag = candles.slice(-10);
  const poleCloses = pole.map(c => c.close);
  const flagCloses = flag.map(c => c.close);

  const poleGain = (poleCloses[poleCloses.length - 1] - poleCloses[0]) / poleCloses[0];
  const flagRegression = linearRegression(flagCloses);
  const isStrongPole = poleGain > 0.05;
  const isFlagConsolidating = flagRegression.slope < 0 && Math.abs(flagRegression.slope) < poleGain * 0.3;

  if (!isStrongPole || !isFlagConsolidating) return null;

  const breakoutLevel = Math.max(...pole.map(c => c.high));
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice > breakoutLevel * 0.998;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isStrongPole ? 35 : 0) +
    (isFlagConsolidating ? 30 : 0) +
    (breakoutConfirmed ? 20 : 0) +
    (volumeConfirmed ? 15 : 0)
  );
  if (confidence < 50) return null;

  const poleHeight = poleCloses[poleCloses.length - 1] - poleCloses[0];

  return {
    symbol, patternType: "bull_flag", patternName: "Bull Flag",
    timeframe, severity: "bullish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.95),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(breakoutLevel * 100) / 100,
    stopLossZone: Math.round(Math.min(...flag.map(c => c.low)) * 100) / 100,
    targetLevel: Math.round((breakoutLevel + poleHeight) * 100) / 100,
    description: `Bull flag: ${(poleGain * 100).toFixed(1)}% pole gain followed by ${Math.abs(flagRegression.slope * 100).toFixed(2)}% daily consolidation. ${breakoutConfirmed ? "Breakout confirmed." : "Awaiting breakout."}`,
    detectedAt: Date.now(),
  };
}

function detectBearFlag(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 25) return null;
  const closes = candles.map(c => c.close);
  const pole = candles.slice(-25, -10);
  const flag = candles.slice(-10);
  const poleCloses = pole.map(c => c.close);
  const flagCloses = flag.map(c => c.close);

  const poleDrop = (poleCloses[0] - poleCloses[poleCloses.length - 1]) / poleCloses[0];
  const flagRegression = linearRegression(flagCloses);
  const isStrongPole = poleDrop > 0.05;
  const isFlagConsolidating = flagRegression.slope > 0 && flagRegression.slope < poleDrop * 0.3;

  if (!isStrongPole || !isFlagConsolidating) return null;

  const breakoutLevel = Math.min(...pole.map(c => c.low));
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice < breakoutLevel * 1.002;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isStrongPole ? 35 : 0) +
    (isFlagConsolidating ? 30 : 0) +
    (breakoutConfirmed ? 20 : 0) +
    (volumeConfirmed ? 15 : 0)
  );
  if (confidence < 50) return null;

  const poleHeight = poleCloses[0] - poleCloses[poleCloses.length - 1];

  return {
    symbol, patternType: "bear_flag", patternName: "Bear Flag",
    timeframe, severity: "bearish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.95),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(breakoutLevel * 100) / 100,
    stopLossZone: Math.round(Math.max(...flag.map(c => c.high)) * 100) / 100,
    targetLevel: Math.round((breakoutLevel - poleHeight) * 100) / 100,
    description: `Bear flag: ${(poleDrop * 100).toFixed(1)}% pole drop followed by ${(flagRegression.slope * 100).toFixed(2)}% daily retracement. ${breakoutConfirmed ? "Breakdown confirmed." : "Awaiting breakdown."}`,
    detectedAt: Date.now(),
  };
}

function detectDoubleTop(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 30) return null;
  const highs = candles.map(c => c.high);
  const closes = candles.map(c => c.close);
  const maxima = findLocalMaxima(highs, 4);
  if (maxima.length < 2) return null;

  const lastTwo = maxima.slice(-2);
  const peak1 = highs[lastTwo[0]];
  const peak2 = highs[lastTwo[1]];
  const peakDiff = Math.abs(peak1 - peak2) / peak1;
  const isDoubleTop = peakDiff < 0.03;
  if (!isDoubleTop) return null;

  const necklineIdx = candles.slice(lastTwo[0], lastTwo[1]).reduce((minIdx, c, i) => c.low < candles[lastTwo[0] + minIdx].low ? i : minIdx, 0);
  const neckline = candles[lastTwo[0] + necklineIdx].low;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice < neckline * 1.005;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isDoubleTop ? 40 : 0) +
    (breakoutConfirmed ? 30 : 0) +
    (volumeConfirmed ? 20 : 0) +
    (peakDiff < 0.015 ? 10 : 0)
  );
  if (confidence < 50) return null;

  const patternHeight = ((peak1 + peak2) / 2) - neckline;

  return {
    symbol, patternType: "double_top", patternName: "Double Top",
    timeframe, severity: "bearish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(neckline * 100) / 100,
    stopLossZone: Math.round(((peak1 + peak2) / 2) * 100) / 100,
    targetLevel: Math.round((neckline - patternHeight) * 100) / 100,
    description: `Double top at ${((peak1 + peak2) / 2).toFixed(2)} with neckline at ${neckline.toFixed(2)}. Peak similarity: ${(100 - peakDiff * 100).toFixed(1)}%. ${breakoutConfirmed ? "Neckline broken." : "Watching neckline."}`,
    detectedAt: Date.now(),
  };
}

function detectDoubleBottom(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 30) return null;
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const minima = findLocalMinima(lows, 4);
  if (minima.length < 2) return null;

  const lastTwo = minima.slice(-2);
  const trough1 = lows[lastTwo[0]];
  const trough2 = lows[lastTwo[1]];
  const troughDiff = Math.abs(trough1 - trough2) / trough1;
  const isDoubleBottom = troughDiff < 0.03;
  if (!isDoubleBottom) return null;

  const necklineIdx = candles.slice(lastTwo[0], lastTwo[1]).reduce((maxIdx, c, i) => c.high > candles[lastTwo[0] + maxIdx].high ? i : maxIdx, 0);
  const neckline = candles[lastTwo[0] + necklineIdx].high;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice > neckline * 0.995;
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isDoubleBottom ? 40 : 0) +
    (breakoutConfirmed ? 30 : 0) +
    (volumeConfirmed ? 20 : 0) +
    (troughDiff < 0.015 ? 10 : 0)
  );
  if (confidence < 50) return null;

  const patternHeight = neckline - ((trough1 + trough2) / 2);

  return {
    symbol, patternType: "double_bottom", patternName: "Double Bottom",
    timeframe, severity: "bullish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(neckline * 100) / 100,
    stopLossZone: Math.round(((trough1 + trough2) / 2) * 100) / 100,
    targetLevel: Math.round((neckline + patternHeight) * 100) / 100,
    description: `Double bottom at ${((trough1 + trough2) / 2).toFixed(2)} with neckline at ${neckline.toFixed(2)}. Trough similarity: ${(100 - troughDiff * 100).toFixed(1)}%. ${breakoutConfirmed ? "Neckline broken — bullish." : "Watching neckline."}`,
    detectedAt: Date.now(),
  };
}

function detectHeadAndShoulders(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 40) return null;
  const highs = candles.map(c => c.high);
  const maxima = findLocalMaxima(highs, 3);
  if (maxima.length < 3) return null;

  const lastThree = maxima.slice(-3);
  const leftShoulder = highs[lastThree[0]];
  const head = highs[lastThree[1]];
  const rightShoulder = highs[lastThree[2]];

  const isHead = head > leftShoulder && head > rightShoulder;
  const shoulderSymmetry = Math.abs(leftShoulder - rightShoulder) / leftShoulder;
  const isSymmetric = shoulderSymmetry < 0.05;

  if (!isHead || !isSymmetric) return null;

  const closes = candles.map(c => c.close);
  const lows = candles.map(c => c.low);
  const neckline1 = Math.min(...lows.slice(lastThree[0], lastThree[1]));
  const neckline2 = Math.min(...lows.slice(lastThree[1], lastThree[2]));
  const neckline = (neckline1 + neckline2) / 2;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice < neckline * 1.005;
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isHead ? 30 : 0) +
    (isSymmetric ? 25 : 0) +
    (breakoutConfirmed ? 25 : 0) +
    (volumeConfirmed ? 20 : 0)
  );
  if (confidence < 55) return null;

  const patternHeight = head - neckline;

  return {
    symbol, patternType: "head_and_shoulders", patternName: "Head and Shoulders",
    timeframe, severity: "bearish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.95),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(neckline * 100) / 100,
    stopLossZone: Math.round(rightShoulder * 100) / 100,
    targetLevel: Math.round((neckline - patternHeight) * 100) / 100,
    description: `Head & Shoulders: L.Shoulder=${leftShoulder.toFixed(2)}, Head=${head.toFixed(2)}, R.Shoulder=${rightShoulder.toFixed(2)}, Neckline=${neckline.toFixed(2)}. ${breakoutConfirmed ? "Neckline broken — bearish." : "Watching neckline."}`,
    detectedAt: Date.now(),
  };
}

function detectInverseHeadAndShoulders(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 40) return null;
  const lows = candles.map(c => c.low);
  const minima = findLocalMinima(lows, 3);
  if (minima.length < 3) return null;

  const lastThree = minima.slice(-3);
  const leftShoulder = lows[lastThree[0]];
  const head = lows[lastThree[1]];
  const rightShoulder = lows[lastThree[2]];

  const isHead = head < leftShoulder && head < rightShoulder;
  const shoulderSymmetry = Math.abs(leftShoulder - rightShoulder) / leftShoulder;
  const isSymmetric = shoulderSymmetry < 0.05;

  if (!isHead || !isSymmetric) return null;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const neckline1 = Math.max(...highs.slice(lastThree[0], lastThree[1]));
  const neckline2 = Math.max(...highs.slice(lastThree[1], lastThree[2]));
  const neckline = (neckline1 + neckline2) / 2;
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice > neckline * 0.995;
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isHead ? 30 : 0) +
    (isSymmetric ? 25 : 0) +
    (breakoutConfirmed ? 25 : 0) +
    (volumeConfirmed ? 20 : 0)
  );
  if (confidence < 55) return null;

  const patternHeight = neckline - head;

  return {
    symbol, patternType: "inverse_head_and_shoulders", patternName: "Inverse Head and Shoulders",
    timeframe, severity: "bullish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.95),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(neckline * 100) / 100,
    stopLossZone: Math.round(rightShoulder * 100) / 100,
    targetLevel: Math.round((neckline + patternHeight) * 100) / 100,
    description: `Inverse H&S: L.Shoulder=${leftShoulder.toFixed(2)}, Head=${head.toFixed(2)}, R.Shoulder=${rightShoulder.toFixed(2)}, Neckline=${neckline.toFixed(2)}. ${breakoutConfirmed ? "Neckline broken — bullish." : "Watching neckline."}`,
    detectedAt: Date.now(),
  };
}

function detectCupAndHandle(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 50) return null;
  const closes = candles.map(c => c.close);
  const cup = candles.slice(-50, -10);
  const handle = candles.slice(-10);
  const cupCloses = cup.map(c => c.close);
  const handleCloses = handle.map(c => c.close);

  const cupLeft = cupCloses[0];
  const cupBottom = Math.min(...cupCloses);
  const cupRight = cupCloses[cupCloses.length - 1];
  const cupDepth = (cupLeft - cupBottom) / cupLeft;
  const isUShape = cupDepth > 0.1 && cupDepth < 0.4 && Math.abs(cupLeft - cupRight) / cupLeft < 0.05;

  const handleRegression = linearRegression(handleCloses);
  const isHandleConsolidating = handleRegression.slope < 0 && Math.abs(handleRegression.slope) < 0.01;
  const handleDepth = (Math.max(...handleCloses) - Math.min(...handleCloses)) / Math.max(...handleCloses);
  const isHandleShallow = handleDepth < cupDepth * 0.5;

  if (!isUShape || !isHandleConsolidating || !isHandleShallow) return null;

  const breakoutLevel = Math.max(cupLeft, cupRight);
  const currentPrice = closes[closes.length - 1];
  const breakoutConfirmed = currentPrice > breakoutLevel * 0.998;
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isUShape ? 35 : 0) +
    (isHandleConsolidating ? 25 : 0) +
    (isHandleShallow ? 15 : 0) +
    (breakoutConfirmed ? 15 : 0) +
    (volumeConfirmed ? 10 : 0)
  );
  if (confidence < 55) return null;

  return {
    symbol, patternType: "cup_and_handle", patternName: "Cup and Handle",
    timeframe, severity: "bullish",
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round(breakoutLevel * 100) / 100,
    stopLossZone: Math.round(Math.min(...handle.map(c => c.low)) * 100) / 100,
    targetLevel: Math.round((breakoutLevel + (breakoutLevel - cupBottom)) * 100) / 100,
    description: `Cup & Handle: ${(cupDepth * 100).toFixed(1)}% cup depth, ${(handleDepth * 100).toFixed(1)}% handle depth. Breakout level: ${breakoutLevel.toFixed(2)}. ${breakoutConfirmed ? "Breakout confirmed." : "Handle forming."}`,
    detectedAt: Date.now(),
  };
}

function detectBreakoutConsolidation(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);
  const closes = recent.map(c => c.close);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);

  const rangeHigh = Math.max(...highs.slice(0, -3));
  const rangeLow = Math.min(...lows.slice(0, -3));
  const rangeSize = (rangeHigh - rangeLow) / rangeHigh;
  const isConsolidating = rangeSize < 0.06;

  if (!isConsolidating) return null;

  const currentPrice = closes[closes.length - 1];
  const breakoutUp = currentPrice > rangeHigh * 0.998;
  const breakoutDown = currentPrice < rangeLow * 1.002;
  const breakoutConfirmed = breakoutUp || breakoutDown;
  const severity: PatternSeverity = breakoutUp ? "bullish" : breakoutDown ? "bearish" : "neutral";
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isConsolidating ? 35 : 0) +
    (breakoutConfirmed ? 35 : 0) +
    (volumeConfirmed ? 20 : 0) +
    (rangeSize < 0.03 ? 10 : 0)
  );
  if (confidence < 50) return null;

  const patternHeight = rangeHigh - rangeLow;

  return {
    symbol, patternType: "breakout_consolidation", patternName: "Breakout Consolidation",
    timeframe, severity,
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.85),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round((breakoutUp ? rangeHigh : rangeLow) * 100) / 100,
    stopLossZone: Math.round((breakoutUp ? rangeLow : rangeHigh) * 100) / 100,
    targetLevel: Math.round((breakoutUp ? rangeHigh + patternHeight : rangeLow - patternHeight) * 100) / 100,
    description: `${(rangeSize * 100).toFixed(1)}% consolidation range (${rangeLow.toFixed(2)}-${rangeHigh.toFixed(2)}). ${breakoutConfirmed ? `${severity === "bullish" ? "Bullish" : "Bearish"} breakout confirmed.` : "Coiling within range."}`,
    detectedAt: Date.now(),
  };
}

function detectSupportResistanceBreakout(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 30) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Find key support/resistance levels using price clustering
  const historicalHighs = highs.slice(0, -5);
  const historicalLows = lows.slice(0, -5);
  const resistance = Math.max(...historicalHighs);
  const support = Math.min(...historicalLows);
  const currentPrice = closes[closes.length - 1];

  const resistanceBreak = currentPrice > resistance * 0.995;
  const supportBreak = currentPrice < support * 1.005;
  const breakoutConfirmed = resistanceBreak || supportBreak;
  const severity: PatternSeverity = resistanceBreak ? "bullish" : supportBreak ? "bearish" : "neutral";

  if (!breakoutConfirmed) return null;

  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    55 +
    (volumeConfirmed ? 25 : 0) +
    (resistanceBreak && currentPrice > resistance ? 20 : 0)
  );
  if (confidence < 55) return null;

  return {
    symbol, patternType: "support_resistance_breakout", patternName: "Support/Resistance Breakout",
    timeframe, severity,
    confidenceScore: Math.min(100, confidence),
    patternStrength: Math.round(Math.min(100, confidence) * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: !volumeConfirmed,
    breakoutLevel: Math.round((resistanceBreak ? resistance : support) * 100) / 100,
    stopLossZone: Math.round((resistanceBreak ? resistance * 0.97 : support * 1.03) * 100) / 100,
    targetLevel: Math.round((resistanceBreak ? resistance * 1.05 : support * 0.95) * 100) / 100,
    description: `${resistanceBreak ? "Resistance" : "Support"} breakout at ${(resistanceBreak ? resistance : support).toFixed(2)}. ${volumeConfirmed ? "Volume confirmed." : "Low volume — watch for false breakout."}`,
    detectedAt: Date.now(),
  };
}

function detectChannelBreakout(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 25) return null;
  const recent = candles.slice(-25);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const closes = candles.map(c => c.close);

  const highRegression = linearRegression(highs);
  const lowRegression = linearRegression(lows);
  const channelWidth = (highRegression.intercept - lowRegression.intercept) / highRegression.intercept;
  const isParallel = Math.abs(highRegression.slope - lowRegression.slope) / Math.abs(highRegression.slope + 0.0001) < 0.3;
  const isChannel = isParallel && channelWidth > 0.02 && channelWidth < 0.15;

  if (!isChannel) return null;

  const currentPrice = closes[closes.length - 1];
  const projectedHigh = highRegression.intercept + highRegression.slope * (recent.length - 1);
  const projectedLow = lowRegression.intercept + lowRegression.slope * (recent.length - 1);
  const breakoutUp = currentPrice > projectedHigh * 0.998;
  const breakoutDown = currentPrice < projectedLow * 1.002;
  const breakoutConfirmed = breakoutUp || breakoutDown;
  const severity: PatternSeverity = breakoutUp ? "bullish" : breakoutDown ? "bearish" : "neutral";
  const volumeConfirmed = isVolumeSpike(candles);

  const confidence = Math.round(
    (isChannel ? 35 : 0) +
    (breakoutConfirmed ? 35 : 0) +
    (volumeConfirmed ? 20 : 0) +
    10
  );
  if (confidence < 55) return null;

  return {
    symbol, patternType: "channel_breakout", patternName: "Channel Breakout",
    timeframe, severity,
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.9),
    volumeConfirmed, breakoutConfirmed,
    isFalseBreakout: breakoutConfirmed && !volumeConfirmed,
    breakoutLevel: Math.round((breakoutUp ? projectedHigh : projectedLow) * 100) / 100,
    stopLossZone: Math.round((breakoutUp ? projectedLow : projectedHigh) * 100) / 100,
    targetLevel: Math.round((breakoutUp ? projectedHigh * 1.05 : projectedLow * 0.95) * 100) / 100,
    description: `${highRegression.slope > 0 ? "Ascending" : highRegression.slope < 0 ? "Descending" : "Horizontal"} channel breakout. Channel width: ${(channelWidth * 100).toFixed(1)}%. ${breakoutConfirmed ? `${severity === "bullish" ? "Bullish" : "Bearish"} breakout.` : "Within channel."}`,
    detectedAt: Date.now(),
  };
}

function detectTrendlineBreakout(candles: Candle[], symbol: string, timeframe: Timeframe): PatternResult | null {
  if (candles.length < 20) return null;
  const closes = candles.map(c => c.close);
  const recent = closes.slice(-20);
  const regression = linearRegression(recent);
  const currentPrice = closes[closes.length - 1];
  const projectedPrice = regression.intercept + regression.slope * (recent.length - 1);
  const deviation = (currentPrice - projectedPrice) / projectedPrice;

  const isTrending = Math.abs(regression.slope) > 0.005;
  const isBreakout = Math.abs(deviation) > 0.025;

  if (!isTrending || !isBreakout) return null;

  const severity: PatternSeverity = deviation > 0 ? "bullish" : "bearish";
  const volumeConfirmed = isVolumeSpike(candles);
  const confidence = Math.round(
    (isTrending ? 30 : 0) +
    (isBreakout ? 30 : 0) +
    (volumeConfirmed ? 25 : 0) +
    (Math.abs(deviation) > 0.05 ? 15 : 0)
  );
  if (confidence < 50) return null;

  return {
    symbol, patternType: "trendline_breakout", patternName: "Trendline Breakout",
    timeframe, severity,
    confidenceScore: confidence,
    patternStrength: Math.round(confidence * 0.85),
    volumeConfirmed, breakoutConfirmed: true,
    isFalseBreakout: !volumeConfirmed,
    breakoutLevel: Math.round(projectedPrice * 100) / 100,
    stopLossZone: Math.round(projectedPrice * (severity === "bullish" ? 0.97 : 1.03) * 100) / 100,
    targetLevel: Math.round(currentPrice * (severity === "bullish" ? 1.05 : 0.95) * 100) / 100,
    description: `${regression.slope > 0 ? "Uptrend" : "Downtrend"} trendline breakout. Deviation: ${(deviation * 100).toFixed(1)}% from trendline. ${volumeConfirmed ? "Volume confirmed." : "Low volume — caution."}`,
    detectedAt: Date.now(),
  };
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

const ALL_DETECTORS: Array<(candles: Candle[], symbol: string, timeframe: Timeframe) => PatternResult | null> = [
  detectAscendingTriangle,
  detectDescendingTriangle,
  detectSymmetricalTriangle,
  detectBullFlag,
  detectBearFlag,
  detectDoubleTop,
  detectDoubleBottom,
  detectHeadAndShoulders,
  detectInverseHeadAndShoulders,
  detectCupAndHandle,
  detectBreakoutConsolidation,
  detectSupportResistanceBreakout,
  detectChannelBreakout,
  detectTrendlineBreakout,
];

export function scanAssetForPatterns(
  symbol: string,
  basePrice: number,
  options: PatternScanOptions = {}
): PatternResult[] {
  const {
    timeframes = ["1d", "4h"],
    minConfidence = 50,
    requireVolumeConfirmation = false,
    filterFalseBreakouts = true,
    maxResultsPerAsset = 3,
  } = options;

  const results: PatternResult[] = [];
  const symbolSeed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  for (const timeframe of timeframes) {
    const candleCount = 60;
    // Use different trend seeds per timeframe to get varied patterns
    const trendSeed = (symbolSeed % 5) - 2; // -2 to +2
    const candles = generateCandleSeries(basePrice, symbol, candleCount, trendSeed * 0.3, timeframe, symbolSeed);

    for (const detector of ALL_DETECTORS) {
      try {
        const result = detector(candles, symbol, timeframe);
        if (!result) continue;
        if (result.confidenceScore < minConfidence) continue;
        if (requireVolumeConfirmation && !result.volumeConfirmed) continue;
        if (filterFalseBreakouts && result.isFalseBreakout) continue;
        results.push(result);
      } catch {
        // Silently skip failed detectors
      }
    }
  }

  // Sort by confidence, deduplicate by pattern type + timeframe, limit per asset
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .filter(r => {
      const key = `${r.patternType}:${r.timeframe}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxResultsPerAsset);
}

export function runPatternScanner(
  assets: Array<{ symbol: string; basePrice?: number; sector?: string | null }>,
  options: PatternScanOptions = {}
): PatternResult[] {
  const allResults: PatternResult[] = [];

  for (const asset of assets) {
    const basePrice = asset.basePrice ?? 1000;
    const results = scanAssetForPatterns(asset.symbol, basePrice, options);
    allResults.push(...results);
  }

  return allResults.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export const PATTERN_NAMES: Record<PatternType, string> = {
  ascending_triangle: "Ascending Triangle",
  descending_triangle: "Descending Triangle",
  symmetrical_triangle: "Symmetrical Triangle",
  bull_flag: "Bull Flag",
  bear_flag: "Bear Flag",
  cup_and_handle: "Cup and Handle",
  double_top: "Double Top",
  double_bottom: "Double Bottom",
  head_and_shoulders: "Head and Shoulders",
  inverse_head_and_shoulders: "Inverse Head and Shoulders",
  breakout_consolidation: "Breakout Consolidation",
  support_resistance_breakout: "Support/Resistance Breakout",
  channel_breakout: "Channel Breakout",
  trendline_breakout: "Trendline Breakout",
};
