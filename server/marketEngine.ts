/**
 * PulseFlow Market Engine
 * Rule-based market analysis: momentum, relative strength, volume, breakout detection
 * No AI/ML — pure statistical and technical analysis
 */

import { getAssetBySymbol as registryLookup } from "./assetRegistry";

export const SECTORS = [
  "Information Technology",
  "Banking & Finance",
  "Energy & Oil",
  "Healthcare & Pharma",
  "Consumer Goods",
  "Metals & Mining",
  "Automobile",
  "Real Estate",
  "Telecom",
  "FMCG",
  "Cryptocurrency",
  "Infrastructure",
];

export const NSE_STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy & Oil", exchange: "NSE", currency: "INR" },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "Information Technology", exchange: "NSE", currency: "INR" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR" },
  { symbol: "INFY", name: "Infosys", sector: "Information Technology", exchange: "NSE", currency: "INR" },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG", exchange: "NSE", currency: "INR" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking & Finance", exchange: "NSE", currency: "INR" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking & Finance", exchange: "NSE", currency: "INR" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom", exchange: "NSE", currency: "INR" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR" },
  { symbol: "WIPRO", name: "Wipro", sector: "Information Technology", exchange: "NSE", currency: "INR" },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "Information Technology", exchange: "NSE", currency: "INR" },
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Consumer Goods", exchange: "NSE", currency: "INR" },
  { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Automobile", exchange: "NSE", currency: "INR" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR" },
  { symbol: "TITAN", name: "Titan Company", sector: "Consumer Goods", exchange: "NSE", currency: "INR" },
  { symbol: "ONGC", name: "Oil and Natural Gas Corp", sector: "Energy & Oil", exchange: "NSE", currency: "INR" },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Automobile", exchange: "NSE", currency: "INR" },
  { symbol: "POWERGRID", name: "Power Grid Corporation", sector: "Infrastructure", exchange: "NSE", currency: "INR" },
  { symbol: "NTPC", name: "NTPC", sector: "Infrastructure", exchange: "NSE", currency: "INR" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR" },
  { symbol: "CIPLA", name: "Cipla", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR" },
  { symbol: "TATASTEEL", name: "Tata Steel", sector: "Metals & Mining", exchange: "NSE", currency: "INR" },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metals & Mining", exchange: "NSE", currency: "INR" },
  { symbol: "COALINDIA", name: "Coal India", sector: "Metals & Mining", exchange: "NSE", currency: "INR" },
  { symbol: "DLF", name: "DLF", sector: "Real Estate", exchange: "NSE", currency: "INR" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Infrastructure", exchange: "NSE", currency: "INR" },
  { symbol: "NESTLEIND", name: "Nestle India", sector: "FMCG", exchange: "NSE", currency: "INR" },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "Information Technology", exchange: "NSE", currency: "INR" },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Infrastructure", exchange: "NSE", currency: "INR" },
];

export const CRYPTO_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "ETH", name: "Ethereum", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "BNB", name: "Binance Coin", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "SOL", name: "Solana", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "XRP", name: "Ripple", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "ADA", name: "Cardano", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "AVAX", name: "Avalanche", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "DOGE", name: "Dogecoin", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "DOT", name: "Polkadot", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
  { symbol: "MATIC", name: "Polygon", sector: "Cryptocurrency", exchange: "CRYPTO", currency: "USD" },
];

export const INDICES = [
  { symbol: "NIFTY50", name: "Nifty 50", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "SENSEX", name: "BSE Sensex", sector: "Index", exchange: "BSE", currency: "INR" },
  { symbol: "NIFTYBANK", name: "Nifty Bank", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "NIFTYIT", name: "Nifty IT", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "NIFTYPHARMA", name: "Nifty Pharma", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "NIFTYMETAL", name: "Nifty Metal", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "NIFTYAUTO", name: "Nifty Auto", sector: "Index", exchange: "NSE", currency: "INR" },
  { symbol: "NIFTYFMCG", name: "Nifty FMCG", sector: "Index", exchange: "NSE", currency: "INR" },
];

