import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { settingsRouter } from "./routers/settings";
import { notificationsRouter } from "./routers/notifications";
import { journalRouter } from "./routers/journal";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  getAssetBySymbol,
  getUserWatchlists, getWatchlistWithItems, createWatchlist, deleteWatchlist,
  addToWatchlist, removeFromWatchlist,
  getFavoriteSectors, toggleFavoriteSector,
  getSavedScans, createSavedScan, deleteSavedScan,
  getUserAlerts, createAlert, updateAlert, deleteAlert,
  getUnreadAlertCount, getAlertHistory, markAlertsRead,
  getRecentScanResults,
} from "./db";
import {
  getCurrentPrice, getCurrentPrices, withPrices, getAssetDetailData, getRealSectorPerformance,
  runRealScanner, getHistoricalCandles, runRealPatternScanner, mapLimit,
} from "./dataProvider";
import {
  getMarketSentiment, getHighLowCounts, getIndiaSentimentHistory, getSectorRotationHistory, getSectorDailyHistory,
  sentimentFromChanges, stateFromScore,
} from "./marketAnalytics";
import { getMarketStatus } from "./yahooFinance";
import {
  getFearGreedNow, getFearGreedHistory, getCryptoGlobal, getTopExchanges, getFiiDiiActivity, fearGreedLabel,
} from "./externalData";
import {
  runDataValidation, NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY, INDEX_REGISTRY, COMMODITY_REGISTRY,
} from "./assetRegistry";

// ─── Input Bounds ─────────────────────────────────────────────────────────────
// Upper bounds on numeric/array inputs so a single request can't force the
// server to build huge arrays or fan out to hundreds of Yahoo calls.
const boundedDays = (fallback: number) => z.number().int().min(1).max(365).default(fallback);
const boundedLimit = (fallback: number, max = 500) => z.number().int().min(1).max(max).default(fallback);
const symbolInput = z.string().trim().min(1).max(32);

// ─── Domain Constants ─────────────────────────────────────────────────────────

const INDIA_SECTORS = [
  "Information Technology", "Banking & Finance", "Oil & Gas",
  "Healthcare & Pharma", "Consumer Goods", "Metals & Mining",
  "Automobiles", "Real Estate", "Telecom", "FMCG", "Infrastructure",
];

const US_SECTORS = [
  "Technology", "Financials", "Healthcare", "Energy",
  "Consumer Discretionary", "Consumer Staples", "Industrials", "Communication Services",
];

const INDIA_INDICES = INDEX_REGISTRY.filter(i => i.domain === "INDIA");
const US_DASHBOARD_INDICES = INDEX_REGISTRY.filter(i => ["SPX", "NDX", "DJI", "VIX"].includes(i.symbol));

type Market = "india" | "crypto" | "us";
interface AssetRef {
  symbol: string; name: string; sector: string; exchange: string; currency: string;
  market: Market; kind: "stock" | "crypto" | "index";
}

/** Every tradeable symbol the app knows about, from the registries only. */
const ALL_REFS: AssetRef[] = [
  ...NSE_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, market: "india" as Market, kind: "stock" as const })),
  ...INDIA_INDICES.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, market: "india" as Market, kind: "index" as const })),
  ...CRYPTO_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, market: "crypto" as Market, kind: "crypto" as const })),
  ...US_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, market: "us" as Market, kind: "stock" as const })),
  ...INDEX_REGISTRY.filter(i => i.domain === "US").map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange as string, currency: a.currency as string, market: "us" as Market, kind: "index" as const })),
];
const REF_BY_SYMBOL = new Map(ALL_REFS.map(r => [r.symbol, r]));
const COMMODITY_SYMBOLS = new Set(COMMODITY_REGISTRY.map(c => c.symbol));

