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
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  RUT: "^RUT",
  VIX: "^VIX",
  INDIAVIX: "^INDIAVIX",
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
  // Yahoo uses CoinMarketCap-ID suffixed tickers when a symbol is ambiguous.
  // Plain "ARB-USD" is a different token; MATIC was rebranded to POL.
  MATIC: "POL28321-USD",
  ATOM: "ATOM-USD",
  NEAR: "NEAR-USD",
  APT: "APT21794-USD",
  SUI: "SUI20947-USD",
  ARB: "ARB11841-USD",
  OP: "OP-USD",
  IMX: "IMX10603-USD",
  UNI: "UNI7083-USD",
  AAVE: "AAVE-USD",
  LINK: "LINK-USD",
  MKR: "MKR-USD",
  CRV: "CRV-USD",
  OKB: "OKB-USD",
  LTC: "LTC-USD",
  XLM: "XLM-USD",
  XMR: "XMR-USD",
  SHIB: "SHIB-USD",
  PEPE: "PEPE24478-USD",
  AXS: "AXS-USD",
  SAND: "SAND-USD",
};

// US stocks use plain ticker (no suffix needed)
const US_TICKERS = new Set([
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC",
  "JPM", "BAC", "GS", "V", "JNJ", "UNH", "PFE", "XOM", "CVX",
  "KO", "PG", "WMT", "BA", "CAT", "VZ", "T",
]);

// Commodities Yahoo Finance tickers
const COMMODITY_MAP: Record<string, string> = {
  GOLD: "GC=F",
  SILVER: "SI=F",
  PLATINUM: "PL=F",
  CRUDE_OIL: "CL=F",
  BRENT: "BZ=F",
  NATURAL_GAS: "NG=F",
  COPPER: "HG=F",
  ALUMINIUM: "ALI=F",
};

/**
 * Convert our internal symbol to Yahoo Finance ticker
 */
