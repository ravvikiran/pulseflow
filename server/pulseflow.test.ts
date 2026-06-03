import { describe, it, expect } from "vitest";
import {
  generateCurrentPrice,
  generateMarketData,
  generateMarketSentiment,
  generateSectorPerformance,
  runScanner,
  calculateEMA,
  calculateRSI,
  calculateMomentumScore,
  detectEMAAlignment,
  detectVolumeSpike,
  detect52wHighBreakout,
  detectATHBreakout,
  SECTORS,
  NSE_STOCKS,
  CRYPTO_ASSETS,
} from "./marketEngine";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ─── Market Engine Tests ──────────────────────────────────────────────────────

describe("generateCurrentPrice", () => {
  it("returns a valid price snapshot for NSE stocks", () => {
    const result = generateCurrentPrice("TCS");
    expect(result.price).toBeGreaterThan(0);
    expect(result.high).toBeGreaterThanOrEqual(result.price);
    expect(result.low).toBeLessThanOrEqual(result.price);
    expect(result.volume).toBeGreaterThan(0);
    expect(typeof result.changePercent).toBe("number");
  });

  it("returns a valid price snapshot for crypto", () => {
    const result = generateCurrentPrice("BTC");
    expect(result.price).toBeGreaterThan(0);
    expect(result.high).toBeGreaterThanOrEqual(result.low);
  });

  it("returns deterministic results for the same symbol within the same minute", () => {
    const r1 = generateCurrentPrice("RELIANCE");
    const r2 = generateCurrentPrice("RELIANCE");
    expect(r1.price).toBe(r2.price);
  });
});

describe("generateMarketData", () => {
  it("returns 91 candles for 90 days", () => {
    const candles = generateMarketData("INFY", 90);
    expect(candles.length).toBe(91);
  });

  it("each candle has valid OHLCV structure", () => {
    const candles = generateMarketData("HDFCBANK", 10);
    for (const c of candles) {
      expect(c.open).toBeGreaterThan(0);
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
      expect(c.volume).toBeGreaterThan(0);
      expect(c.timestamp).toBeInstanceOf(Date);
    }
  });
});

describe("generateMarketSentiment", () => {
  it("returns valid sentiment data", () => {
    const s = generateMarketSentiment();
    expect(["bullish", "bearish", "neutral"]).toContain(s.marketState);
    expect(s.btcDominance).toBeGreaterThan(0);
    expect(s.btcDominance).toBeLessThan(100);
    expect(s.fearGreedIndex).toBeGreaterThanOrEqual(0);
    expect(s.fearGreedIndex).toBeLessThanOrEqual(100);
    expect(s.advanceDeclineRatio).toBeGreaterThan(0);
    expect(s.volatilityIndex).toBeGreaterThan(0);
  });

  it("advance/decline ratio matches counts", () => {
    const s = generateMarketSentiment();
    const expectedRatio = s.advanceCount / Math.max(1, s.declineCount);
    expect(Math.abs(s.advanceDeclineRatio - expectedRatio)).toBeLessThan(0.01);
  });
});

describe("generateSectorPerformance", () => {
  it("returns valid performance data for an India sector", () => {
    const perf = generateSectorPerformance("Information Technology");
    expect(perf.sector).toBe("Information Technology");
    expect(perf.momentumScore).toBeGreaterThanOrEqual(0);
    expect(perf.momentumScore).toBeLessThanOrEqual(100);
    expect(perf.strengthScore).toBeGreaterThanOrEqual(0);
    expect(perf.performanceScore).toBeGreaterThanOrEqual(0);
    expect(typeof perf.priceChange1d).toBe("number");
    expect(typeof perf.inflowOutflow).toBe("number");
  });

  it("returns deterministic results for same sector in same hour", () => {
    const p1 = generateSectorPerformance("Banking & Finance");
    const p2 = generateSectorPerformance("Banking & Finance");
    expect(p1.performanceScore).toBe(p2.performanceScore);
  });
});

