import { describe, it, expect } from "vitest";
import {
  calculateEMA,
  calculateRSI,
  calculateMomentumScore,
  detectEMAAlignment,
  detectVolumeSpike,
  detect52wHighBreakout,
  detectATHBreakout,
} from "./indicators";
import { sentimentFromChanges, stateFromScore } from "./marketAnalytics";
import { sessionProgress, mapLimit } from "./dataProvider";
import { CRYPTO_REGISTRY, NSE_REGISTRY, US_REGISTRY, INDEX_REGISTRY, runDataValidation } from "./assetRegistry";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ─── Pure analytics (no network) ──────────────────────────────────────────────

describe("sentimentFromChanges", () => {
  it("is +100 when every mover advances and -100 when every mover declines", () => {
    expect(sentimentFromChanges([1, 2, 3]).sentimentScore).toBe(100);
    expect(sentimentFromChanges([-1, -2]).sentimentScore).toBe(-100);
  });

  it("counts advancers, decliners and unchanged using a 0.1% flat band", () => {
    const s = sentimentFromChanges([1, 0.05, -0.05, -2, 3]);
    expect(s.advanceCount).toBe(2);
    expect(s.declineCount).toBe(1);
    expect(s.unchangedCount).toBe(2);
    expect(s.advanceDeclineRatio).toBe(2);
    expect(s.breadthScore).toBe(67);
  });

  it("returns a neutral score for no movers", () => {
    const s = sentimentFromChanges([0, 0.01]);
    expect(s.sentimentScore).toBe(0);
    expect(s.marketState).toBe("neutral");
  });

  it("maps scores to market states", () => {
    expect(stateFromScore(40)).toBe("bullish");
    expect(stateFromScore(-40)).toBe("bearish");
    expect(stateFromScore(5)).toBe("neutral");
  });
});

describe("sessionProgress", () => {
  it("treats India as closed on weekends", () => {
    const saturday = new Date("2026-03-07T08:00:00Z");
    expect(sessionProgress("india", saturday)).toEqual({ fraction: 1, open: false });
  });

  it("reports partial progress during the NSE session (Mon 11:00 IST = 05:30 UTC)", () => {
    const { fraction, open } = sessionProgress("india", new Date("2026-03-09T05:30:00Z"));
    expect(open).toBe(true);
    expect(fraction).toBeGreaterThan(0.2);
    expect(fraction).toBeLessThan(0.6);
  });

  it("is closed for the US after 16:00 New York time", () => {
    // Mon 22:00 UTC = 17:00/18:00 New York depending on DST
    expect(sessionProgress("us", new Date("2026-03-09T22:00:00Z")).open).toBe(false);
  });

  it("crypto is always open", () => {
    expect(sessionProgress("crypto", new Date("2026-03-07T12:00:00Z")).open).toBe(true);
  });
});