export function toYahooSymbol(symbol: string): string {
  // Check index map first
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  // Check crypto map
  if (CRYPTO_MAP[symbol]) return CRYPTO_MAP[symbol];
  // Check commodities
  if (COMMODITY_MAP[symbol]) return COMMODITY_MAP[symbol];
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
const HISTORY_CACHE_MS = 30 * 60 * 1000; // daily candles barely change intraday; 30 minutes
const MAX_CACHE_SIZE = 1500; // Maximum entries per cache

// Upstream timeouts so a hung Yahoo request can't hang the API response.
const QUOTE_TIMEOUT_MS = 10_000;
const HISTORY_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Yahoo ${label} timed out after ${ms}ms`)), ms);
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Request limiter ──────────────────────────────────────────────────────────
// Yahoo is free but throttles aggressive clients. All upstream calls share one
// small pool so concurrent dashboards can't burst, and transient failures
// (429, network) are retried with backoff. Speed is traded for reliability.
const MAX_CONCURRENT = 4;
const MIN_GAP_MS = 120;
let active = 0;
let lastStart = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(resolve => waiters.push(resolve));
  active++;
  const wait = lastStart + MIN_GAP_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + MIN_GAP_MS);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

function release(): void {
  active--;
  waiters.shift()?.();
}

function isTransient(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error).toLowerCase();
  return /429|too many|timed out|timeout|econnreset|etimedout|enotfound|fetch failed|socket|5\d\d/.test(msg);
}

async function yahooCall<T>(fn: () => Promise<T>, ms: number, label: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await acquire();
    try {
      return await withTimeout(fn(), ms, label);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) break;
    } finally {
      release();
    }
    await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
  }
  throw lastError;
}

// Log each distinct upstream problem once per 10 minutes instead of on every request.
const warned = new Map<string, number>();
function warnOnce(key: string, message: string): void {
  const last = warned.get(key) ?? 0;
  if (Date.now() - last < 10 * 60 * 1000) return;
  warned.set(key, Date.now());
  console.warn(message);
}

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
    const quote = await yahooCall(() => yahooFinance.quote(yahooTicker), QUOTE_TIMEOUT_MS, `quote ${yahooTicker}`);

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
    warnOnce(`quote:${symbol}`, `[Yahoo] Quote unavailable for ${symbol} (${yahooTicker}): ${(error as Error).message}`);
    return null;
  }
}

// Quotes younger than QUOTE_CACHE_MS are "fresh". Older ones, up to QUOTE_STALE_MS, are still
// served instantly while a background refresh runs (stale-while-revalidate). Stock quotes are
// already ~15 minutes delayed upstream, so a minute or two of extra age is invisible, whereas
// waiting ~10s for ~100 live quotes after an idle minute made the Home page feel broken.
const QUOTE_STALE_MS = 15 * 60 * 1000;
const refreshing = new Set<string>();

/** Fetch live quotes in small batches and store them in the cache. Symbols Yahoo has no data for are absent. */
async function fetchQuoteBatches(symbols: string[]): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  const batchSize = 10; // small batches to stay within free-tier rate limits
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const yahooTickers = batch.map(toYahooSymbol);
    // Yahoo omits unknown/delisted tickers from the response, so results must
    // be matched by ticker rather than by array index.
    const tickerToSymbol = new Map(yahooTickers.map((t, idx) => [t.toUpperCase(), batch[idx]]));

    try {
      const quotes = await yahooCall(() => yahooFinance.quote(yahooTickers), QUOTE_TIMEOUT_MS, "batch quote");
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of quotesArray) {
        if (!q || !q.regularMarketPrice || !q.symbol) continue;
        const internalSymbol = tickerToSymbol.get(String(q.symbol).toUpperCase());
        if (!internalSymbol) continue;

        const result: QuoteResult = {
          symbol: internalSymbol,
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

        setCache(quoteCache, internalSymbol, result);
        results.set(internalSymbol, result);
      }
    } catch (error) {
      warnOnce("batch-quote", `[Yahoo] Batch quote failed: ${(error as Error).message}`);
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

/** Refresh symbols without making the caller wait. At most one refresh per symbol runs at a time. */
function refreshQuotesInBackground(symbols: string[]): void {
  const todo = symbols.filter(s => !refreshing.has(s));
  if (todo.length === 0) return;
  todo.forEach(s => refreshing.add(s));
  void fetchQuoteBatches(todo)
    .catch(() => undefined)
    .finally(() => todo.forEach(s => refreshing.delete(s)));
}

/**
 * Get quotes for multiple symbols. Fresh cache hits and slightly stale hits return immediately
 * (stale ones refresh in the background); only symbols with no usable cache entry wait for Yahoo.
 */
export async function getQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  const missing: string[] = [];
  const stale: string[] = [];
  const now = Date.now();

  for (const symbol of symbols) {
    const entry = quoteCache.get(symbol);
    const age = entry ? now - entry.timestamp : Infinity;
    if (entry && age <= QUOTE_CACHE_MS) {
      results.set(symbol, entry.data);
    } else if (entry && age <= QUOTE_STALE_MS) {
      results.set(symbol, entry.data);
      stale.push(symbol);
    } else {
      missing.push(symbol);
    }
  }

  if (stale.length > 0) refreshQuotesInBackground(stale);
  if (missing.length > 0) {
    for (const [symbol, quote] of await fetchQuoteBatches(missing)) results.set(symbol, quote);
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
  // Daily requests for any window up to a year share ONE cached 1y series per symbol
  // and are sliced locally, so a symbol costs a single upstream request, not one per period.
  const sliceable = interval === "1d" && period !== "2y";
  const fetchPeriod = sliceable ? "1y" : period;
  const cacheKey = `${symbol}:${fetchPeriod}:${interval}`;

  let candles = getCached(historyCache, cacheKey, HISTORY_CACHE_MS);
  if (!candles) {
    // A symbol that just failed is not retried for a few minutes (each attempt is slow with retries).
    if (Date.now() - (historyFailedAt.get(cacheKey) ?? 0) < FAILURE_BACKOFF_MS) return [];
    // De-duplicate concurrent requests for the same series (cache stampede guard)
    let pending = historyInflight.get(cacheKey);
    if (!pending) {
      pending = fetchHistory(symbol, cacheKey, fetchPeriod, interval).finally(() => historyInflight.delete(cacheKey));
      historyInflight.set(cacheKey, pending);
    }
    candles = await pending;
  }

  if (!sliceable || period === "1y") return candles;
  const cutoff = getStartDate(period).getTime();
  return candles.filter(c => new Date(c.timestamp).getTime() >= cutoff);
}
const historyInflight = new Map<string, Promise<HistoryCandle[]>>();
const historyFailedAt = new Map<string, number>();
const FAILURE_BACKOFF_MS = 3 * 60 * 1000;

async function fetchHistory(
  symbol: string,
  cacheKey: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y",
  interval: "1d" | "1wk" | "1mo"
): Promise<HistoryCandle[]> {
  const yahooTicker = toYahooSymbol(symbol);

  try {
    const result = await yahooCall(
      () =>
        yahooFinance.chart(yahooTicker, {
          period1: getStartDate(period),
          period2: new Date(),
          interval,
        }),
      HISTORY_TIMEOUT_MS,
      `chart ${yahooTicker}`
    );

    if (!result || !result.quotes || result.quotes.length === 0) return [];

    const candles: HistoryCandle[] = result.quotes
      .filter((r: any) => r.open != null && r.close != null && r.high != null && r.low != null)
      .map((r: any) => ({
        timestamp: r.date.toISOString(),
        open: r.open!,
        high: r.high!,
        low: r.low!,
        close: r.close!,
        volume: r.volume ?? 0,
      }));

    setCache(historyCache, cacheKey, candles);
    historyFailedAt.delete(cacheKey);
    return candles;
  } catch (error) {
    historyFailedAt.set(cacheKey, Date.now());
    // Only warn once per symbol to avoid console spam
    if (!historyFailedSet.has(symbol)) {
      addToFailedSet(symbol);
      warnOnce(`history:${symbol}`, `[Yahoo] History unavailable for ${symbol} (${yahooTicker}): ${(error as Error).message}`);
    }
    return [];
  }
}

// ─── All-time high ────────────────────────────────────────────────────────────

const athCache = new Map<string, { value: number | null; at: number }>();
const ATH_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Highest traded price over the full listed history, taken from monthly candles
 * (cheap: one small request per symbol). Null when Yahoo has no history.
 */
export async function getAllTimeHigh(symbol: string): Promise<number | null> {
  const hit = athCache.get(symbol);
  if (hit && Date.now() - hit.at < ATH_CACHE_MS) return hit.value;

  const yahooTicker = toYahooSymbol(symbol);
  try {
    const result = await yahooCall(
      () => yahooFinance.chart(yahooTicker, { period1: new Date("1990-01-01"), period2: new Date(), interval: "1mo" }),
      HISTORY_TIMEOUT_MS,
      `ath ${yahooTicker}`
    );
    const highs = (result?.quotes ?? []).map((q: any) => q.high).filter((h: unknown): h is number => typeof h === "number");
    const value = highs.length ? Math.max(...highs) : null;
    athCache.set(symbol, { value, at: Date.now() });
    return value;
  } catch (error) {
    warnOnce(`ath:${symbol}`, `[Yahoo] All-time high unavailable for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

const historyFailedSet = new Set<string>();
const MAX_FAILED_SET_SIZE = 200;

// Periodic cleanup of the failed set (every 30 min, allow retries)
// unref() so this timer never keeps the process alive (clean shutdown, tests).
setInterval(() => { historyFailedSet.clear(); }, 30 * 60 * 1000).unref();

// Prevent unbounded growth of the failed set between cleanup cycles
function addToFailedSet(symbol: string) {
  if (historyFailedSet.size >= MAX_FAILED_SET_SIZE) {
    // Evict all — next cycle will allow retries
    historyFailedSet.clear();
  }
  historyFailedSet.add(symbol);
}

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

/** Current price snapshot for one symbol, or null when Yahoo has no data. */
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
 * Prices for multiple symbols. Symbols Yahoo has no data for are simply
 * absent from the returned map; callers must not invent values for them.
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

// ─── Market status ────────────────────────────────────────────────────────────

export type SessionState = "open" | "pre" | "post" | "closed";

export interface MarketSession {
  state: SessionState;
  /** Time of the most recent trade Yahoo has for the benchmark, ISO string. */
  lastTradeAt: string | null;
}

export interface MarketStatus {
  india: MarketSession;
  us: MarketSession;
  crypto: MarketSession;
}

// Benchmarks whose Yahoo `marketState` reflects each venue, including exchange holidays.
const STATUS_BENCHMARKS = { india: "^NSEI", us: "^GSPC", crypto: "BTC-USD" } as const;
const STATUS_CACHE_MS = 60 * 1000;
let statusCache: { at: number; value: MarketStatus } | null = null;

function toSessionState(raw: unknown): SessionState {
  switch (String(raw ?? "").toUpperCase()) {
    case "REGULAR": return "open";
    case "PRE":
    case "PREPRE": return "pre";
    case "POST":
    case "POSTPOST": return "post";
    default: return "closed";
  }
}

/**
 * Real open/closed state for the three markets, straight from Yahoo's exchange
 * data (so holidays are respected). Returns null when Yahoo can't be reached.
 */
export async function getMarketStatus(): Promise<MarketStatus | null> {
  if (statusCache && Date.now() - statusCache.at < STATUS_CACHE_MS) return statusCache.value;
  try {
    const symbols = Object.values(STATUS_BENCHMARKS);
    const raw = await yahooCall(() => yahooFinance.quote(symbols), QUOTE_TIMEOUT_MS, "market status");
    const list = Array.isArray(raw) ? raw : [raw];
    const bySymbol = new Map(list.map(q => [String(q.symbol), q]));
    const session = (symbol: string): MarketSession => {
      const q = bySymbol.get(symbol) as { marketState?: string; regularMarketTime?: Date } | undefined;
      return {
        state: toSessionState(q?.marketState),
        lastTradeAt: q?.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
      };
    };
    if (!symbols.some(s => bySymbol.has(s))) return null;
    const value: MarketStatus = {
      india: session(STATUS_BENCHMARKS.india),
      us: session(STATUS_BENCHMARKS.us),
      crypto: session(STATUS_BENCHMARKS.crypto),
    };
    statusCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    warnOnce("market-status", `[Yahoo] Market status unavailable: ${(error as Error).message}`);
    return statusCache?.value ?? null;
  }
}
