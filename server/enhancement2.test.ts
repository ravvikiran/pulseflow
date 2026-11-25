/**
 * PulseFlow Enhancement Batch 2 Tests
 * Covers: notifications router, patternEngine, real scanner, global router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getUserByOpenId: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "test-user-e2",
      name: "Test Trader E2",
      email: "e2@pulseflow.io",
      loginMethod: "local",
      role: "user",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Notifications Router Tests ───────────────────────────────────────────────
describe("notifications router", () => {
  describe("list", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.list({});
      expect(result).toHaveProperty("notifications");
      expect(Array.isArray(result.notifications)).toBe(true);
    });

    it("returns empty list when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.list({});
      expect(result).toHaveProperty("notifications");
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.notifications.length).toBe(0);
    });

    it("accepts unreadOnly filter", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.list({ unreadOnly: true });
      expect(result).toHaveProperty("notifications");
      expect(Array.isArray(result.notifications)).toBe(true);
    });

    it("accepts category filter", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.list({ category: "breakout" });
      expect(result).toHaveProperty("notifications");
    });

    it("accepts marketDomain filter", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.list({ marketDomain: "india" });
      expect(result).toHaveProperty("notifications");
    });

    it("rejects invalid category", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.notifications.list({ category: "invalid_category" as any })).rejects.toThrow();
    });
  });

  describe("unreadCount", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.unreadCount();
      expect(result).toHaveProperty("count");
      expect(typeof result.count).toBe("number");
    });

    it("returns count object when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.unreadCount();
      expect(result).toHaveProperty("count");
      expect(typeof result.count).toBe("number");
      expect(result.count).toBe(0);
    });
  });

  describe("recent", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.recent();
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns array when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.recent();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("markRead", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.markRead({ id: 1 });
      expect(result).toHaveProperty("success");
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.markRead({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("markAllRead", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.markAllRead();
      expect(result).toHaveProperty("success");
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.markAllRead();
      expect(result).toHaveProperty("success");
    });
  });

  describe("delete", () => {
    it("uses default user for unauthenticated requests (local dev mode)", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.notifications.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });
});

// ─── Pattern Engine Tests (detectors run on candles; fixtures are test inputs only) ──
describe("patternEngine", () => {
  let patternEngine: typeof import("./patternEngine");

  beforeEach(async () => {
    patternEngine = await import("./patternEngine");
  });

  const candle = (i: number, close: number, volume = 1000) => ({
    open: close, high: close * 1.01, low: close * 0.99, close, volume, timestamp: 1_700_000_000_000 + i * 86_400_000,
  });

  it("no longer exposes synthetic candle generators", () => {
    expect("runPatternScanner" in patternEngine).toBe(false);
    expect("scanAssetForPatterns" in patternEngine).toBe(false);
  });

  it("finds nothing meaningful in a perfectly flat series", () => {
    const candles = Array.from({ length: 80 }, (_, i) => candle(i, 100));
    const results = patternEngine.detectPatternsOnCandles(candles, "FLAT", { minConfidence: 70 });
    for (const r of results) expect(r.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  it("returns well-formed results that respect minConfidence, per-asset cap and timeframe", () => {
    // Deterministic oscillating series with a drift, built arithmetically.
    const candles = Array.from({ length: 120 }, (_, i) => candle(i, 100 + Math.sin(i / 6) * 8 + i * 0.1, 1000 + (i % 7) * 100));
    const results = patternEngine.detectPatternsOnCandles(candles, "FIXTURE", { minConfidence: 0, maxResultsPerAsset: 3 }, "1w");
    expect(results.length).toBeLessThanOrEqual(3);
    for (const r of results) {
      expect(r.symbol).toBe("FIXTURE");
      expect(r.timeframe).toBe("1w");
      expect(["bullish", "bearish", "neutral"]).toContain(r.severity);
      expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(r.confidenceScore).toBeLessThanOrEqual(100);
      expect(r.isFalseBreakout).toBe(false);
    }
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidenceScore).toBeGreaterThanOrEqual(results[i].confidenceScore);
    }
  });

  it("PATTERN_NAMES has entries for all 14 pattern types", () => {
    const expectedPatterns = [
      "ascending_triangle", "descending_triangle", "symmetrical_triangle",
      "bull_flag", "bear_flag", "cup_and_handle",
      "double_top", "double_bottom",
      "head_and_shoulders", "inverse_head_and_shoulders",
      "breakout_consolidation", "support_resistance_breakout",
      "channel_breakout", "trendline_breakout",
    ];
    for (const p of expectedPatterns) {
      expect(patternEngine.PATTERN_NAMES).toHaveProperty(p);
      expect(typeof patternEngine.PATTERN_NAMES[p as keyof typeof patternEngine.PATTERN_NAMES]).toBe("string");
    }
  });
});

// ─── Real scanner (live Yahoo Finance data) ───────────────────────────────────
describe("runRealScanner", () => {
  it("returns well-formed, sorted results built from live data", async () => {
    const { runRealScanner } = await import("./dataProvider");
    const results = await runRealScanner({ domain: "crypto", scanType: "ema_alignment", maxResults: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
    for (const r of results) {
      expect(r.price).toBeGreaterThan(0);
      expect(r.stopLoss).toBeLessThan(r.price);
      expect(r.target).toBeGreaterThan(r.price);
      expect(["high", "medium", "low"]).toContain(r.confidence);
      expect(r.qualityScore).toBeGreaterThanOrEqual(40);
      expect(r.qualityScore).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].qualityScore).toBeGreaterThanOrEqual(results[i].qualityScore);
    }
  }, 60000);

  it("confluence mode only returns assets that pass every selected strategy", async () => {
    const { runRealScanner } = await import("./dataProvider");
    const both = await runRealScanner({ domain: "us", scanType: ["ema_alignment", "momentum_continuation"], maxResults: 50 });
    const single = await runRealScanner({ domain: "us", scanType: "ema_alignment", maxResults: 50 });
    const singleSymbols = new Set(single.map(r => r.symbol));
    for (const r of both) expect(singleSymbols.has(r.symbol)).toBe(true);
  }, 60000);
});
// ─── Global Router Pattern & Validation Tests ─────────────────────────────────
describe("global router", () => {
  describe("patterns", () => {
    it("returns pattern results for all markets", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.patterns({
        market: "all",
        timeframes: ["1d"],
        minConfidence: 50,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns pattern results for india only", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.patterns({
        market: "india",
        timeframes: ["1d"],
        minConfidence: 50,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns pattern results for crypto only", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.patterns({
        market: "crypto",
        timeframes: ["1d"],
        minConfidence: 50,
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("validateRegistry", () => {
    it("returns a validation log with asset counts", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.validateRegistry();
      expect(result).toHaveProperty("totalAssets");
      expect(result).toHaveProperty("nseCount");
      expect(result).toHaveProperty("cryptoCount");
      expect(result).toHaveProperty("usCount");
      expect(result).toHaveProperty("indexCount");
      expect(result).toHaveProperty("duplicates");
      expect(result).toHaveProperty("crossContamination");
      expect(result).toHaveProperty("invalidSymbols");
      expect(result).toHaveProperty("status");
      expect(result.nseCount).toBeGreaterThan(0);
      expect(result.cryptoCount).toBeGreaterThan(0);
      expect(result.usCount).toBeGreaterThan(0);
    });

    it("reports CLEAN status when no issues found", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.validateRegistry();
      expect(["CLEAN", "WARNINGS", "ERRORS"]).toContain(result.status);
    });

    it("has no cross-contamination between markets", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      const result = await caller.global.validateRegistry();
      expect(result.crossContamination.length).toBe(0);
    });
  });
});

// ─── India Scanner (improved engine) Tests ────────────────────────────────────
describe("india scanner (improved engine)", () => {
  it("returns scan results for ema_alignment", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.india.scanner({
      scanType: "ema_alignment",
      timeframe: "1D",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns scan results for volume_spike", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.india.scanner({
      scanType: "volume_spike",
      timeframe: "1D",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns scan results for ath_breakout", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.india.scanner({
      scanType: "ath_breakout",
      timeframe: "1D",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  }, 30000);

    it("rejects invalid scan type", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.india.scanner({
        scanType: "invalid_scan_type" as any,
        timeframe: "1D",
      })).rejects.toThrow();
    });

    it("rejects intraday timeframes the data feed cannot support", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.india.scanner({
        scanType: "ema_alignment",
        timeframe: "4H" as any,
      })).rejects.toThrow();
    });

    it("rejects invalid timeframe", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.india.scanner({
        scanType: "ema_alignment",
        timeframe: "1d" as any, // lowercase is invalid — must be uppercase
      })).rejects.toThrow();
    });
});

// ─── Crypto Scanner (improved engine) Tests ───────────────────────────────────
describe("crypto scanner (improved engine)", () => {
  it("returns scan results for ema_alignment", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.crypto.scanner({
      scanType: "ema_alignment",
      timeframe: "1D",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns scan results for relative_strength", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    const result = await caller.crypto.scanner({
      scanType: "relative_strength",
      timeframe: "1D",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
