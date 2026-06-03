import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { settingsRouter } from "./routers/settings";
import { notificationsRouter } from "./routers/notifications";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  getAllAssets, getAssetBySymbol, searchAssets,
  getLatestSentiment, getSentimentHistory,
  getUserWatchlists, getWatchlistWithItems, createWatchlist, deleteWatchlist,
  addToWatchlist, removeFromWatchlist,
  getFavoriteSectors, toggleFavoriteSector,
  getSavedScans, createSavedScan, deleteSavedScan,
  getUserAlerts, createAlert, updateAlert, deleteAlert,
  getUnreadAlertCount, getAlertHistory, markAlertsRead,
  getRecentScanResults, getHistoricalSnapshots,
} from "./db";
import {
  generateCurrentPrice, generateMarketData, generateMarketSentiment,
  generateSectorPerformance, runScanner,
  NSE_STOCKS, CRYPTO_ASSETS, INDICES,
  calculateEMA, calculateRSI, calculateMomentumScore,
} from "./marketEngine";
import { runImprovedScanner, type ScanType as ImprovedScanType, type Timeframe as ImprovedTimeframe } from "./scannerEngine";
import { runPatternScanner, PATTERN_NAMES, type PatternResult } from "./patternEngine";
import { runDataValidation, NSE_REGISTRY, CRYPTO_REGISTRY, US_REGISTRY } from "./assetRegistry";

// ─── Domain Constants ─────────────────────────────────────────────────────────

const INDIA_SECTORS = [
  "Information Technology", "Banking & Finance", "Energy & Oil",
  "Healthcare & Pharma", "Consumer Goods", "Metals & Mining",
  "Automobile", "Real Estate", "Telecom", "FMCG", "Infrastructure",
];

const CRYPTO_SECTORS = ["Cryptocurrency"];

const US_SECTORS = [
  "US Technology", "US Financials", "US Healthcare", "US Energy",
  "US Consumer Discretionary", "US Industrials",
];

const US_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "US Technology", exchange: "NASDAQ", currency: "USD" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "US Technology", exchange: "NASDAQ", currency: "USD" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "US Technology", exchange: "NASDAQ", currency: "USD" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "US Consumer Discretionary", exchange: "NASDAQ", currency: "USD" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "US Technology", exchange: "NASDAQ", currency: "USD" },
  { symbol: "META", name: "Meta Platforms", sector: "US Technology", exchange: "NASDAQ", currency: "USD" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "US Consumer Discretionary", exchange: "NASDAQ", currency: "USD" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "US Financials", exchange: "NYSE", currency: "USD" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "US Healthcare", exchange: "NYSE", currency: "USD" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "US Energy", exchange: "NYSE", currency: "USD" },
];

const US_INDICES = [
  { symbol: "SPX", name: "S&P 500", sector: "US Index", exchange: "NYSE", currency: "USD" },
  { symbol: "NDX", name: "NASDAQ 100", sector: "US Index", exchange: "NASDAQ", currency: "USD" },
  { symbol: "DJI", name: "Dow Jones Industrial", sector: "US Index", exchange: "NYSE", currency: "USD" },
  { symbol: "VIX", name: "CBOE Volatility Index", sector: "US Index", exchange: "CBOE", currency: "USD" },
];

// ─── Shared scanner scan types ────────────────────────────────────────────────
const SCAN_TYPES = z.enum([
  "ema_alignment", "volume_spike", "breakout_52w", "breakout_ath",
  "momentum_continuation", "relative_strength", "consolidation_breakout",
]);

// Improved scanner scan types (subset without consolidation_breakout, ath_breakout renamed)
const IMPROVED_SCAN_TYPES = z.enum([
  "ema_alignment", "volume_spike", "breakout_52w", "ath_breakout",
  "momentum_continuation", "relative_strength",
]);

const IMPROVED_TIMEFRAMES = z.enum(["15M", "1H", "4H", "1D", "1W"]);

const PATTERN_TIMEFRAMES = z.enum(["15m", "1h", "4h", "1d", "1w"]);

