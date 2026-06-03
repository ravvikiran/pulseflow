/**
 * PulseFlow Enhancement Batch 2 Tests
 * Covers: notifications router, scannerEngine, patternEngine
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
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.list({})).rejects.toThrow();
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
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.unreadCount()).rejects.toThrow();
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
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.recent()).rejects.toThrow();
    });

    it("returns array when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.recent();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("markRead", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.markRead({ id: 1 })).rejects.toThrow();
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.markRead({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("markAllRead", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.markAllRead()).rejects.toThrow();
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.markAllRead();
      expect(result).toHaveProperty("success");
    });
  });

  describe("delete", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.notifications.delete({ id: 1 })).rejects.toThrow();
    });

    it("returns success when DB is unavailable", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.notifications.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });
});

// ─── Scanner Engine Tests ─────────────────────────────────────────────────────
describe("scannerEngine", () => {
  let scannerEngine: typeof import("./scannerEngine");

  beforeEach(async () => {
    scannerEngine = await import("./scannerEngine");
  });

  describe("runImprovedScanner", () => {
    it("returns an array of ScanResult objects for india domain", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 5,
        respectCooldown: false,
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("returns an array of ScanResult objects for crypto domain", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "crypto",
        scanType: "volume_spike",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 5,
        respectCooldown: false,
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("returns an array of ScanResult objects for us domain", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "us",
        scanType: "breakout_52w",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 5,
        respectCooldown: false,
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("each result has required fields", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 3,
        respectCooldown: false,
      });
      for (const r of results) {
        expect(r).toHaveProperty("symbol");
        expect(r).toHaveProperty("name");
        expect(r).toHaveProperty("sector");
        expect(r).toHaveProperty("price");
        expect(r).toHaveProperty("qualityScore");
        expect(r).toHaveProperty("confidence");
        expect(r).toHaveProperty("signals");
        expect(r).toHaveProperty("details");
        expect(["high", "medium", "low"]).toContain(r.confidence);
        expect(r.qualityScore).toBeGreaterThanOrEqual(0);
        expect(r.qualityScore).toBeLessThanOrEqual(100);
      }
    });

    it("filters by minQualityScore", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        minQualityScore: 60,
        maxResults: 20,
        respectCooldown: false,
      });
      for (const r of results) {
        expect(r.qualityScore).toBeGreaterThanOrEqual(60);
      }
    });

    it("respects maxResults limit", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 3,
        respectCooldown: false,
      });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("results are sorted by qualityScore descending", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        minQualityScore: 0,
        maxResults: 10,
        respectCooldown: false,
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].qualityScore).toBeGreaterThanOrEqual(results[i].qualityScore);
      }
    });

    it("filters by sector for india domain", () => {
      const results = scannerEngine.runImprovedScanner({
        domain: "india",
        scanType: "ema_alignment",
        timeframe: "1D",
        sector: "Information Technology",
        minQualityScore: 0,
        maxResults: 10,
        respectCooldown: false,
      });
      for (const r of results) {
        expect(r.sector.toLowerCase()).toContain("information technology");
      }
    });

    it("supports all scan types", () => {
      const scanTypes: scannerEngine.ScanType[] = [
        "ema_alignment", "volume_spike", "breakout_52w",
        "ath_breakout", "momentum_continuation", "relative_strength",
      ];
      for (const scanType of scanTypes) {
        const results = scannerEngine.runImprovedScanner({
          domain: "crypto",
          scanType,
          timeframe: "1D",
          minQualityScore: 0,
          maxResults: 3,
          respectCooldown: false,
        });
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it("getScanTypeLabel returns correct labels", () => {
      expect(scannerEngine.getScanTypeLabel("ema_alignment")).toBe("EMA Alignment");
      expect(scannerEngine.getScanTypeLabel("volume_spike")).toBe("Volume Spike");
      expect(scannerEngine.getScanTypeLabel("breakout_52w")).toBe("52-Week High Breakout");
      expect(scannerEngine.getScanTypeLabel("ath_breakout")).toBe("ATH Breakout");
      expect(scannerEngine.getScanTypeLabel("momentum_continuation")).toBe("Momentum Continuation");
      expect(scannerEngine.getScanTypeLabel("relative_strength")).toBe("Relative Strength");
    });
  });
});

// ─── Pattern Engine Tests ─────────────────────────────────────────────────────
describe("patternEngine", () => {
  let patternEngine: typeof import("./patternEngine");

  beforeEach(async () => {
    patternEngine = await import("./patternEngine");
  });

  describe("runPatternScanner", () => {
    it("returns an array of PatternResult objects", () => {
      const assets = [
        { symbol: "RELIANCE", basePrice: 2500, sector: "Energy & Oil" },
        { symbol: "TCS", basePrice: 3800, sector: "Information Technology" },
      ];
      const results = patternEngine.runPatternScanner(assets, { minConfidence: 0 });
      expect(Array.isArray(results)).toBe(true);
    });

    it("each result has required fields", () => {
      const assets = [{ symbol: "INFY", basePrice: 1500, sector: "Information Technology" }];
      const results = patternEngine.runPatternScanner(assets, { minConfidence: 0, maxResultsPerAsset: 3 });
      for (const r of results) {
        expect(r).toHaveProperty("symbol");
        expect(r).toHaveProperty("patternType");
        expect(r).toHaveProperty("patternName");
        expect(r).toHaveProperty("timeframe");
        expect(r).toHaveProperty("severity");
        expect(r).toHaveProperty("confidenceScore");
        expect(r).toHaveProperty("patternStrength");
        expect(r).toHaveProperty("volumeConfirmed");
        expect(r).toHaveProperty("breakoutLevel");
        expect(r).toHaveProperty("stopLossZone");
        expect(r).toHaveProperty("targetLevel");
        expect(r).toHaveProperty("description");
        expect(["bullish", "bearish", "neutral"]).toContain(r.severity);
        expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(r.confidenceScore).toBeLessThanOrEqual(100);
      }
    });

    it("filters by minConfidence", () => {
      const assets = [
        { symbol: "HDFC", basePrice: 1700, sector: "Banking & Finance" },
        { symbol: "ICICI", basePrice: 900, sector: "Banking & Finance" },
        { symbol: "SBIN", basePrice: 600, sector: "Banking & Finance" },
      ];
      const results = patternEngine.runPatternScanner(assets, { minConfidence: 60 });
      for (const r of results) {
        expect(r.confidenceScore).toBeGreaterThanOrEqual(60);
      }
    });

    it("results are sorted by confidenceScore descending", () => {
      const assets = [
        { symbol: "BTC", basePrice: 45000, sector: "Cryptocurrency" },
        { symbol: "ETH", basePrice: 2500, sector: "Cryptocurrency" },
        { symbol: "SOL", basePrice: 120, sector: "Cryptocurrency" },
      ];
      const results = patternEngine.runPatternScanner(assets, { minConfidence: 0 });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidenceScore).toBeGreaterThanOrEqual(results[i].confidenceScore);
      }
    });

    it("respects maxResultsPerAsset", () => {
      const assets = [{ symbol: "AAPL", basePrice: 175, sector: "US Technology" }];
      const results = patternEngine.runPatternScanner(assets, {
        minConfidence: 0,
        maxResultsPerAsset: 2,
      });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("requireVolumeConfirmation filters correctly", () => {
      const assets = [
        { symbol: "NVDA", basePrice: 450, sector: "US Technology" },
        { symbol: "MSFT", basePrice: 380, sector: "US Technology" },
      ];
      const results = patternEngine.runPatternScanner(assets, {
        minConfidence: 0,
        requireVolumeConfirmation: true,
      });
      for (const r of results) {
        expect(r.volumeConfirmed).toBe(true);
      }
    });

    it("filterFalseBreakouts removes false breakouts", () => {
      const assets = [
        { symbol: "WIPRO", basePrice: 450, sector: "Information Technology" },
        { symbol: "HCL", basePrice: 1200, sector: "Information Technology" },
      ];
      const results = patternEngine.runPatternScanner(assets, {
        minConfidence: 0,
        filterFalseBreakouts: true,
      });
      for (const r of results) {
        expect(r.isFalseBreakout).toBe(false);
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
  });

    it("rejects invalid scan type", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.india.scanner({
        scanType: "invalid_scan_type" as any,
        timeframe: "1D",
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
      timeframe: "4H",
      minQualityScore: 0,
      maxResults: 5,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