describe("mapLimit", () => {
  it("preserves order and never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async n => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("asset registry", () => {
  it("has no duplicates or cross-market contamination", () => {
    const v = runDataValidation();
    expect(v.duplicates).toEqual([]);
    expect(v.crossContamination).toEqual([]);
    expect(v.status).toBe("CLEAN");
  });

  it("no longer lists tickers Yahoo has no data for", () => {
    const all = [...NSE_REGISTRY, ...CRYPTO_REGISTRY, ...US_REGISTRY, ...INDEX_REGISTRY].map(a => a.symbol);
    for (const dead of ["ICICIPRULI", "NIFTYMIDCAP", "NIFTYSMALLCAP"]) expect(all).not.toContain(dead);
  });

  it("does not carry hard-coded prices", () => {
    for (const a of [...NSE_REGISTRY, ...CRYPTO_REGISTRY, ...US_REGISTRY]) {
      expect("basePrice" in a).toBe(false);
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
    expect(result.breadth.advanceCount + result.breadth.declineCount + result.breadth.unchangedCount).toBeGreaterThan(0);
    // FII/DII come from NSE and are null when NSE is unreachable; never invented.
    if (result.fiiActivity) expect(Number.isFinite(result.fiiActivity.netBuy)).toBe(true);
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
    // External sources can be down; values are then null rather than made up.
    if (result.btcDominance !== null) {
      expect(result.btcDominance).toBeGreaterThan(0);
      expect(result.btcDominance).toBeLessThan(100);
    }
    if (result.fearGreedIndex !== null) {
      expect(result.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(result.fearGreedIndex).toBeLessThanOrEqual(100);
    }
    expect(result.topGainers.length).toBeGreaterThan(0);
    expect(result.topLosers.length).toBeGreaterThan(0);
  });

  it("crypto.heatmap returns crypto assets only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.heatmap();
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      // Must be crypto assets only
      expect(CRYPTO_REGISTRY.some(a => a.symbol === c.symbol)).toBe(true);
    }
  });

  it("crypto.scanner returns crypto assets only for volume_spike", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.scanner({ scanType: "volume_spike", timeframe: "1D" });
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(CRYPTO_REGISTRY.some(a => a.symbol === r.symbol)).toBe(true);
    }
  });

  it("crypto.assets returns all crypto assets with prices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.assets();
    expect(result.length).toBeGreaterThan(0);
    for (const a of result) {
      expect(a.price).toBeGreaterThan(0);
      expect(CRYPTO_REGISTRY.some(ca => ca.symbol === a.symbol)).toBe(true);
    }
  });

  it("crypto.fearGreedHistory returns labeled history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crypto.fearGreedHistory({ days: 7 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(8);
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
      expect(CRYPTO_REGISTRY.some(ca => ca.symbol === a.symbol)).toBe(false);
    }
  });

  it("assets.search with market=crypto returns only crypto assets", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.search({ query: "ETH", market: "crypto" });
    for (const a of result) {
      expect(CRYPTO_REGISTRY.some(ca => ca.symbol === a.symbol)).toBe(true);
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

  it("assets.ohlcv, compare and performance reject symbols outside the registry", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.assets.ohlcv({ symbol: "NOTAREALTICKER", limit: 30 })).rejects.toThrow();
    await expect(caller.assets.compare({ symbols: ["TCS", "NOTAREALTICKER"] })).rejects.toThrow();
    await expect(caller.historical.performance({ symbols: ["NOTAREALTICKER"], days: 7 })).rejects.toThrow();
  });

  it("assets.sparklines returns real closes for known symbols only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.assets.sparklines({ symbols: ["TCS", "NOTAREALTICKER"] });
    expect(result["NOTAREALTICKER"]).toBeUndefined();
    if (result["TCS"]) {
      expect(result["TCS"].length).toBeGreaterThanOrEqual(5);
      expect(result["TCS"].every(v => v > 0)).toBe(true);
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

  it("global.marketStatus reports a real state per market, or null when Yahoo is unreachable", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const status = await caller.global.marketStatus();
    if (status === null) return; // source unreachable: UI shows "unavailable", never a guess
    for (const market of ["india", "us", "crypto"] as const) {
      expect(["open", "pre", "post", "closed"]).toContain(status[market].state);
    }
    // Crypto never closes for the weekend.
    expect(status.crypto.state).toBe("open");
  });

  it("global.pulse returns only real, typed signals", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const events = await caller.global.pulse();
    expect(Array.isArray(events)).toBe(true);
    for (const e of events) {
      expect(["breakout", "volume_spike", "momentum"]).toContain(e.type);
      expect(["india", "crypto", "us"]).toContain(e.domain);
      expect(e.message).toContain(e.symbol);
    }
  });


  it("global.overview India gainers are NSE stocks only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.global.overview();
    for (const g of result.india.topGainers) {
      expect(CRYPTO_REGISTRY.some(a => a.symbol === g.symbol)).toBe(false);
    }
  });

  it("global.overview Crypto gainers are crypto assets only", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.global.overview();
    for (const g of result.crypto.topGainers) {
      expect(CRYPTO_REGISTRY.some(a => a.symbol === g.symbol)).toBe(true);
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