describe("runScanner", () => {
  it("returns array of results for ema_alignment", () => {
    const results = runScanner(NSE_STOCKS, "ema_alignment", "1d", {});
    expect(Array.isArray(results)).toBe(true);
  });

  it("returns array of results for volume_spike", () => {
    const results = runScanner(NSE_STOCKS, "volume_spike", "1d", { minVolumeRatio: 2.0 });
    expect(Array.isArray(results)).toBe(true);
  });

  it("filters by sector correctly", () => {
    const results = runScanner(NSE_STOCKS, "ema_alignment", "1d", { sector: "Information Technology" });
    // All results must be from the filtered sector (sector comes from asset lookup in router, not runScanner itself)
    // runScanner filters by sector before pushing, so all returned symbols must belong to IT sector
    const itSymbols = NSE_STOCKS.filter(a => a.sector === "Information Technology").map(a => a.symbol);
    for (const r of results) {
      expect(itSymbols).toContain(r.symbol);
    }
  });

  it("each result has score and symbol", () => {
    const results = runScanner(NSE_STOCKS, "ema_alignment", "1d", {});
    for (const r of results.slice(0, 5)) {
      expect(r.symbol).toBeTruthy();
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("calculateEMA", () => {
  it("returns an array of the same length as input", () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const ema = calculateEMA(data, 20);
    expect(ema.length).toBe(data.length);
  });

  it("EMA20 is greater than EMA50 in a strong uptrend", () => {
    const data = Array.from({ length: 100 }, (_, i) => 100 + i * 2);
    const ema20 = calculateEMA(data, 20);
    const ema50 = calculateEMA(data, 50);
    const last20 = ema20[ema20.length - 1];
    const last50 = ema50[ema50.length - 1];
    expect(last20).toBeGreaterThan(last50);
  });
});

describe("calculateRSI", () => {
  it("returns a value between 0 and 100", () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
    const rsi = calculateRSI(data);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("returns high RSI for strong uptrend", () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
    const rsi = calculateRSI(data);
    expect(rsi).toBeGreaterThan(60);
  });
});

describe("calculateMomentumScore", () => {
  it("returns a value between 0 and 100", () => {
    // calculateMomentumScore(priceChange1d, priceChange1w, priceChange1m, rsi, volumeRatio)
    const score = calculateMomentumScore(1.5, 3.0, 8.0, 65, 2.5);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("detectEMAAlignment", () => {
  it("returns 'bullish' for bullish EMA stack (price > ema20 > ema50 > ema200)", () => {
    // detectEMAAlignment(price, ema20, ema50, ema200)
    const result = detectEMAAlignment(200, 190, 180, 160);
    expect(result).toBe("bullish");
  });

  it("returns 'bearish' for bearish EMA stack (price < ema20 < ema50 < ema200)", () => {
    const result = detectEMAAlignment(100, 110, 120, 140);
    expect(result).toBe("bearish");
  });

  it("returns 'mixed' for mixed EMA stack", () => {
    const result = detectEMAAlignment(150, 140, 160, 130);
    expect(result).toBe("mixed");
  });
});

describe("detectVolumeSpike", () => {
  it("returns true when current volume is significantly above average", () => {
    // detectVolumeSpike(currentVolume, avgVolume, threshold)
    expect(detectVolumeSpike(500000, 10000, 2.0)).toBe(true);
  });

  it("returns false when current volume is normal", () => {
    expect(detectVolumeSpike(10000, 10000, 2.0)).toBe(false);
  });

  it("returns false when volume is slightly above but below threshold", () => {
    expect(detectVolumeSpike(15000, 10000, 2.0)).toBe(false);
  });
});

describe("detect52wHighBreakout", () => {
  it("returns true when price is at 52-week high (within 1%)", () => {
    // detect52wHighBreakout(currentPrice, high52w)
    expect(detect52wHighBreakout(199, 200)).toBe(true); // 99.5% of 52w high
  });

  it("returns true when price equals 52-week high", () => {
    expect(detect52wHighBreakout(200, 200)).toBe(true);
  });

  it("returns false when price is well below 52-week high", () => {
    expect(detect52wHighBreakout(100, 200)).toBe(false);
  });
});

describe("detectATHBreakout", () => {
  it("returns true when price is at all-time high (within 2%)", () => {
    // detectATHBreakout(currentPrice, ath)
    expect(detectATHBreakout(490, 500)).toBe(true); // 98% of ATH
  });

  it("returns true when price equals ATH", () => {
    expect(detectATHBreakout(500, 500)).toBe(true);
  });

  it("returns false when price is well below ATH", () => {
    expect(detectATHBreakout(100, 500)).toBe(false);
  });
});

// ─── Context Helpers ──────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: User = {
    id: 1,
    openId: "test-user-openid",
    email: "test@pulseflow.io",
    name: "Test User",
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── India Router Tests ───────────────────────────────────────────────────────

describe("india router", () => {
  it("india.dashboard returns NSE sentiment, sectors, and breadth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.dashboard();
    expect(result.sentiment).toBeTruthy();
    expect(result.topGainers.length).toBeGreaterThan(0);
    expect(result.topLosers.length).toBeGreaterThan(0);
    expect(result.sectorPerformance.length).toBeGreaterThan(0);
    expect(result.breadth.advanceCount).toBeGreaterThan(0);
  });

  it("india.sectorHeatmap returns India sectors only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.sectorHeatmap();
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.sector).toBeTruthy();
      expect(typeof s.change).toBe("number");
      // Must NOT contain crypto sectors
      expect(s.sector).not.toBe("Cryptocurrency");
    }
  });

  it("india.sectorRotation returns ranked India sectors", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.sectorRotation({ timeframe: "1d" });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].rank).toBe(1);
    for (const s of result) {
      expect(s.sector).not.toBe("Cryptocurrency");
    }
  });

  it("india.sectorDetail returns current performance and history for valid sector", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.sectorDetail({ sector: "Information Technology", days: 7 });
    expect(result.current.sector).toBe("Information Technology");
    expect(result.history.length).toBeGreaterThan(0);
    expect(Array.isArray(result.assets)).toBe(true);
  });

  it("india.sectorDetail throws for invalid sector", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.india.sectorDetail({ sector: "Cryptocurrency", days: 7 })).rejects.toThrow();
  });

  it("india.scanner returns NSE stocks only for ema_alignment", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.scanner({ scanType: "ema_alignment", timeframe: "1D" });
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      // Must be NSE stocks, not crypto
      expect(r.exchange).not.toBe("CRYPTO");
    }
  });

  it("india.scanner filters by sector", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.scanner({
      scanType: "ema_alignment", timeframe: "1D",
      sector: "Information Technology",
    });
    for (const r of result) {
      expect(r.sector).toBe("Information Technology");
    }
  });

  it("india.stocks returns NSE stocks with live prices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.stocks({});
    expect(result.length).toBeGreaterThan(0);
    for (const a of result.slice(0, 5)) {
      expect(a.symbol).toBeTruthy();
      expect(a.price).toBeGreaterThan(0);
      expect(a.exchange).not.toBe("CRYPTO");
    }
  });

  it("india.indices returns Indian indices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.india.indices();
    expect(result.length).toBeGreaterThan(0);
    for (const idx of result) {
      expect(idx.symbol).toBeTruthy();
      expect(idx.price).toBeGreaterThan(0);
    }
  });
});