/** Reject symbols that aren't in a registry so arbitrary input never reaches Yahoo. */
function requireKnownSymbol(symbol: string): void {
  if (!REF_BY_SYMBOL.has(symbol) && !COMMODITY_SYMBOLS.has(symbol)) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Unknown symbol '${symbol}'` });
  }
}

function marketOf(symbol: string): Market {
  return REF_BY_SYMBOL.get(symbol)?.market ?? "india";
}

function unavailable(what: string): never {
  throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: `Live data for ${what} is currently unavailable. Try again shortly.` });
}

/** Attach each result's real market (from the registries) so the UI never guesses it from the symbol. */
const withMarket = <T extends { symbol: string }>(rows: T[]) => rows.map(r => ({ ...r, market: marketOf(r.symbol) }));

const topMovers = <T extends { changePercent: number }>(list: T[], n: number) => ({
  gainers: [...list].sort((a, b) => b.changePercent - a.changePercent).slice(0, n),
  losers: [...list].sort((a, b) => a.changePercent - b.changePercent).slice(0, n),
});

// ─── Shared scanner scan types ────────────────────────────────────────────────
const SCAN_TYPES = z.enum([
  "ema_alignment", "volume_spike", "breakout_52w", "breakout_ath",
  "momentum_continuation", "relative_strength", "consolidation_breakout",
]);

const IMPROVED_SCAN_TYPES = z.enum([
  "ema_alignment", "volume_spike", "breakout_52w", "ath_breakout",
  "momentum_continuation", "relative_strength",
]);

// Scans run on daily candles from Yahoo Finance. Intraday timeframes would need
// a different data feed, so only "1D" is accepted.
const SCAN_TIMEFRAMES = z.enum(["1D"]);

// Optional multi-select for confluence scans. When provided (length >= 1),
// it takes precedence over the single `scanType`. 1 = normal scan, >1 = AND.
const IMPROVED_SCAN_TYPES_ARRAY = z.array(IMPROVED_SCAN_TYPES).min(1).max(6).optional();
const SCAN_TYPES_ARRAY = z.array(SCAN_TYPES).min(1).max(7).optional();

const PATTERN_TIMEFRAMES = z.enum(["1d", "1w"]);

const patternInput = {
  timeframes: z.array(PATTERN_TIMEFRAMES).min(1).default(["1d"]),
  minConfidence: z.number().min(0).max(100).default(50),
  requireVolumeConfirmation: z.boolean().default(false),
  filterFalseBreakouts: z.boolean().default(true),
};

interface PulseEvent {
  id: string;
  type: "breakout" | "volume_spike" | "momentum";
  symbol: string;
  domain: Market;
  message: string;
  timestamp: Date;
  severity: "info" | "warning" | "success";
}
let pulseCache: { at: number; events: PulseEvent[] } | null = null;

// ─── Global Market Router ─────────────────────────────────────────────────────
const globalRouter = router({
  // Summary of all three market domains for the Home Dashboard
  overview: publicProcedure.query(async () => {
    const [nsePrices, cryptoPrices, usPrices, fearGreed, cryptoGlobal] = await Promise.all([
      getCurrentPrices(NSE_REGISTRY.map(a => a.symbol)),
      getCurrentPrices(CRYPTO_REGISTRY.map(a => a.symbol)),
      getCurrentPrices([...US_REGISTRY.map(a => a.symbol), "SPX"]),
      getFearGreedNow(),
      getCryptoGlobal(),
    ]);

    const indiaList = NSE_REGISTRY.flatMap(a => (nsePrices.has(a.symbol) ? [{ ...a, ...nsePrices.get(a.symbol)! }] : []));
    const cryptoList = CRYPTO_REGISTRY.flatMap(a => (cryptoPrices.has(a.symbol) ? [{ ...a, ...cryptoPrices.get(a.symbol)! }] : []));
    const usList = US_REGISTRY.flatMap(a => (usPrices.has(a.symbol) ? [{ ...a, ...usPrices.get(a.symbol)! }] : []));

    const indiaSentiment = indiaList.length ? sentimentFromChanges(indiaList.map(a => a.changePercent)) : null;
    const usSentimentBase = usList.length ? sentimentFromChanges(usList.map(a => a.changePercent)) : null;
    const cryptoScore = fearGreed ? Math.round((fearGreed.value - 50) * 2) : null;

    return {
      india: { sentiment: indiaSentiment, topGainers: topMovers(indiaList, 3).gainers, topLosers: topMovers(indiaList, 3).losers },
      crypto: {
        sentiment: fearGreed && cryptoScore !== null
          ? { sentimentScore: cryptoScore, marketState: stateFromScore(cryptoScore), fearGreedIndex: fearGreed.value, btcDominance: cryptoGlobal?.btcDominance ?? null }
          : null,
        topGainers: topMovers(cryptoList, 3).gainers,
        topLosers: topMovers(cryptoList, 3).losers,
      },
      us: {
        sentiment: usSentimentBase
          ? { sentimentScore: usSentimentBase.sentimentScore, marketState: usSentimentBase.marketState, spxChange: usPrices.get("SPX")?.changePercent ?? null }
          : null,
        topGainers: topMovers(usList, 3).gainers,
        topLosers: topMovers(usList, 3).losers,
      },
    };
  }),

  recentAlerts: protectedProcedure.query(async ({ ctx }) => {
    return getAlertHistory(ctx.user.id, 5);
  }),

  // Real open/closed state of each market (Yahoo exchange data, holiday-aware). Null if unreachable.
  marketStatus: publicProcedure.query(async () => getMarketStatus()),

  // Live market signals for the Market Pulse panel: big movers plus real
  // volume-spike and 52-week-high scanner hits. Cached for a minute.
  pulse: publicProcedure.query(async () => {
    if (pulseCache && Date.now() - pulseCache.at < 60_000) return pulseCache.events;

    const events: PulseEvent[] = [];
    const asOf = new Date();
    const domains: Array<{ domain: Market; registry: Array<{ symbol: string }> }> = [
      { domain: "india", registry: NSE_REGISTRY },
      { domain: "crypto", registry: CRYPTO_REGISTRY },
      { domain: "us", registry: US_REGISTRY },
    ];

    for (const { domain, registry } of domains) {
      const prices = await getCurrentPrices(registry.map(a => a.symbol));
      for (const [symbol, p] of prices) {
        if (Math.abs(p.changePercent) >= 3) {
          events.push({
            id: `move:${symbol}`, type: "momentum", symbol, domain, timestamp: asOf,
            severity: p.changePercent > 0 ? "success" : "warning",
            message: `${symbol} ${p.changePercent > 0 ? "up" : "down"} ${Math.abs(p.changePercent).toFixed(2)}% today`,
          });
        }
      }
      const [spikes, highs] = await Promise.all([
        runRealScanner({ domain, scanType: "volume_spike", maxResults: 4 }),
        runRealScanner({ domain, scanType: "breakout_52w", maxResults: 4 }),
      ]);
      for (const r of spikes) {
        events.push({ id: `vol:${r.symbol}`, type: "volume_spike", symbol: r.symbol, domain, timestamp: asOf, severity: "warning", message: `${r.symbol} unusual volume (${r.signals[0] ?? "volume spike"})` });
      }
      for (const r of highs) {
        events.push({ id: `hi:${r.symbol}`, type: "breakout", symbol: r.symbol, domain, timestamp: asOf, severity: "success", message: `${r.symbol} near its 52-week high at ${r.price}` });
      }
    }

    // Same symbol can appear under several signals; keep the first of each id and cap the list.
    const seen = new Set<string>();
    const unique = events.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 40);
    pulseCache = { at: Date.now(), events: unique };
    return unique;
  }),

  // Cross-market pattern scanner, all markets combined
  patterns: publicProcedure
    .input(z.object({ market: z.enum(["india", "crypto", "us", "all"]).default("all"), ...patternInput }))
    .query(async ({ input }) => {
      const assets: Array<{ symbol: string; sector?: string | null }> = [];
      if (input.market === "india" || input.market === "all") assets.push(...NSE_REGISTRY);
      if (input.market === "crypto" || input.market === "all") assets.push(...CRYPTO_REGISTRY);
      if (input.market === "us" || input.market === "all") assets.push(...US_REGISTRY);
      return withMarket(await runRealPatternScanner(assets, {
        timeframes: input.timeframes,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 1,
      }));
    }),

  // Data validation endpoint, registry integrity audit
  validateRegistry: publicProcedure.query(async () => {
    return runDataValidation();
  }),
});

// ─── India Market Router ──────────────────────────────────────────────────────
const indiaRouter = router({
  // Dashboard overview: NSE stocks and Indian indices only
  dashboard: publicProcedure.query(async () => {
    const [priceMap, fiiDii, sectorData] = await Promise.all([
      getCurrentPrices([...NSE_REGISTRY.map(a => a.symbol), ...INDIA_INDICES.map(i => i.symbol)]),
      getFiiDiiActivity(),
      getRealSectorPerformance(INDIA_SECTORS, "india"),
    ]);

    const prices = NSE_REGISTRY.flatMap(a => (priceMap.has(a.symbol) ? [{
      symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange, currency: a.currency, ...priceMap.get(a.symbol)!,
    }] : []));
    if (prices.length === 0) unavailable("NSE stocks");

    const [sentimentResult, highLow] = await Promise.all([getMarketSentiment("india", priceMap), getHighLowCounts("india", priceMap)]);
    const sentiment = sentimentResult!;
    const { gainers, losers } = topMovers(prices, 10);
    const indices = INDIA_INDICES.flatMap(idx => (priceMap.has(idx.symbol) ? [{ ...idx, ...priceMap.get(idx.symbol)! }] : []));

    return {
      sentiment,
      sectorPerformance: sectorData,
      topGainers: gainers,
      topLosers: losers,
      indices,
      // INR crore, as published by NSE for the latest trading day; null if NSE is unreachable.
      fiiActivity: fiiDii?.fii ?? null,
      diiActivity: fiiDii?.dii ?? null,
      institutionalDate: fiiDii?.date ?? null,
      breadth: {
        advanceCount: sentiment.advanceCount,
        declineCount: sentiment.declineCount,
        unchangedCount: sentiment.unchangedCount,
        advanceDeclineRatio: sentiment.advanceDeclineRatio,
        breadthScore: sentiment.breadthScore,
        nearHighs: highLow?.nearHighs ?? null,
        nearLows: highLow?.nearLows ?? null,
      },
    };
  }),

  // NSE sector heatmap, India sectors only
  sectorHeatmap: publicProcedure.query(async () => {
    const sectorData = await getRealSectorPerformance(INDIA_SECTORS, "india");
    return sectorData.map(s => ({ sector: s.sector, change: s.priceChange1d, score: s.performanceScore, inflowOutflow: s.inflowOutflow }));
  }),

  // Sector rotation, India sectors only
  sectorRotation: publicProcedure
    .input(z.object({ timeframe: z.string().max(8).default("1d") }))
    .query(async ({ input }) => {
      const sectorData = await getRealSectorPerformance(INDIA_SECTORS, "india");
      return sectorData.map((s, i) => ({ ...s, timeframe: input.timeframe, rank: i + 1 }));
    }),

  // Sector detail, India sectors only
  sectorDetail: publicProcedure
    .input(z.object({ sector: z.string().max(64), days: boundedDays(30) }))
    .query(async ({ input }) => {
      if (!INDIA_SECTORS.includes(input.sector)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid India sector" });
      }
      const [sectorPerf, history, assets] = await Promise.all([
        getRealSectorPerformance([input.sector], "india"),
        getSectorDailyHistory("india", input.sector, input.days),
        withPrices(NSE_REGISTRY.filter(a => a.sector === input.sector)),
      ]);
      const current = sectorPerf[0];
      if (!current) unavailable(`the ${input.sector} sector`);
      return { current, history, assets };
    }),

  // NSE scanner, NSE stocks only
  scanner: publicProcedure
    .input(z.object({
      scanType: IMPROVED_SCAN_TYPES,
      scanTypes: IMPROVED_SCAN_TYPES_ARRAY,
      timeframe: SCAN_TIMEFRAMES.default("1D"),
      sector: z.string().max(64).optional(),
      minQualityScore: z.number().min(0).max(100).default(30),
      maxResults: boundedLimit(20, 200),
      volumeMultiplier: z.number().min(0).max(100).default(2.0),
    }))
    .query(async ({ input }) => {
      if (input.sector && !INDIA_SECTORS.includes(input.sector)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid India sector" });
      }
      const results = await runRealScanner({
        domain: "india",
        scanType: input.scanTypes ?? input.scanType,
        sector: input.sector,
        maxResults: input.maxResults,
      });
      return results.filter(r => r.qualityScore >= input.minQualityScore);
    }),

  // NSE pattern scanner, India patterns only
  patterns: publicProcedure
    .input(z.object({ ...patternInput, sector: z.string().max(64).optional() }))
    .query(async ({ input }) => {
      const assets = input.sector
        ? NSE_REGISTRY.filter(a => a.sector.toLowerCase() === input.sector!.toLowerCase())
        : NSE_REGISTRY;
      return withMarket(await runRealPatternScanner(assets, {
        timeframes: input.timeframes,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 2,
      }));
    }),

  // NSE stocks list
  stocks: publicProcedure
    .input(z.object({ sector: z.string().max(64).optional() }))
    .query(async ({ input }) => {
      const list = NSE_REGISTRY
        .filter(a => !input.sector || a.sector === input.sector)
        .map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange, currency: a.currency }));
      return withPrices(list);
    }),

  // Indian indices
  indices: publicProcedure.query(async () => withPrices(INDIA_INDICES)),

  // India sentiment history, rebuilt from real daily closes
  sentimentHistory: publicProcedure
    .input(z.object({ days: boundedDays(90) }))
    .query(async ({ input }) => getIndiaSentimentHistory(input.days)),

  // India sector rotation history, rebuilt from real daily closes
  sectorRotationHistory: publicProcedure
    .input(z.object({ days: boundedDays(30) }))
    .query(async ({ input }) => getSectorRotationHistory("india", INDIA_SECTORS, input.days)),

  // India favorites
  favoriteSectors: protectedProcedure.query(async ({ ctx }) => {
    return getFavoriteSectors(ctx.user.id);
  }),

  toggleFavoriteSector: protectedProcedure
    .input(z.object({ sector: z.string().max(64) }))
    .mutation(async ({ ctx, input }) => {
      const isFav = await toggleFavoriteSector(ctx.user.id, input.sector);
      return { isFavorite: isFav };
    }),

  // India saved scans
  savedScans: protectedProcedure.query(async ({ ctx }) => {
    return getSavedScans(ctx.user.id);
  }),

  saveScan: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      config: z.object({
        scanType: z.string().max(64),
        timeframe: z.string().max(8),
        sector: z.string().max(64).optional(),
        minVolume: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await createSavedScan(ctx.user.id, input.name, input.config);
      return { success: true };
    }),

  deleteSavedScan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSavedScan(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Crypto Market Router ─────────────────────────────────────────────────────
const cryptoRouter = router({
  // Crypto dashboard: crypto assets only
  dashboard: publicProcedure.query(async () => {
    const [priceMap, fearGreed, global, exchanges] = await Promise.all([
      getCurrentPrices(CRYPTO_REGISTRY.map(a => a.symbol)),
      getFearGreedNow(),
      getCryptoGlobal(),
      getTopExchanges(10),
    ]);

    const cryptoPrices = CRYPTO_REGISTRY.flatMap(a => (priceMap.has(a.symbol) ? [{
      symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange, currency: a.currency, category: a.category,
      ...priceMap.get(a.symbol)!,
    }] : []));
    if (cryptoPrices.length === 0) unavailable("crypto assets");

    const { gainers, losers } = topMovers(cryptoPrices, 10);
    const btcPrice = priceMap.get("BTC") ?? null;
    const ethPrice = priceMap.get("ETH") ?? null;

    // Altcoin momentum: each coin's 24h move relative to Bitcoin's.
    const altcoins = btcPrice
      ? cryptoPrices
          .filter(a => a.symbol !== "BTC")
          .map(a => ({ ...a, relativeStrengthVsBTC: Math.round((a.changePercent - btcPrice.changePercent) * 100) / 100 }))
          .sort((a, b) => b.relativeStrengthVsBTC - a.relativeStrengthVsBTC)
      : [];

    // Exchange volume from CoinGecko (reported in BTC), converted at the live BTC price.
    const totalExchangeBtc = exchanges.reduce((s, e) => s + e.volume24hBtc, 0);
    const exchangeActivity = btcPrice
      ? exchanges.slice(0, 5).map(e => ({
          exchange: e.exchange,
          volume24h: Math.round(e.volume24hBtc * btcPrice.price),
          dominance: totalExchangeBtc > 0 ? Math.round((e.volume24hBtc / totalExchangeBtc) * 1000) / 10 : 0,
        }))
      : [];

    return {
      btcPrice,
      ethPrice,
      btcDominance: global?.btcDominance ?? null,
      ethDominance: global?.ethDominance ?? null,
      fearGreedIndex: fearGreed?.value ?? null,
      fearGreedLabel: fearGreed?.label ?? null,
      totalMarketCap: global?.totalMarketCapUsd ?? null,
      totalVolume24h: global?.totalVolume24hUsd ?? null,
      topGainers: gainers,
      topLosers: losers,
      altcoinMomentum: altcoins,
      exchangeActivity,
    };
  }),

  // Crypto heatmap: crypto only
  heatmap: publicProcedure.query(async () => {
    const priceMap = await getCurrentPrices(CRYPTO_REGISTRY.map(a => a.symbol));
    return CRYPTO_REGISTRY.flatMap(a => {
      const price = priceMap.get(a.symbol);
      return price ? [{ symbol: a.symbol, name: a.name, change: price.changePercent, price: price.price, volume: price.volume, category: a.category }] : [];
    });
  }),

  // Crypto scanner: crypto only
  scanner: publicProcedure
    .input(z.object({
      scanType: IMPROVED_SCAN_TYPES,
      scanTypes: IMPROVED_SCAN_TYPES_ARRAY,
      timeframe: SCAN_TIMEFRAMES.default("1D"),
      minQualityScore: z.number().min(0).max(100).default(30),
      maxResults: boundedLimit(20, 200),
      volumeMultiplier: z.number().min(0).max(100).default(2.0),
    }))
    .query(async ({ input }) => {
      const results = await runRealScanner({
        domain: "crypto",
        scanType: input.scanTypes ?? input.scanType,
        maxResults: input.maxResults,
      });
      return results.filter(r => r.qualityScore >= input.minQualityScore);
    }),

  // Crypto pattern scanner: crypto patterns only
  patterns: publicProcedure
    .input(z.object(patternInput))
    .query(async ({ input }) => {
      return withMarket(await runRealPatternScanner(CRYPTO_REGISTRY, {
        timeframes: input.timeframes,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 2,
      }));
    }),

  // Crypto assets list
  assets: publicProcedure.query(async () => {
    const list = CRYPTO_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, sector: a.sector, exchange: a.exchange, currency: a.currency, category: a.category }));
    return withPrices(list);
  }),

  // Fear & Greed history (Alternative.me). Empty when the source is unreachable.
  fearGreedHistory: publicProcedure
    .input(z.object({ days: boundedDays(30) }))
    .query(async ({ input }) => (await getFearGreedHistory(input.days)).slice(-(input.days + 1))),

  // Crypto saved scans
  savedScans: protectedProcedure.query(async ({ ctx }) => {
    return getSavedScans(ctx.user.id);
  }),

  saveScan: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      config: z.object({ scanType: z.string().max(64), timeframe: z.string().max(8), minVolume: z.number().optional() }),
    }))
    .mutation(async ({ ctx, input }) => {
      await createSavedScan(ctx.user.id, input.name, input.config);
      return { success: true };
    }),

  deleteSavedScan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSavedScan(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── US Market Router ─────────────────────────────────────────────────────────
const usRouter = router({
  // US dashboard: US stocks and indices only
  dashboard: publicProcedure.query(async () => {
    const priceMap = await getCurrentPrices([...US_DASHBOARD_INDICES.map(i => i.symbol), ...US_REGISTRY.map(s => s.symbol)]);
    const indices = US_DASHBOARD_INDICES.flatMap(idx => (priceMap.has(idx.symbol) ? [{ ...idx, ...priceMap.get(idx.symbol)! }] : []));
    const prices = US_REGISTRY.flatMap(a => (priceMap.has(a.symbol) ? [{ ...a, ...priceMap.get(a.symbol)! }] : []));
    if (prices.length === 0) unavailable("US stocks");

    const { gainers, losers } = topMovers(prices, 10);
    const sectorData = await getRealSectorPerformance(US_SECTORS, "us");
    const marketSentiment = (await getMarketSentiment("us", priceMap))!;

    return {
      indices,
      topGainers: gainers,
      topLosers: losers,
      sectorHeatmap: sectorData,
      marketSentiment,
    };
  }),

  // US sector heatmap
  sectorHeatmap: publicProcedure.query(async () => {
    const sectorData = await getRealSectorPerformance(US_SECTORS, "us");
    return sectorData.map(s => ({ sector: s.sector, change: s.priceChange1d, score: s.performanceScore, inflowOutflow: s.inflowOutflow }));
  }),

  // US scanner
  scanner: publicProcedure
    .input(z.object({
      scanType: SCAN_TYPES,
      scanTypes: SCAN_TYPES_ARRAY,
      timeframe: z.string().max(8).default("1d"),
      sector: z.string().max(64).optional(),
      minVolumeRatio: z.number().min(0).max(100).default(2.0),
    }))
    .query(async ({ input }) => {
      // "breakout_ath" is the legacy name for "ath_breakout".
      const normalize = (s: string) => (s === "breakout_ath" ? "ath_breakout" : s);
      const types = (input.scanTypes ?? [input.scanType]).map(normalize).filter(s => s !== "consolidation_breakout");
      if (types.length === 0) return [];
      return runRealScanner({ domain: "us", scanType: types, sector: input.sector, maxResults: 15 });
    }),

  // US stocks list
  stocks: publicProcedure
    .input(z.object({ sector: z.string().max(64).optional() }))
    .query(async ({ input }) => withPrices(US_REGISTRY.filter(a => !input.sector || a.sector === input.sector))),

  // US indices
  indices: publicProcedure.query(async () => withPrices(US_DASHBOARD_INDICES)),
});

// ─── Commodities Router ───────────────────────────────────────────────────────
const commoditiesRouter = router({
  // List all commodities with live prices
  list: publicProcedure.query(async () => {
    const list = COMMODITY_REGISTRY.map(a => ({ symbol: a.symbol, name: a.name, category: a.category, sector: a.sector, unit: a.unit }));
    return withPrices(list);
  }),

  // Get single commodity detail with history
  detail: publicProcedure
    .input(z.object({ symbol: symbolInput }))
    .query(async ({ input }) => {
      const commodity = COMMODITY_REGISTRY.find(a => a.symbol === input.symbol);
      if (!commodity) return null;
      const [price, candles] = await Promise.all([getCurrentPrice(input.symbol), getHistoricalCandles(input.symbol, 365)]);
      if (!price) unavailable(commodity.name);
      return { ...commodity, ...price, candles };
    }),
});

// ─── Unified Asset Router (for asset detail/chart, cross-domain search) ───────
function refsForMarket(market: Market | "all"): AssetRef[] {
  return market === "all" ? ALL_REFS : ALL_REFS.filter(r => r.market === market);
}

const publicRef = ({ symbol, name, sector, exchange, currency }: AssetRef) => ({ symbol, name, sector, exchange, currency });

const assetsRouter = router({
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(1).max(64), market: z.enum(["india", "crypto", "us", "all"]).default("all") }))
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();
      const matches = refsForMarket(input.market)
        .filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.sector.toLowerCase().includes(q))
        .slice(0, 30)
        .map(publicRef);
      return withPrices(matches);
    }),

  // List assets (no search required)
  list: publicProcedure
    .input(z.object({ market: z.enum(["india", "crypto", "us", "all"]).default("all"), sector: z.string().max(64).optional() }))
    .query(async ({ input }) => {
      let refs = refsForMarket(input.market);
      if (input.sector && input.sector !== "All") refs = refs.filter(a => a.sector === input.sector);
      return withPrices(refs.slice(0, 50).map(publicRef));
    }),

  detail: publicProcedure
    .input(z.object({ symbol: symbolInput }))
    .query(async ({ input }) => {
      const ref = REF_BY_SYMBOL.get(input.symbol);
      if (!ref) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

      const detail = await getAssetDetailData(input.symbol);
      if (!detail) unavailable(ref.name);

      return {
        ...publicRef(ref),
        market: ref.market,
        ...detail.currentPrice,
        candles: detail.candles,
        emaData: detail.emaData,
        indicators: detail.indicators,
      };
    }),

  /** Last ~20 daily closes per symbol for inline sparklines. Symbols without data are omitted. */
  sparklines: publicProcedure
    .input(z.object({ symbols: z.array(symbolInput).min(1).max(40) }))
    .query(async ({ input }) => {
      const symbols = [...new Set(input.symbols)].filter(s => REF_BY_SYMBOL.has(s));
      const out: Record<string, number[]> = {};
      await mapLimit(symbols, 6, async symbol => {
        const candles = await getHistoricalCandles(symbol, 20);
        if (candles.length >= 5) out[symbol] = candles.map(c => c.close);
      });
      return out;
    }),

  ohlcv: publicProcedure
    .input(z.object({ symbol: symbolInput, timeframe: z.string().max(8).default("1d"), limit: boundedLimit(90, 1000) }))
    .query(async ({ input }) => {
      requireKnownSymbol(input.symbol);
      return getHistoricalCandles(input.symbol, input.limit);
    }),

  compare: publicProcedure
    .input(z.object({ symbols: z.array(symbolInput).min(2).max(5) }))
    .query(async ({ input }) => {
      input.symbols.forEach(requireKnownSymbol);
      const results = [];
      for (const symbol of input.symbols) {
        const candles = await getHistoricalCandles(symbol, 30);
        if (candles.length === 0) continue;
        const firstClose = candles[0].close;
        results.push({
          symbol,
          data: candles.map(c => ({
            timestamp: c.timestamp,
            normalizedReturn: Math.round(((c.close - firstClose) / firstClose) * 10000) / 100,
          })),
        });
      }
      return results;
    }),
});

// ─── Watchlists Router ────────────────────────────────────────────────────────
const watchlistsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserWatchlists(ctx.user.id);
  }),

  detail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const wl = await getWatchlistWithItems(input.id, ctx.user.id);
      if (!wl) throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist not found" });
      const priceMap = await getCurrentPrices(wl.items.map(item => item.asset.symbol));
      const enrichedItems = wl.items.map(item => ({
        ...item,
        // null when Yahoo has no quote; the UI shows a dash instead of an invented price
        price: priceMap.get(item.asset.symbol) ?? null,
        market: marketOf(item.asset.symbol),
      }));
      return { ...wl, items: enrichedItems };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      market: z.enum(["india", "crypto", "us", "all"]).default("all"),
    }))
    .mutation(async ({ ctx, input }) => {
      await createWatchlist(ctx.user.id, input.name, input.description);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWatchlist(input.id, ctx.user.id);
      return { success: true };
    }),

  addItem: protectedProcedure
    .input(z.object({ watchlistId: z.number(), symbol: symbolInput }))
    .mutation(async ({ ctx, input }) => {
      let asset = await getAssetBySymbol(input.symbol);
      if (!asset) {
        const found = REF_BY_SYMBOL.get(input.symbol);
        if (!found) throw new TRPCError({ code: "NOT_FOUND", message: `Asset '${input.symbol}' not found` });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { assets: assetsTable } = await import("../drizzle/schema");
        await db.insert(assetsTable).values({
          symbol: found.symbol,
          name: found.name,
          assetType: found.kind === "crypto" ? "crypto" : found.kind === "index" ? "index" : "stock",
          sector: found.sector ?? null,
          exchange: found.exchange ?? null,
          currency: found.currency ?? "INR",
          isActive: true,
        }).onDuplicateKeyUpdate({ set: { isActive: true } });
        asset = await getAssetBySymbol(input.symbol);
        if (!asset) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create asset" });
      }
      await addToWatchlist(input.watchlistId, asset.id);
      return { success: true };
    }),

  removeItem: protectedProcedure
    .input(z.object({ watchlistId: z.number(), assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeFromWatchlist(input.watchlistId, input.assetId);
      return { success: true };
    }),
});

// ─── Alerts Router ────────────────────────────────────────────────────────────
const alertsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getUserAlerts(ctx.user.id)),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getUnreadAlertCount(ctx.user.id);
    return { count };
  }),

  history: protectedProcedure
    .input(z.object({ limit: boundedLimit(50) }))
    .query(async ({ ctx, input }) => getAlertHistory(ctx.user.id, input.limit)),

  create: protectedProcedure
    .input(z.object({
      assetId: z.number().optional(),
      market: z.enum(["india", "crypto", "us"]).optional(),
      alertType: z.enum(["ema_crossover", "volume_spike", "breakout_52w", "breakout_ath", "sector_momentum_shift", "trend_reversal", "relative_strength_change", "price_target"]),
      condition: z.object({
        threshold: z.number().optional(),
        direction: z.enum(["above", "below", "cross"]).optional(),
        ema1: z.number().optional(),
        ema2: z.number().optional(),
        sector: z.string().max(64).optional(),
        timeframe: z.string().max(8).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await createAlert({ userId: ctx.user.id, assetId: input.assetId, alertType: input.alertType, condition: input.condition });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await updateAlert(input.id, ctx.user.id, { isActive: input.isActive });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAlert(input.id, ctx.user.id);
      return { success: true };
    }),

  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAlertsRead(ctx.user.id);
    return { success: true };
  }),
});

// ─── Historical Router ────────────────────────────────────────────────────────
const historicalRouter = router({
  indiaSectorRotation: publicProcedure
    .input(z.object({ days: boundedDays(30) }))
    .query(async ({ input }) => getSectorRotationHistory("india", INDIA_SECTORS, input.days)),

  indiaSentiment: publicProcedure
    .input(z.object({ days: boundedDays(90) }))
    .query(async ({ input }) => getIndiaSentimentHistory(input.days)),

  cryptoSentiment: publicProcedure
    .input(z.object({ days: boundedDays(30) }))
    .query(async ({ input }) => {
      const history = await getFearGreedHistory(input.days);
      return history.slice(-(input.days + 1)).map(p => ({
        timestamp: p.timestamp,
        fearGreedIndex: p.value,
        label: fearGreedLabel(p.value),
      }));
    }),

  performance: publicProcedure
    .input(z.object({ symbols: z.array(symbolInput).max(10), days: boundedDays(30) }))
    .query(async ({ input }) => {
      input.symbols.forEach(requireKnownSymbol);
      const results = [];
      for (const symbol of input.symbols) {
        const candles = await getHistoricalCandles(symbol, input.days);
        if (candles.length === 0) continue;
        const firstClose = candles[0].close;
        const lastClose = candles[candles.length - 1].close;
        results.push({
          symbol,
          totalReturn: Math.round(((lastClose - firstClose) / firstClose) * 10000) / 100,
          data: candles.map(c => ({
            timestamp: c.timestamp,
            normalizedReturn: Math.round(((c.close - firstClose) / firstClose) * 10000) / 100,
          })),
        });
      }
      return results;
    }),

  // Scanner results stored by the scheduled job. Only rows written from live
  // Yahoo data are returned (rows from earlier simulated runs are ignored).
  scannerResults: publicProcedure
    .input(z.object({ scanType: z.string().max(64).default("ema_alignment"), days: boundedDays(7) }))
    .query(async ({ input }) => {
      const rows = await getRecentScanResults(input.scanType, "1D", 300, input.days);
      return rows
        .filter(r => (r.result.details as { source?: string } | null)?.source === "yahoo")
        .slice(0, 100);
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { httpOnly: true, path: "/", sameSite: "lax" });
      return { success: true } as const;
    }),
  }),
  global: globalRouter,
  india: indiaRouter,
  crypto: cryptoRouter,
  us: usRouter,
  commodities: commoditiesRouter,
  assets: assetsRouter,
  watchlists: watchlistsRouter,
  alerts: alertsRouter,
  historical: historicalRouter,
  settings: settingsRouter,
  notifications: notificationsRouter,
  journal: journalRouter,
});

export type AppRouter = typeof appRouter;