// Seeded random for deterministic demo data
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate realistic price based on symbol — checks static map first, then registries
function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    RELIANCE: 2850, TCS: 3920, HDFCBANK: 1680, INFY: 1750, ICICIBANK: 1240,
    HINDUNILVR: 2450, SBIN: 820, BAJFINANCE: 7200, BHARTIARTL: 1580, KOTAKBANK: 1890,
    WIPRO: 465, HCLTECH: 1620, ASIANPAINT: 2680, MARUTI: 12800, SUNPHARMA: 1720,
    TITAN: 3450, ONGC: 285, TATAMOTORS: 980, POWERGRID: 340, NTPC: 380,
    DRREDDY: 6200, CIPLA: 1580, TATASTEEL: 165, JSWSTEEL: 920, COALINDIA: 480,
    DLF: 820, ULTRACEMCO: 10200, NESTLEIND: 2450, TECHM: 1580, ADANIENT: 2850,
    BTC: 67500, ETH: 3450, BNB: 580, SOL: 185, XRP: 0.62,
    ADA: 0.48, AVAX: 38, DOGE: 0.18, DOT: 8.5, MATIC: 0.72,
    NIFTY50: 24800, SENSEX: 81500, NIFTYBANK: 52000, NIFTYIT: 38000,
    NIFTYPHARMA: 21000, NIFTYMETAL: 9800, NIFTYAUTO: 24000, NIFTYFMCG: 58000,
  };
  if (prices[symbol]) return prices[symbol];

  // Fallback: look up base price from asset registries
  const asset = registryLookup(symbol);
  if (asset && (asset as any).basePrice) return (asset as any).basePrice;
  return 1000;
}

// Generate OHLCV candle with realistic variation
export function generateCandle(basePrice: number, seed: number, trend: number = 0) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  const r4 = seededRandom(seed + 3);

  const volatility = basePrice * 0.015;
  const trendBias = trend * basePrice * 0.003;

  const open = basePrice + (r1 - 0.5) * volatility + trendBias;
  const close = open + (r2 - 0.45) * volatility + trendBias;
  const high = Math.max(open, close) + r3 * volatility * 0.5;
  const low = Math.min(open, close) - r4 * volatility * 0.5;
  const volume = Math.floor((500000 + r1 * 2000000) * (1 + Math.abs(close - open) / basePrice * 10));

  return { open, high, low, close, volume };
}

// Calculate EMA
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

// Calculate RSI
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Detect EMA alignment (bullish: price > EMA20 > EMA50 > EMA200)
export function detectEMAAlignment(price: number, ema20: number, ema50: number, ema200: number): "bullish" | "bearish" | "mixed" {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return "bullish";
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return "bearish";
  return "mixed";
}

// Detect volume spike (current > N * average)
export function detectVolumeSpike(currentVolume: number, avgVolume: number, threshold = 2.0): boolean {
  return currentVolume > avgVolume * threshold;
}

// Detect 52-week high breakout
export function detect52wHighBreakout(currentPrice: number, high52w: number): boolean {
  return currentPrice >= high52w * 0.99; // within 1% of 52w high
}

// Detect ATH breakout
export function detectATHBreakout(currentPrice: number, ath: number): boolean {
  return currentPrice >= ath * 0.98;
}

// Calculate momentum score (0-100)
export function calculateMomentumScore(
  priceChange1d: number, priceChange1w: number, priceChange1m: number,
  rsi: number, volumeRatio: number
): number {
  const priceScore = Math.min(100, Math.max(0, 50 + priceChange1m * 2));
  const rsiScore = rsi > 50 ? Math.min(100, (rsi - 50) * 2) : 0;
  const volumeScore = Math.min(100, (volumeRatio - 1) * 50);
  return Math.round(priceScore * 0.4 + rsiScore * 0.35 + volumeScore * 0.25);
}

// Calculate relative strength vs benchmark
export function calculateRelativeStrength(assetReturn: number, benchmarkReturn: number): number {
  return assetReturn - benchmarkReturn;
}