// ─── Crypto Router Tests ──────────────────────────────────────────────────────

describe("crypto router", () => {
  it("crypto.dashboard returns BTC dominance, fear/greed, and crypto assets", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.dashboard();
    expect(result.btcDominance).toBeGreaterThan(0);
    expect(result.btcDominance).toBeLessThan(100);
    expect(result.fearGreedIndex).toBeGreaterThanOrEqual(0);
    expect(result.fearGreedIndex).toBeLessThanOrEqual(100);
    expect(result.topGainers.length).toBeGreaterThan(0);
    expect(result.topLosers.length).toBeGreaterThan(0);
  });

  it("crypto.heatmap returns crypto assets only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.heatmap();
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      // Must be crypto assets only
      expect(CRYPTO_ASSETS.some(a => a.symbol === c.symbol)).toBe(true);
    }
  });

  it("crypto.scanner returns crypto assets only for volume_spike", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.scanner({ scanType: "volume_spike", timeframe: "1D" });
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(CRYPTO_ASSETS.some(a => a.symbol === r.symbol)).toBe(true);
    }
  });

  it("crypto.assets returns all crypto assets with prices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.assets();
    expect(result.length).toBeGreaterThan(0);
    for (const a of result) {
      expect(a.price).toBeGreaterThan(0);
      expect(CRYPTO_ASSETS.some(ca => ca.symbol === a.symbol)).toBe(true);
    }
  });

  it("crypto.btcDominanceHistory returns 30-day history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.btcDominanceHistory({ days: 30 });
    expect(result.length).toBe(31);
    for (const d of result) {
      expect(d.btcDominance).toBeGreaterThan(0);
      expect(d.btcDominance).toBeLessThan(100);
    }
  });

  it("crypto.fearGreedHistory returns labeled history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.fearGreedHistory({ days: 7 });
    expect(result.length).toBe(8);
    for (const d of result) {
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThanOrEqual(100);
      expect(d.label).toBeTruthy();
    }
  });
});

// ─── Assets Router Tests ──────────────────────────────────────────────────────

