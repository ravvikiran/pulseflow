/**
 * PulseFlow Yahoo Finance Integration
 * Provides real market data for NSE India, Crypto, and US stocks.
 *
 * Symbol mapping:
 * - NSE India: RELIANCE.NS, TCS.NS, HDFCBANK.NS
 * - BSE India: RELIANCE.BO (fallback if .NS fails)
 * - Crypto: BTC-USD, ETH-USD, SOL-USD
 * - US: AAPL, MSFT, GOOGL (plain tickers)
 * - Indices: ^NSEI (Nifty50), ^BSESN (Sensex), ^GSPC (S&P500)
 */

import YahooFinance from "yahoo-finance2";

// Initialize Yahoo Finance v3
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

// ─── Symbol Mapping ───────────────────────────────────────────────────────────

const NSE_SUFFIX = ".NS";

const INDEX_MAP: Record<string, string> = {
  NIFTY50: "^NSEI",
  SENSEX: "^BSESN",
  NIFTYBANK: "^NSEBANK",
  NIFTYIT: "^CNXIT",
  NIFTYPHARMA: "^CNXPHARMA",
  NIFTYMETAL: "^CNXMETAL",
  NIFTYAUTO: "^CNXAUTO",
  NIFTYFMCG: "^CNXFMCG",
  NIFTYMIDCAP: "NIFTY_MIDCAP_100.NS",
  NIFTYSMALLCAP: "NIFTY_SMLCAP_100.NS",
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  RUT: "^RUT",
  VIX: "^VIX",
};

const CRYPTO_MAP: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  BNB: "BNB-USD",
  XRP: "XRP-USD",
  ADA: "ADA-USD",
  AVAX: "AVAX-USD",
  DOGE: "DOGE-USD",
  DOT: "DOT-USD",
  MATIC: "MATIC-USD",
  ATOM: "ATOM-USD",
  NEAR: "NEAR-USD",
  APT: "APT-USD",
  SUI: "SUI-USD",
  ARB: "ARB-USD",
  OP: "OP-USD",
  IMX: "IMX-USD",
  UNI: "UNI-USD",
  AAVE: "AAVE-USD",
  LINK: "LINK-USD",
  MKR: "MKR-USD",
  CRV: "CRV-USD",
  OKB: "OKB-USD",
  LTC: "LTC-USD",
  XLM: "XLM-USD",
  XMR: "XMR-USD",
  SHIB: "SHIB-USD",
  PEPE: "PEPE-USD",
  AXS: "AXS-USD",
  SAND: "SAND-USD",
};

// US stocks use plain ticker (no suffix needed)
const US_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC",
  "JPM", "BAC", "GS", "V", "JNJ", "UNH", "PFE", "XOM", "CVX",
  "KO", "PG", "WMT", "BA", "CAT", "VZ", "T",
]);

/**
 * Convert our internal symbol to Yahoo Finance ticker
 */
export function toYahooSymbol(symbol: string): string {
  // Check index map first
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  // Check crypto map
  if (CRYPTO_MAP[symbol]) return CRYPTO_MAP[symbol];
  // US stocks
  if (US_TICKERS.has(symbol)) return symbol;
  // Default: assume NSE India stock
  return `${symbol}${NSE_SUFFIX}`;
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const quoteCache = new Map<string, CacheEntry<QuoteResult>>();
const historyCache = new Map<string, CacheEntry<HistoryCandle[]>>();

const QUOTE_CACHE_MS = 60 * 1000; // 1 minute for quotes
const HISTORY_CACHE_MS = 5 * 60 * 1000; // 5 minutes for historical data
const MAX_CACHE_SIZE = 500; // Maximum entries per cache

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string, maxAge: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAge) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  // Evict oldest entries if cache is too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < Math.floor(MAX_CACHE_SIZE * 0.3); i++) {
      cache.delete(oldest[i][0]);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  marketCap?: number;
  timestamp: number;
}

export interface HistoryCandle {
  timestamp: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Get real-time quote for a single symbol
 */
export async function getQuote(symbol: string): Promise<QuoteResult | null> {
  const yahooTicker = toYahooSymbol(symbol);

  // Check cache
  const cached = getCached(quoteCache, symbol, QUOTE_CACHE_MS);
  if (cached) return cached;

  try {
    const quote = await yahooFinance.quote(yahooTicker);

    if (!quote || !quote.regularMarketPrice) return null;

    const result: QuoteResult = {
      symbol,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      open: quote.regularMarketOpen ?? quote.regularMarketPrice,
      high: quote.regularMarketDayHigh ?? quote.regularMarketPrice,
      low: quote.regularMarketDayLow ?? quote.regularMarketPrice,
      volume: quote.regularMarketVolume ?? 0,
      previousClose: quote.regularMarketPreviousClose ?? quote.regularMarketPrice,
      marketCap: quote.marketCap ?? undefined,
      timestamp: Date.now(),
    };

    setCache(quoteCache, symbol, result);
    return result;
  } catch (error) {
    console.warn(`[Yahoo] Quote failed for ${symbol} (${yahooTicker}):`, (error as Error).message);
    return null;
  }
}

/**
 * Get quotes for multiple symbols (batched)
 */
export async function getQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  const uncached: string[] = [];