// Generate realistic market data for a symbol
export function generateMarketData(symbol: string, days = 90) {
  const basePrice = getBasePrice(symbol);
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const trend = seededRandom(seed * 7) > 0.5 ? 1 : -1;

  const candles = [];
  let price = basePrice * (0.85 + seededRandom(seed) * 0.3);

  for (let i = days; i >= 0; i--) {
    const dayTrend = trend * (seededRandom(seed + i * 3) > 0.4 ? 1 : -0.5);
    const candle = generateCandle(price, seed + i, dayTrend);
    price = candle.close;
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    candles.push({ ...candle, timestamp: date });
  }
  return candles;
}

// Generate current market snapshot (live-like data)
export function generateCurrentPrice(symbol: string): {
  price: number; change: number; changePercent: number; volume: number;
  high: number; low: number; open: number;
} {
  const base = getBasePrice(symbol);
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = Date.now();
  const minuteSeed = Math.floor(now / 60000);

  const changePercent = (seededRandom(seed + minuteSeed) - 0.48) * 8;
  const price = base * (1 + changePercent / 100);
  const open = base * (1 + (seededRandom(seed + minuteSeed - 1) - 0.5) * 0.02);
  const high = Math.max(price, open) * (1 + seededRandom(seed + minuteSeed + 1) * 0.01);
  const low = Math.min(price, open) * (1 - seededRandom(seed + minuteSeed + 2) * 0.01);
  const volume = Math.floor(500000 + seededRandom(seed + minuteSeed + 3) * 3000000);

  return {
    price: Math.round(price * 100) / 100,
    change: Math.round((price - open) * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    open: Math.round(open * 100) / 100,
  };
}

// Generate sector performance data
export function generateSectorPerformance(sector: string) {
  const seed = sector.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = Date.now();
  const hourSeed = Math.floor(now / 3600000);

  const priceChange1d = (seededRandom(seed + hourSeed) - 0.45) * 6;
  const priceChange1w = (seededRandom(seed + hourSeed + 1) - 0.45) * 12;
  const priceChange1m = (seededRandom(seed + hourSeed + 2) - 0.45) * 20;
  const volumeScore = Math.round(seededRandom(seed + hourSeed + 3) * 100);
  const breakoutFrequency = Math.round(seededRandom(seed + hourSeed + 4) * 30);
  const momentumScore = Math.round(Math.max(0, Math.min(100, 50 + priceChange1m * 2)));
  const strengthScore = Math.round(seededRandom(seed + hourSeed + 5) * 100);
  const inflowOutflow = (seededRandom(seed + hourSeed + 6) - 0.5) * 2000;

  return {
    sector,
    priceChange1d: Math.round(priceChange1d * 100) / 100,
    priceChange1w: Math.round(priceChange1w * 100) / 100,
    priceChange1m: Math.round(priceChange1m * 100) / 100,
    momentumScore,
    strengthScore,
    volumeScore,
    breakoutFrequency: Math.round(breakoutFrequency * 100) / 100,
    inflowOutflow: Math.round(inflowOutflow * 100) / 100,
    performanceScore: Math.round((momentumScore * 0.4 + strengthScore * 0.3 + volumeScore * 0.3) * 100) / 100,
  };
}

// Generate market sentiment
export function generateMarketSentiment() {
  const now = Date.now();
  const hourSeed = Math.floor(now / 3600000);

  const advanceCount = Math.floor(100 + seededRandom(hourSeed) * 300);
  const declineCount = Math.floor(50 + seededRandom(hourSeed + 1) * 250);
  const unchangedCount = Math.floor(10 + seededRandom(hourSeed + 2) * 40);
  const adRatio = advanceCount / Math.max(1, declineCount);
  const breadthScore = Math.round(((adRatio - 1) / 2 + 0.5) * 100 * 100) / 100;
  const sentimentScore = Math.round((adRatio > 1 ? Math.min(100, (adRatio - 1) * 40) : Math.max(-100, (adRatio - 1) * 40)) * 100) / 100;
  const marketState: "bullish" | "bearish" | "neutral" = sentimentScore > 20 ? "bullish" : sentimentScore < -20 ? "bearish" : "neutral";
  const volatilityIndex = Math.round((12 + seededRandom(hourSeed + 3) * 20) * 100) / 100;
  const btcDominance = Math.round((44 + seededRandom(hourSeed + 4) * 10) * 100) / 100;
  const fearGreedIndex = Math.round((30 + seededRandom(hourSeed + 5) * 50) * 100) / 100;

  return {
    sentimentScore, marketState, advanceCount, declineCount, unchangedCount,
    advanceDeclineRatio: Math.round(adRatio * 10000) / 10000,
    breadthScore: Math.min(100, Math.max(0, breadthScore)),
    volatilityIndex, btcDominance,
    totalMarketCap: 2850000000000,
    fearGreedIndex,
  };
}

// Run scanner logic on assets
export function runScanner(
  assets: Array<{ symbol: string; sector?: string | null }>,
  scanType: string,
  timeframe: string,
  filters: { sector?: string; minVolumeRatio?: number }
) {
  const results = [];
  const now = Date.now();
  const hourSeed = Math.floor(now / 3600000);

  for (const asset of assets) {
    if (filters.sector && asset.sector !== filters.sector) continue;

    const seed = asset.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const basePrice = getBasePrice(asset.symbol);
    const r = seededRandom(seed + hourSeed);

    const ema20 = basePrice * (0.97 + seededRandom(seed + 1) * 0.06);
    const ema50 = basePrice * (0.94 + seededRandom(seed + 2) * 0.06);
    const ema200 = basePrice * (0.88 + seededRandom(seed + 3) * 0.12);
    const price = basePrice * (0.98 + seededRandom(seed + hourSeed) * 0.04);
    const volumeRatio = 0.5 + seededRandom(seed + hourSeed + 1) * 3;
    const rsi = 30 + seededRandom(seed + hourSeed + 2) * 50;
    const priceChange = (seededRandom(seed + hourSeed + 3) - 0.45) * 8;
    const high52w = basePrice * (1.05 + seededRandom(seed + 4) * 0.2);
    const ath = basePrice * (1.1 + seededRandom(seed + 5) * 0.5);

    let score = 0;
    let matches = false;

    switch (scanType) {
      case "ema_alignment":
        if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
          matches = true;
          score = Math.round(60 + r * 40);
        }
        break;
      case "volume_spike":
        if (volumeRatio >= (filters.minVolumeRatio ?? 2.0)) {
          matches = true;
          score = Math.round(Math.min(100, volumeRatio * 30));
        }
        break;
      case "breakout_52w":
        if (price >= high52w * 0.99) {
          matches = true;
          score = Math.round(70 + r * 30);
        }
        break;
      case "breakout_ath":
        if (price >= ath * 0.98) {
          matches = true;
          score = Math.round(80 + r * 20);
        }
        break;
      case "momentum_continuation":
        if (rsi > 55 && priceChange > 2 && volumeRatio > 1.3) {
          matches = true;
          score = Math.round(calculateMomentumScore(priceChange, priceChange * 2, priceChange * 4, rsi, volumeRatio));
        }
        break;
      case "relative_strength":
        const rs = priceChange - 1.5; // vs benchmark
        if (rs > 0) {
          matches = true;
          score = Math.round(50 + rs * 10);
        }
        break;
      case "consolidation_breakout":
        const atr = basePrice * 0.015;
        const range = (high52w - basePrice * 0.8) * 0.1;
        if (range < atr * 3 && price > ema20) {
          matches = true;
          score = Math.round(55 + r * 35);
        }
        break;
    }

    if (matches) {
      results.push({
        symbol: asset.symbol,
        score,
        details: {
          ema20: Math.round(ema20 * 100) / 100,
          ema50: Math.round(ema50 * 100) / 100,
          ema200: Math.round(ema200 * 100) / 100,
          volumeRatio: Math.round(volumeRatio * 100) / 100,
          rsi: Math.round(rsi * 100) / 100,
          priceChange: Math.round(priceChange * 100) / 100,
          relativeStrength: Math.round((priceChange - 1.5) * 100) / 100,
        },
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