// ─── Global Market Router ─────────────────────────────────────────────────────
const globalRouter = router({
  // Summary of all three market domains for the Home Dashboard
  overview: publicProcedure.query(async () => {
    const indiaSentiment = generateMarketSentiment();
    const cryptoSentiment = {
      sentimentScore: Math.round((Math.sin(Date.now() / 3600000 * 0.7) * 35 + 10) * 100) / 100,
      marketState: "neutral" as const,
      fearGreedIndex: Math.round((35 + Math.sin(Date.now() / 3600000 * 0.5) * 25) * 100) / 100,
      btcDominance: Math.round((44 + Math.sin(Date.now() / 3600000 * 0.3) * 8) * 100) / 100,
    };
    const usSentiment = {
      sentimentScore: Math.round((Math.sin(Date.now() / 3600000 * 0.4) * 30 + 15) * 100) / 100,
      marketState: "bullish" as const,
      spxChange: Math.round((Math.sin(Date.now() / 3600000 * 0.2) * 1.5 + 0.3) * 100) / 100,
    };

    // India top movers (NSE only)
    const indiaPrices = NSE_STOCKS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const indiaGainers = [...indiaPrices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const indiaLosers = [...indiaPrices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

    // Crypto top movers (crypto only)
    const cryptoPrices = CRYPTO_ASSETS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const cryptoGainers = [...cryptoPrices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const cryptoLosers = [...cryptoPrices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

    // US top movers (US stocks only)
    const usPrices = US_STOCKS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const usGainers = [...usPrices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const usLosers = [...usPrices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

    return {
      india: { sentiment: indiaSentiment, topGainers: indiaGainers, topLosers: indiaLosers },
      crypto: { sentiment: cryptoSentiment, topGainers: cryptoGainers, topLosers: cryptoLosers },
      us: { sentiment: usSentiment, topGainers: usGainers, topLosers: usLosers },
    };
  }),

  recentAlerts: protectedProcedure.query(async ({ ctx }) => {
    return getAlertHistory(ctx.user.id, 5);
  }),

  // Cross-market pattern scanner — all markets combined
  patterns: publicProcedure
    .input(z.object({
      market: z.enum(["india", "crypto", "us", "all"]).default("all"),
      timeframes: z.array(PATTERN_TIMEFRAMES).default(["1d"]),
      minConfidence: z.number().default(50),
      requireVolumeConfirmation: z.boolean().default(false),
      filterFalseBreakouts: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const assets: Array<{ symbol: string; basePrice?: number; sector?: string | null }> = [];
      if (input.market === "india" || input.market === "all") assets.push(...NSE_REGISTRY);
      if (input.market === "crypto" || input.market === "all") assets.push(...CRYPTO_REGISTRY);
      if (input.market === "us" || input.market === "all") assets.push(...US_REGISTRY);
      return runPatternScanner(assets, {
        timeframes: input.timeframes as any,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 1,
      });
    }),

  // Data validation endpoint — registry integrity audit
  validateRegistry: publicProcedure.query(async () => {
    return runDataValidation();
  }),
});

// ─── India Market Router ──────────────────────────────────────────────────────
const indiaRouter = router({
  // Dashboard overview — NSE stocks and Indian indices only
  dashboard: publicProcedure.query(async () => {
    const sentiment = generateMarketSentiment();
    const sectorData = INDIA_SECTORS.map(s => {
      const perf = generateSectorPerformance(s);
      return { sector: s, priceChange1d: perf.priceChange1d, priceChange1w: perf.priceChange1w, priceChange1m: perf.priceChange1m, momentumScore: perf.momentumScore, strengthScore: perf.strengthScore, volumeScore: perf.volumeScore, breakoutFrequency: perf.breakoutFrequency, inflowOutflow: perf.inflowOutflow, performanceScore: perf.performanceScore };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    const prices = NSE_STOCKS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const topGainers = [...prices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
    const topLosers = [...prices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);

    const indices = INDICES.map(idx => ({ ...idx, ...generateCurrentPrice(idx.symbol) }));

    // FII/DII simulated activity
    const seed = Math.floor(Date.now() / 3600000);
    const fiiActivity = {
      netBuy: Math.round((Math.sin(seed * 0.3) * 3000 + 500) * 100) / 100,
      grossBuy: Math.round((8000 + Math.sin(seed * 0.2) * 2000) * 100) / 100,
      grossSell: Math.round((7500 + Math.sin(seed * 0.25) * 2000) * 100) / 100,
    };
    const diiActivity = {
      netBuy: Math.round((Math.sin(seed * 0.4) * 2000 + 800) * 100) / 100,
      grossBuy: Math.round((6000 + Math.sin(seed * 0.35) * 1500) * 100) / 100,
      grossSell: Math.round((5200 + Math.sin(seed * 0.45) * 1500) * 100) / 100,
    };

    return {
      sentiment,
      sectorPerformance: sectorData,
      topGainers,
      topLosers,
      indices,
      fiiActivity,
      diiActivity,
      breadth: {
        advanceCount: sentiment.advanceCount,
        declineCount: sentiment.declineCount,
        unchangedCount: sentiment.unchangedCount,
        advanceDeclineRatio: sentiment.advanceDeclineRatio,
        breadthScore: sentiment.breadthScore,
      },
    };
  }),

  // NSE sector heatmap — India sectors only
  sectorHeatmap: publicProcedure.query(async () => {
    return INDIA_SECTORS.map(sector => {
      const perf = generateSectorPerformance(sector);
      return { sector, change: perf.priceChange1d, score: perf.performanceScore, inflowOutflow: perf.inflowOutflow };
    });
  }),

  // Sector rotation — India sectors only
  sectorRotation: publicProcedure
    .input(z.object({ timeframe: z.string().default("1d") }))
    .query(async ({ input }) => {
      return INDIA_SECTORS.map((sector, i) => {
        const perf = generateSectorPerformance(sector);
        return { ...perf, sector, timeframe: input.timeframe, rank: i + 1 };
      }).sort((a, b) => b.performanceScore - a.performanceScore)
        .map((s, i) => ({ ...s, rank: i + 1 }));
    }),

  // Sector detail — India sectors only
  sectorDetail: publicProcedure
    .input(z.object({ sector: z.string(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      if (!INDIA_SECTORS.includes(input.sector)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid India sector" });
      }
      const current = generateSectorPerformance(input.sector);
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = input.sector.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const daySeed = Math.floor(ts.getTime() / 86400000);
        const change = Math.sin((seed + daySeed) * 0.3) * 3 + (Math.random() - 0.5) * 2;
        history.push({
          timestamp: ts,
          performanceScore: Math.round((50 + change * 5) * 100) / 100,
          priceChange1d: Math.round(change * 100) / 100,
          inflowOutflow: Math.round((change * 200 + (Math.random() - 0.5) * 100) * 100) / 100,
        });
      }
      const sectorAssets = NSE_STOCKS.filter(a => a.sector === input.sector)
        .map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
      return { current, history, assets: sectorAssets };
    }),

  // NSE scanner — NSE stocks only (improved accuracy engine)
  scanner: publicProcedure
    .input(z.object({
      scanType: IMPROVED_SCAN_TYPES,
      timeframe: IMPROVED_TIMEFRAMES.default("1D"),
      sector: z.string().optional(),
      minQualityScore: z.number().default(30),
      maxResults: z.number().default(20),
      volumeMultiplier: z.number().default(2.0),
    }))
    .query(async ({ input }) => {
      if (input.sector && !INDIA_SECTORS.includes(input.sector)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid India sector" });
      }
      return runImprovedScanner({
        domain: "india",
        scanType: input.scanType as ImprovedScanType,
        timeframe: input.timeframe as ImprovedTimeframe,
        sector: input.sector,
        minQualityScore: input.minQualityScore,
        maxResults: input.maxResults,
        volumeMultiplier: input.volumeMultiplier,
      });
    }),

  // NSE pattern scanner — India patterns only
  patterns: publicProcedure
    .input(z.object({
      timeframes: z.array(PATTERN_TIMEFRAMES).default(["1d"]),
      minConfidence: z.number().default(50),
      requireVolumeConfirmation: z.boolean().default(false),
      filterFalseBreakouts: z.boolean().default(true),
      sector: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const assets = input.sector
        ? NSE_REGISTRY.filter(a => a.sector.toLowerCase() === input.sector!.toLowerCase())
        : NSE_REGISTRY;
      return runPatternScanner(assets, {
        timeframes: input.timeframes as any,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 2,
      });
    }),

  // NSE stocks list
  stocks: publicProcedure
    .input(z.object({ sector: z.string().optional() }))
    .query(async ({ input }) => {
      let list = [...NSE_STOCKS];
      if (input.sector) list = list.filter(a => a.sector === input.sector);
      return list.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    }),

  // Indian indices
  indices: publicProcedure.query(async () => {
    return INDICES.map(idx => ({ ...idx, ...generateCurrentPrice(idx.symbol) }));
  }),

  // India sentiment history
  sentimentHistory: publicProcedure
    .input(z.object({ days: z.number().default(90) }))
    .query(async ({ input }) => {
      const dbData = await getSentimentHistory(input.days);
      if (dbData.length > 0) return dbData;
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = Math.floor(ts.getTime() / 86400000);
        const score = Math.sin(seed * 0.08) * 45 + Math.sin(seed * 0.03) * 20;
        history.push({
          timestamp: ts,
          sentimentScore: Math.round(score * 100) / 100,
          marketState: score > 20 ? "bullish" : score < -20 ? "bearish" : "neutral",
          volatilityIndex: Math.round((15 + Math.abs(Math.sin(seed * 0.1)) * 12) * 100) / 100,
          advanceDeclineRatio: Math.round((1 + score / 100) * 100) / 100,
        });
      }
      return history;
    }),

  // India sector rotation history
  sectorRotationHistory: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const snapshots = await getHistoricalSnapshots("sector_rotation", input.days);
      if (snapshots.length > 0) return snapshots;
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        history.push({
          timestamp: ts,
          data: INDIA_SECTORS.map(sector => ({
            sector,
            rank: Math.floor(Math.random() * INDIA_SECTORS.length) + 1,
            score: Math.round((30 + Math.random() * 70) * 100) / 100,
          })),
        });
      }
      return history;
    }),

  // India favorites
  favoriteSectors: protectedProcedure.query(async ({ ctx }) => {
    return getFavoriteSectors(ctx.user.id);
  }),

  toggleFavoriteSector: protectedProcedure
    .input(z.object({ sector: z.string() }))
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
        scanType: z.string(),
        timeframe: z.string(),
        sector: z.string().optional(),
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
  // Crypto dashboard — crypto assets only
  dashboard: publicProcedure.query(async () => {
    const seed = Math.floor(Date.now() / 3600000);
    const btcPrice = generateCurrentPrice("BTC");
    const ethPrice = generateCurrentPrice("ETH");

    const cryptoPrices = CRYPTO_ASSETS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const topGainers = [...cryptoPrices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
    const topLosers = [...cryptoPrices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);

    const btcDominance = Math.round((44 + Math.sin(seed * 0.3) * 8) * 100) / 100;
    const fearGreedIndex = Math.round((35 + Math.sin(seed * 0.5) * 25) * 100) / 100;
    const fearGreedLabel = fearGreedIndex < 25 ? "Extreme Fear" : fearGreedIndex < 45 ? "Fear" : fearGreedIndex < 55 ? "Neutral" : fearGreedIndex < 75 ? "Greed" : "Extreme Greed";

    const totalMarketCap = Math.round((2.1 + Math.sin(seed * 0.2) * 0.3) * 1e12 * 100) / 100;
    const totalVolume24h = Math.round((85 + Math.sin(seed * 0.4) * 20) * 1e9 * 100) / 100;

    // Altcoin momentum — ETH, BNB, SOL, etc. vs BTC
    const altcoins = CRYPTO_ASSETS.filter(a => a.symbol !== "BTC").map(a => {
      const price = generateCurrentPrice(a.symbol);
      const btcReturn = btcPrice.changePercent;
      const altReturn = price.changePercent;
      return {
        ...a,
        ...price,
        relativeStrengthVsBTC: Math.round((altReturn - btcReturn) * 100) / 100,
      };
    }).sort((a, b) => b.relativeStrengthVsBTC - a.relativeStrengthVsBTC);

    // Exchange activity simulation
    const exchangeActivity = [
      { exchange: "Binance", volume24h: Math.round((28 + Math.sin(seed * 0.3) * 5) * 1e9), dominance: 32 },
      { exchange: "Coinbase", volume24h: Math.round((12 + Math.sin(seed * 0.4) * 3) * 1e9), dominance: 14 },
      { exchange: "OKX", volume24h: Math.round((10 + Math.sin(seed * 0.5) * 2) * 1e9), dominance: 12 },
      { exchange: "Bybit", volume24h: Math.round((8 + Math.sin(seed * 0.6) * 2) * 1e9), dominance: 9 },
      { exchange: "Kraken", volume24h: Math.round((5 + Math.sin(seed * 0.7) * 1) * 1e9), dominance: 6 },
    ];

    return {
      btcPrice,
      ethPrice,
      btcDominance,
      fearGreedIndex,
      fearGreedLabel,
      totalMarketCap,
      totalVolume24h,
      topGainers,
      topLosers,
      altcoinMomentum: altcoins,
      exchangeActivity,
    };
  }),

  // Crypto heatmap — crypto only
  heatmap: publicProcedure.query(async () => {
    return CRYPTO_ASSETS.map(a => {
      const price = generateCurrentPrice(a.symbol);
      return {
        symbol: a.symbol,
        name: a.name,
        change: price.changePercent,
        price: price.price,
        volume: price.volume,
      };
    });
  }),

  // Crypto scanner — crypto only (improved accuracy engine)
  scanner: publicProcedure
    .input(z.object({
      scanType: IMPROVED_SCAN_TYPES,
      timeframe: IMPROVED_TIMEFRAMES.default("1D"),
      minQualityScore: z.number().default(30),
      maxResults: z.number().default(20),
      volumeMultiplier: z.number().default(2.0),
    }))
    .query(async ({ input }) => {
      return runImprovedScanner({
        domain: "crypto",
        scanType: input.scanType as ImprovedScanType,
        timeframe: input.timeframe as ImprovedTimeframe,
        minQualityScore: input.minQualityScore,
        maxResults: input.maxResults,
        volumeMultiplier: input.volumeMultiplier,
      });
    }),

  // Crypto pattern scanner — crypto patterns only
  patterns: publicProcedure
    .input(z.object({
      timeframes: z.array(PATTERN_TIMEFRAMES).default(["1d"]),
      minConfidence: z.number().default(50),
      requireVolumeConfirmation: z.boolean().default(false),
      filterFalseBreakouts: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      return runPatternScanner(CRYPTO_REGISTRY, {
        timeframes: input.timeframes as any,
        minConfidence: input.minConfidence,
        requireVolumeConfirmation: input.requireVolumeConfirmation,
        filterFalseBreakouts: input.filterFalseBreakouts,
        maxResultsPerAsset: 2,
      });
    }),

  // Crypto assets list
  assets: publicProcedure.query(async () => {
    return CRYPTO_ASSETS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
  }),

  // BTC dominance history
  btcDominanceHistory: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = Math.floor(ts.getTime() / 86400000);
        history.push({
          timestamp: ts,
          btcDominance: Math.round((44 + Math.sin(seed * 0.05) * 8) * 100) / 100,
          ethDominance: Math.round((18 + Math.sin(seed * 0.06) * 4) * 100) / 100,
          altcoinDominance: Math.round((38 - Math.sin(seed * 0.04) * 6) * 100) / 100,
        });
      }
      return history;
    }),

  // Fear & Greed history
  fearGreedHistory: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = Math.floor(ts.getTime() / 86400000);
        const value = Math.round((35 + Math.sin(seed * 0.08) * 30 + Math.sin(seed * 0.03) * 15) * 100) / 100;
        history.push({
          timestamp: ts,
          value: Math.max(0, Math.min(100, value)),
          label: value < 25 ? "Extreme Fear" : value < 45 ? "Fear" : value < 55 ? "Neutral" : value < 75 ? "Greed" : "Extreme Greed",
        });
      }
      return history;
    }),

  // Crypto saved scans
  savedScans: protectedProcedure.query(async ({ ctx }) => {
    return getSavedScans(ctx.user.id);
  }),

  saveScan: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      config: z.object({ scanType: z.string(), timeframe: z.string(), minVolume: z.number().optional() }),
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
  // US dashboard — US stocks and indices only
  dashboard: publicProcedure.query(async () => {
    const seed = Math.floor(Date.now() / 3600000);
    const indices = US_INDICES.map(idx => ({ ...idx, ...generateCurrentPrice(idx.symbol) }));
    const prices = US_STOCKS.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    const topGainers = [...prices].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
    const topLosers = [...prices].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);

    const sectorData = US_SECTORS.map(s => {
      const perf = generateSectorPerformance(s);
      return { sector: s, priceChange1d: perf.priceChange1d, priceChange1w: perf.priceChange1w, priceChange1m: perf.priceChange1m, momentumScore: perf.momentumScore, strengthScore: perf.strengthScore, volumeScore: perf.volumeScore, breakoutFrequency: perf.breakoutFrequency, inflowOutflow: perf.inflowOutflow, performanceScore: perf.performanceScore };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    const marketSentiment = {
      sentimentScore: Math.round((Math.sin(seed * 0.4) * 30 + 15) * 100) / 100,
      marketState: "bullish" as const,
      advanceCount: Math.floor(280 + Math.sin(seed * 0.3) * 80),
      declineCount: Math.floor(180 + Math.sin(seed * 0.4) * 60),
      breadthScore: Math.round((55 + Math.sin(seed * 0.5) * 20) * 100) / 100,
    };

    return {
      indices,
      topGainers,
      topLosers,
      sectorHeatmap: sectorData,
      marketSentiment,
      isLive: false, // US module is future-ready
    };
  }),

  // US sector heatmap
  sectorHeatmap: publicProcedure.query(async () => {
    return US_SECTORS.map(sector => {
      const perf = generateSectorPerformance(sector);
      return { sector, change: perf.priceChange1d, score: perf.performanceScore, inflowOutflow: perf.inflowOutflow };
    });
  }),

  // US scanner
  scanner: publicProcedure
    .input(z.object({
      scanType: SCAN_TYPES,
      timeframe: z.string().default("1d"),
      sector: z.string().optional(),
      minVolumeRatio: z.number().default(2.0),
    }))
    .query(async ({ input }) => {
      const results = runScanner(US_STOCKS, input.scanType, input.timeframe, {
        sector: input.sector,
        minVolumeRatio: input.minVolumeRatio,
      });
      return results.map(r => {
        const asset = US_STOCKS.find(a => a.symbol === r.symbol);
        return { ...r, ...asset, ...generateCurrentPrice(r.symbol) };
      });
    }),

  // US stocks list
  stocks: publicProcedure
    .input(z.object({ sector: z.string().optional() }))
    .query(async ({ input }) => {
      let list = [...US_STOCKS];
      if (input.sector) list = list.filter(a => a.sector === input.sector);
      return list.map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    }),

  // US indices
  indices: publicProcedure.query(async () => {
    return US_INDICES.map(idx => ({ ...idx, ...generateCurrentPrice(idx.symbol) }));
  }),
});

// ─── Unified Asset Router (for asset detail/chart, cross-domain search) ───────
const assetsRouter = router({
  search: publicProcedure
    .input(z.object({ query: z.string().min(1), market: z.enum(["india", "crypto", "us", "all"]).default("all") }))
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();
      let all: Array<{ symbol: string; name: string; sector?: string; exchange?: string; currency?: string }> = [];
      if (input.market === "india" || input.market === "all") all = [...all, ...NSE_STOCKS, ...INDICES];
      if (input.market === "crypto" || input.market === "all") all = [...all, ...CRYPTO_ASSETS];
      if (input.market === "us" || input.market === "all") all = [...all, ...US_STOCKS, ...US_INDICES];
      return all.filter(a =>
        a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      ).slice(0, 15).map(a => ({ ...a, ...generateCurrentPrice(a.symbol) }));
    }),

  detail: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const all = [...NSE_STOCKS, ...CRYPTO_ASSETS, ...INDICES, ...US_STOCKS, ...US_INDICES];
      const asset = all.find(a => a.symbol === input.symbol);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });

      const candles = generateMarketData(input.symbol, 365);
      const closes = candles.map(c => c.close);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, 200);
      const rsi = calculateRSI(closes);
      const high52w = Math.max(...closes.slice(-252));
      const low52w = Math.min(...closes.slice(-252));
      const ath = Math.max(...closes);
      const volumeAvg20 = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
      const price = generateCurrentPrice(input.symbol);

      // Determine market domain
      const market = CRYPTO_ASSETS.some(a => a.symbol === input.symbol) ? "crypto"
        : US_STOCKS.some(a => a.symbol === input.symbol) || US_INDICES.some(a => a.symbol === input.symbol) ? "us"
        : "india";

      return {
        ...asset,
        market,
        ...price,
        candles,
        emaData: {
          ema20: ema20.map(v => Math.round(v * 100) / 100),
          ema50: ema50.map(v => Math.round(v * 100) / 100),
          ema200: ema200.map(v => Math.round(v * 100) / 100),
        },
        indicators: {
          ema20: Math.round(ema20[ema20.length - 1] * 100) / 100,
          ema50: Math.round(ema50[ema50.length - 1] * 100) / 100,
          ema200: Math.round(ema200[ema200.length - 1] * 100) / 100,
          rsi: Math.round(rsi * 100) / 100,
          high52w: Math.round(high52w * 100) / 100,
          low52w: Math.round(low52w * 100) / 100,
          ath: Math.round(ath * 100) / 100,
          volumeAvg20: Math.round(volumeAvg20),
          volumeRatio: Math.round((price.volume / volumeAvg20) * 100) / 100,
        },
      };
    }),

  ohlcv: publicProcedure
    .input(z.object({ symbol: z.string(), timeframe: z.string().default("1d"), limit: z.number().default(90) }))
    .query(async ({ input }) => generateMarketData(input.symbol, input.limit)),

  compare: publicProcedure
    .input(z.object({ symbols: z.array(z.string()).min(2).max(5) }))
    .query(async ({ input }) => {
      return input.symbols.map(symbol => {
        const candles = generateMarketData(symbol, 30);
        const firstClose = candles[0]?.close ?? 1;
        return {
          symbol,
          data: candles.map(c => ({
            timestamp: c.timestamp,
            normalizedReturn: Math.round(((c.close - firstClose) / firstClose) * 10000) / 100,
          })),
        };
      });
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
      const enrichedItems = wl.items.map(item => ({
        ...item,
        price: generateCurrentPrice(item.asset.symbol),
        market: CRYPTO_ASSETS.some(a => a.symbol === item.asset.symbol) ? "crypto"
          : US_STOCKS.some(a => a.symbol === item.asset.symbol) ? "us" : "india",
      }));
      return { ...wl, items: enrichedItems };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
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
    .input(z.object({ watchlistId: z.number(), symbol: z.string() }))
    .mutation(async ({ ctx, input }) => {
      let asset = await getAssetBySymbol(input.symbol);
      if (!asset) {
        const allAssets = [...NSE_STOCKS, ...CRYPTO_ASSETS, ...INDICES, ...US_STOCKS, ...US_INDICES];
        const found = allAssets.find(a => a.symbol === input.symbol);
        if (!found) throw new TRPCError({ code: "NOT_FOUND", message: `Asset '${input.symbol}' not found` });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { assets: assetsTable } = await import("../drizzle/schema");
        await db.insert(assetsTable).values({
          symbol: found.symbol,
          name: found.name,
          assetType: (found as any).exchange === "CRYPTO" ? "crypto"
            : (found as any).exchange === "INDEX" ? "index"
            : (found as any).exchange === "NASDAQ" || (found as any).exchange === "NYSE" ? "stock"
            : "stock",
          sector: found.sector ?? null,
          exchange: (found as any).exchange ?? null,
          currency: (found as any).currency ?? "INR",
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
    .input(z.object({ limit: z.number().default(50) }))
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
        sector: z.string().optional(),
        timeframe: z.string().optional(),
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
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const snapshots = await getHistoricalSnapshots("sector_rotation", input.days);
      if (snapshots.length > 0) return snapshots;
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        history.push({
          timestamp: ts,
          data: INDIA_SECTORS.map(sector => ({
            sector,
            rank: Math.floor(Math.random() * INDIA_SECTORS.length) + 1,
            score: Math.round((30 + Math.random() * 70) * 100) / 100,
          })),
        });
      }
      return history;
    }),

  indiaSentiment: publicProcedure
    .input(z.object({ days: z.number().default(90) }))
    .query(async ({ input }) => {
      const dbData = await getSentimentHistory(input.days);
      if (dbData.length > 0) return dbData;
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = Math.floor(ts.getTime() / 86400000);
        const score = Math.sin(seed * 0.08) * 45 + Math.sin(seed * 0.03) * 20;
        history.push({
          timestamp: ts,
          sentimentScore: Math.round(score * 100) / 100,
          marketState: score > 20 ? "bullish" : score < -20 ? "bearish" : "neutral",
          volatilityIndex: Math.round((15 + Math.abs(Math.sin(seed * 0.1)) * 12) * 100) / 100,
        });
      }
      return history;
    }),

  cryptoSentiment: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const history = [];
      for (let i = input.days; i >= 0; i--) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const seed = Math.floor(ts.getTime() / 86400000);
        const fg = Math.max(0, Math.min(100, 35 + Math.sin(seed * 0.08) * 30 + Math.sin(seed * 0.03) * 15));
        const btcDom = Math.round((44 + Math.sin(seed * 0.05) * 8) * 100) / 100;
        history.push({
          timestamp: ts,
          fearGreedIndex: Math.round(fg * 100) / 100,
          btcDominance: btcDom,
          label: fg < 25 ? "Extreme Fear" : fg < 45 ? "Fear" : fg < 55 ? "Neutral" : fg < 75 ? "Greed" : "Extreme Greed",
        });
      }
      return history;
    }),

  performance: publicProcedure
    .input(z.object({ symbols: z.array(z.string()), days: z.number().default(30) }))
    .query(async ({ input }) => {
      return input.symbols.map(symbol => {
        const candles = generateMarketData(symbol, input.days);
        const firstClose = candles[0]?.close ?? 1;
        const lastClose = candles[candles.length - 1]?.close ?? firstClose;
        return {
          symbol,
          totalReturn: Math.round(((lastClose - firstClose) / firstClose) * 10000) / 100,
          data: candles.map(c => ({
            timestamp: c.timestamp,
            normalizedReturn: Math.round(((c.close - firstClose) / firstClose) * 10000) / 100,
          })),
        };
      });
    }),

  scannerResults: publicProcedure
    .input(z.object({ scanType: z.string().default("ema_alignment"), days: z.number().default(7) }))
    .query(async ({ input }) => {
      return getRecentScanResults(input.scanType, "1d", 100);
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
  assets: assetsRouter,
  watchlists: watchlistsRouter,
  alerts: alertsRouter,
  historical: historicalRouter,
  settings: settingsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