  // Return cached results first
  for (const symbol of symbols) {
    const cached = getCached(quoteCache, symbol, QUOTE_CACHE_MS);
    if (cached) {
      results.set(symbol, cached);
    } else {
      uncached.push(symbol);
    }
  }

  if (uncached.length === 0) return results;

  // Fetch uncached in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < uncached.length; i += batchSize) {
    const batch = uncached.slice(i, i + batchSize);
    const yahooTickers = batch.map(toYahooSymbol);

    try {
      const quotes = await yahooFinance.quote(yahooTickers);
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

      for (let j = 0; j < batch.length; j++) {
        const q = quotesArray[j];
        if (!q || !q.regularMarketPrice) continue;

        const result: QuoteResult = {
          symbol: batch[j],
          price: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          open: q.regularMarketOpen ?? q.regularMarketPrice,
          high: q.regularMarketDayHigh ?? q.regularMarketPrice,
          low: q.regularMarketDayLow ?? q.regularMarketPrice,
          volume: q.regularMarketVolume ?? 0,
          previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
          marketCap: q.marketCap ?? undefined,
          timestamp: Date.now(),
        };

        setCache(quoteCache, batch[j], result);
        results.set(batch[j], result);
      }
    } catch (error) {
      console.warn(`[Yahoo] Batch quote failed:`, (error as Error).message);
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < uncached.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

/**
 * Get historical OHLCV data for a symbol
 */
export async function getHistory(
  symbol: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y" = "1y",
  interval: "1d" | "1wk" | "1mo" = "1d"
): Promise<HistoryCandle[]> {
  const cacheKey = `${symbol}:${period}:${interval}`;

  // Check cache
  const cached = getCached(historyCache, cacheKey, HISTORY_CACHE_MS);
  if (cached) return cached;

  const yahooTicker = toYahooSymbol(symbol);

  try {
    const result = await yahooFinance.chart(yahooTicker, {
      period1: getStartDate(period),
      period2: new Date(),
      interval,
    });

    if (!result || !result.quotes || result.quotes.length === 0) return [];

    const candles: HistoryCandle[] = result.quotes
      .filter((r: any) => r.open != null && r.close != null)
      .map((r: any) => ({
        timestamp: r.date.toISOString(),
        open: r.open!,
        high: r.high!,
        low: r.low!,
        close: r.close!,
        volume: r.volume ?? 0,
      }));

    setCache(historyCache, cacheKey, candles);
    return candles;
  } catch (error) {
    // Only warn once per symbol to avoid console spam
    if (!historyFailedSet.has(symbol)) {
      historyFailedSet.add(symbol);
      console.warn(`[Yahoo] History unavailable for ${symbol} (${yahooTicker})`);
    }
    return [];
  }
}

const historyFailedSet = new Set<string>();
const MAX_FAILED_SET_SIZE = 200;

// Periodic cleanup of the failed set (every 30 min, allow retries)
setInterval(() => { historyFailedSet.clear(); }, 30 * 60 * 1000);

function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1mo": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3mo": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6mo": return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "2y": return new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Get current price data formatted for PulseFlow's existing interface
 * (drop-in replacement for generateCurrentPrice)
 */
export async function getRealPrice(symbol: string): Promise<{
  price: number; change: number; changePercent: number;
  volume: number; high: number; low: number; open: number;
} | null> {
  const quote = await getQuote(symbol);
  if (!quote) return null;
  return {
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    high: quote.high,
    low: quote.low,
    open: quote.open,
  };
}

/**
 * Get prices for multiple symbols, returning results in the same format
 * as the old generateCurrentPrice but with real data.
 * Falls back to simulated data for symbols that fail.
 */
export async function getRealPrices(symbols: string[]): Promise<Map<string, {
  price: number; change: number; changePercent: number;
  volume: number; high: number; low: number; open: number;
}>> {
  const quotes = await getQuotes(symbols);
  const results = new Map<string, { price: number; change: number; changePercent: number; volume: number; high: number; low: number; open: number }>();

  for (const [sym, q] of quotes) {
    results.set(sym, {
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      volume: q.volume,
      high: q.high,
      low: q.low,
      open: q.open,
    });
  }

  return results;
}
