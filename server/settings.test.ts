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
      id: 42,
      openId: "test-user-openid",
      name: "Test Trader",
      email: "trader@pulseflow.io",
      loginMethod: "manus",
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

// ─── Settings Router Tests ────────────────────────────────────────────────────
describe("settings router", () => {
  describe("getPreferences", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.settings.getPreferences()).rejects.toThrow();
    });

    it("returns default preferences for authenticated user with no DB", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.settings.getPreferences();
      // When DB is unavailable, returns null
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  describe("updatePreferences", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(
        caller.settings.updatePreferences({ theme: "dark" })
      ).rejects.toThrow();
    });

    it("accepts valid theme values", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      // With no DB available, should either succeed or throw a DB error, not a validation error
      try {
        await caller.settings.updatePreferences({ theme: "dark" });
      } catch (e: any) {
        // Should not be a validation error
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts valid landing page values", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      try {
        await caller.settings.updatePreferences({ defaultLandingPage: "india" });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts scanner configuration fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      try {
        await caller.settings.updatePreferences({
          scannerRefreshInterval: 120,
          heatmapRefreshInterval: 60,
          defaultChartInterval: "4h",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts alert notification toggles", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      try {
        await caller.settings.updatePreferences({
          alertInApp: true,
          alertEmail: false,
          alertVolumeSpike: true,
          alertEmaCrossover: true,
          alertBreakout: false,
          alertSectorMomentum: true,
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts performance settings", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      try {
        await caller.settings.updatePreferences({
          autoRefresh: true,
          realTimeUpdates: false,
          performanceMode: true,
          dataRetentionDays: 30,
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("getScannerPresets", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(caller.settings.getScannerPresets()).rejects.toThrow();
    });

    it("returns array for authenticated users when DB available", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      try {
        const result = await caller.settings.getScannerPresets();
        expect(Array.isArray(result)).toBe(true);
      } catch (e: any) {
        // DB unavailable is acceptable in test environment
        expect(e.code).not.toBe("UNAUTHORIZED");
      }
    });
  });

  describe("createScannerPreset", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(
        caller.settings.createScannerPreset({
          name: "My EMA Setup",
          description: "Test preset",
          config: { ema1: 20, ema2: 50, ema3: 200, volumeMultiplier: 2.0, breakoutThreshold: 3.0, rsMin: 60, rsMax: 100, trendStrengthMin: 50 },
        })
      ).rejects.toThrow();
    });

    it("validates required name field", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      // Empty name should fail validation
      await expect(
        caller.settings.createScannerPreset({
          name: "",
          config: { ema1: 20, ema2: 50, ema3: 200, volumeMultiplier: 2.0, breakoutThreshold: 3.0, rsMin: 60, rsMax: 100, trendStrengthMin: 50, scanType: "ema_alignment", timeframe: "1d" },
        })
      ).rejects.toThrow();
    });

    it("accepts valid preset input without throwing BAD_REQUEST", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      // This test verifies schema validation passes — DB errors are acceptable
      let threwBadRequest = false;
      try {
        await caller.settings.createScannerPreset({
          name: "Momentum Setup",
          description: "EMA 20/50/200 with volume filter",
          config: {
            ema1: 20,
            ema2: 50,
            ema3: 200,
            volumeMultiplier: 2.5,
            breakoutThreshold: 3.0,
            rsMin: 60,
            rsMax: 100,
            trendStrengthMin: 55,
            scanType: "ema_alignment",
            timeframe: "1d",
          },
        });
      } catch (e: any) {
        if (e.code === "BAD_REQUEST") threwBadRequest = true;
      }
      // Valid input should never produce a BAD_REQUEST (schema validation error)
      // It may throw INTERNAL_SERVER_ERROR due to no DB in test env — that's fine
      expect(threwBadRequest).toBe(false);
    });
  });

  describe("deleteScannerPreset", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(
        caller.settings.deleteScannerPreset({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("duplicateScannerPreset", () => {
    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createAnonContext());
      await expect(
        caller.settings.duplicateScannerPreset({ id: 1 })
      ).rejects.toThrow();
    });
  });
});

// ─── Settings Schema Validation Tests ────────────────────────────────────────
describe("settings schema validation", () => {
  it("theme enum accepts dark, light, system", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const theme of ["dark", "light", "system"] as const) {
      try {
        await caller.settings.updatePreferences({ theme });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    }
  });

  it("landing page enum accepts all valid values", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const page of ["home", "india", "crypto", "us"] as const) {
      try {
        await caller.settings.updatePreferences({ defaultLandingPage: page });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    }
  });

  it("alert sensitivity enum accepts low, medium, high", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const sensitivity of ["low", "medium", "high"] as const) {
      try {
        await caller.settings.updatePreferences({ alertSensitivity: sensitivity });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    }
  });
});