describe("assets router", () => {
  it("assets.search returns matching results for NSE stock", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.search({ query: "TCS" });
    expect(result.some(a => a.symbol === "TCS")).toBe(true);
  });

  it("assets.search returns matching results for crypto", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.search({ query: "BTC" });
    expect(result.some(a => a.symbol === "BTC")).toBe(true);
  });

  it("assets.search with market=india returns only NSE/India assets", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.search({ query: "INFY", market: "india" });
    for (const a of result) {
      expect(CRYPTO_ASSETS.some(ca => ca.symbol === a.symbol)).toBe(false);
    }
  });

  it("assets.search with market=crypto returns only crypto assets", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.search({ query: "ETH", market: "crypto" });
    for (const a of result) {
      expect(CRYPTO_ASSETS.some(ca => ca.symbol === a.symbol)).toBe(true);
    }
  });

  it("assets.detail returns candles and indicators for NSE stock", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.detail({ symbol: "RELIANCE" });
    expect(result.symbol).toBe("RELIANCE");
    expect(result.candles.length).toBeGreaterThan(0);
    expect(result.indicators.ema20).toBeGreaterThan(0);
    expect(result.indicators.ema50).toBeGreaterThan(0);
    expect(result.indicators.ema200).toBeGreaterThan(0);
    expect(result.indicators.rsi).toBeGreaterThanOrEqual(0);
    expect(result.indicators.rsi).toBeLessThanOrEqual(100);
    expect(result.indicators.high52w).toBeGreaterThan(0);
    expect(result.indicators.ath).toBeGreaterThan(0);
  });

  it("assets.detail returns market domain correctly", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const nse = await caller.assets.detail({ symbol: "TCS" });
    expect(nse.market).toBe("india");
    const crypto = await caller.assets.detail({ symbol: "BTC" });
    expect(crypto.market).toBe("crypto");
  });

  it("assets.compare returns normalized returns for multiple symbols", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.compare({ symbols: ["TCS", "INFY"] });
    expect(result.length).toBe(2);
    for (const r of result) {
      expect(r.symbol).toBeTruthy();
      expect(r.data.length).toBeGreaterThan(0);
    }
  });

  it("assets.detail throws for unknown symbol", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.assets.detail({ symbol: "UNKNOWN_XYZ" })).rejects.toThrow();
  });
});

// ─── Historical Router Tests ──────────────────────────────────────────────────

describe("historical router", () => {
  it("historical.indiaSentiment returns array with sentimentScore", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.historical.indiaSentiment({ days: 7 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(typeof r.sentimentScore).toBe("number");
    }
  });

  it("historical.indiaSectorRotation returns snapshots with India sector data", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.historical.indiaSectorRotation({ days: 7 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(Array.isArray((r as any).data)).toBe(true);
      // Data should contain India sectors, not crypto
      for (const d of (r as any).data) {
        expect(d.sector).not.toBe("Cryptocurrency");
      }
    }
  });

  it("historical.performance returns normalized returns", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.historical.performance({ symbols: ["TCS", "INFY"], days: 7 });
    expect(result.length).toBe(2);
    for (const r of result) {
      expect(typeof r.totalReturn).toBe("number");
      expect(r.data.length).toBeGreaterThan(0);
    }
  });

  it("historical.cryptoSentiment returns fear/greed history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.historical.cryptoSentiment({ days: 7 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(r.fearGreedIndex).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Global Router Tests ──────────────────────────────────────────────────────

describe("global router", () => {
  it("global.overview returns all three market domains", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.global.overview();
    expect(result.india).toBeTruthy();
    expect(result.crypto).toBeTruthy();
    expect(result.us).toBeTruthy();
    expect(result.india.topGainers.length).toBeGreaterThan(0);
    expect(result.crypto.topGainers.length).toBeGreaterThan(0);
    expect(result.us.topGainers.length).toBeGreaterThan(0);
  });

  it("global.overview India gainers are NSE stocks only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.global.overview();
    for (const g of result.india.topGainers) {
      expect(CRYPTO_ASSETS.some(a => a.symbol === g.symbol)).toBe(false);
    }
  });

  it("global.overview Crypto gainers are crypto assets only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.global.overview();
    for (const g of result.crypto.topGainers) {
      expect(CRYPTO_ASSETS.some(a => a.symbol === g.symbol)).toBe(true);
    }
  });
});

// ─── Auth Router Tests ────────────────────────────────────────────────────────

describe("auth router", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.auth.me();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@pulseflow.io");
  });
});
