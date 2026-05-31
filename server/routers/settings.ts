import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences, scannerPresets } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Settings Router ──────────────────────────────────────────────────────────

export const settingsRouter = router({
  /** Get user preferences (creates defaults if none exist) */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return getDefaultPreferences();
    }

    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    if (rows.length === 0) {
      // Create default preferences for this user
      await db.insert(userPreferences).values({
        userId: ctx.user.id,
      });
      return getDefaultPreferences();
    }

    const prefs = rows[0];
    return {
      theme: prefs.theme,
      defaultLandingPage: prefs.defaultLandingPage,
      timezone: prefs.timezone,
      currency: prefs.currency,
      language: prefs.language,
      preferredModules: prefs.preferredModules ?? ["india", "crypto"],
      preferredTimeframe: prefs.preferredTimeframe,
      scannerRefreshInterval: prefs.scannerRefreshInterval,
      heatmapRefreshInterval: prefs.heatmapRefreshInterval,
      defaultChartInterval: prefs.defaultChartInterval,
      alertEmail: prefs.alertEmail,
      alertEmailAddress: prefs.alertEmailAddress,
      alertTelegram: prefs.alertTelegram,
      alertTelegramHandle: prefs.alertTelegramHandle,
      alertInApp: prefs.alertInApp,
      alertVolumeSpike: prefs.alertVolumeSpike,
      alertEmaCrossover: prefs.alertEmaCrossover,
      alertBreakout: prefs.alertBreakout,
      alertSectorMomentum: prefs.alertSectorMomentum,
      alertSensitivity: prefs.alertSensitivity,
      autoRefresh: prefs.autoRefresh,
      realTimeUpdates: prefs.realTimeUpdates,
      performanceMode: prefs.performanceMode,
      dataRetentionDays: prefs.dataRetentionDays,
    };
  }),

  /** Update user preferences (partial update) */
  updatePreferences: protectedProcedure
    .input(z.object({
      theme: z.enum(["dark", "light", "system"]).optional(),
      defaultLandingPage: z.enum(["home", "india", "crypto", "us"]).optional(),
      timezone: z.string().optional(),
      currency: z.string().optional(),
      language: z.string().optional(),
      preferredModules: z.array(z.string()).optional(),
      preferredTimeframe: z.string().optional(),
      scannerRefreshInterval: z.number().min(10).max(600).optional(),
      heatmapRefreshInterval: z.number().min(10).max(300).optional(),
      defaultChartInterval: z.string().optional(),
      alertEmail: z.boolean().optional(),
      alertEmailAddress: z.string().nullable().optional(),
      alertTelegram: z.boolean().optional(),
      alertTelegramHandle: z.string().nullable().optional(),
      alertInApp: z.boolean().optional(),
      alertVolumeSpike: z.boolean().optional(),
      alertEmaCrossover: z.boolean().optional(),
      alertBreakout: z.boolean().optional(),
      alertSectorMomentum: z.boolean().optional(),
      alertSensitivity: z.enum(["low", "medium", "high"]).optional(),
      autoRefresh: z.boolean().optional(),
      realTimeUpdates: z.boolean().optional(),
      performanceMode: z.boolean().optional(),
      dataRetentionDays: z.number().min(7).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Ensure preferences row exists
      const existing = await db
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userPreferences).values({
          userId: ctx.user.id,
          ...input,
        } as any);
      } else {
        await db
          .update(userPreferences)
          .set(input as any)
          .where(eq(userPreferences.userId, ctx.user.id));
      }

      return { success: true };
    }),

  /** Get scanner presets for the current user */
  getScannerPresets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(scannerPresets)
      .where(eq(scannerPresets.userId, ctx.user.id));
  }),

  /** Create a new scanner preset */
  createScannerPreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      config: z.object({
        ema1: z.number(),
        ema2: z.number(),
        ema3: z.number(),
        volumeMultiplier: z.number(),
        breakoutThreshold: z.number(),
        rsMin: z.number(),
        rsMax: z.number(),
        trendStrengthMin: z.number(),
        scanType: z.string(),
        timeframe: z.string(),
        sector: z.string().optional(),
        assetType: z.string().optional(),
      }),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.insert(scannerPresets).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        config: input.config,
        isDefault: input.isDefault,
      });

      return { success: true };
    }),

  /** Update an existing scanner preset */
  updateScannerPreset: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      config: z.object({
        ema1: z.number(),
        ema2: z.number(),
        ema3: z.number(),
        volumeMultiplier: z.number(),
        breakoutThreshold: z.number(),
        rsMin: z.number(),
        rsMax: z.number(),
        trendStrengthMin: z.number(),
        scanType: z.string(),
        timeframe: z.string(),
        sector: z.string().optional(),
        assetType: z.string().optional(),
      }).optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.config !== undefined) updates.config = input.config;
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

      await db
        .update(scannerPresets)
        .set(updates as any)
        .where(and(eq(scannerPresets.id, input.id), eq(scannerPresets.userId, ctx.user.id)));

      return { success: true };
    }),

  /** Duplicate a scanner preset */
  duplicateScannerPreset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const existing = await db
        .select()
        .from(scannerPresets)
        .where(and(eq(scannerPresets.id, input.id), eq(scannerPresets.userId, ctx.user.id)))
        .limit(1);

      if (existing.length === 0) return { success: false };

      const preset = existing[0];
      await db.insert(scannerPresets).values({
        userId: ctx.user.id,
        name: `${preset.name} (Copy)`,
        description: preset.description,
        config: preset.config,
        isDefault: false,
      });

      return { success: true };
    }),

  /** Delete a scanner preset */
  deleteScannerPreset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db
        .delete(scannerPresets)
        .where(and(eq(scannerPresets.id, input.id), eq(scannerPresets.userId, ctx.user.id)));

      return { success: true };
    }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultPreferences() {
  return {
    theme: "dark" as const,
    defaultLandingPage: "home" as const,
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en",
    preferredModules: ["india", "crypto"],
    preferredTimeframe: "1d",
    scannerRefreshInterval: 60,
    heatmapRefreshInterval: 30,
    defaultChartInterval: "1d",
    alertEmail: false,
    alertEmailAddress: null,
    alertTelegram: false,
    alertTelegramHandle: null,
    alertInApp: true,
    alertVolumeSpike: true,
    alertEmaCrossover: true,
    alertBreakout: true,
    alertSectorMomentum: true,
    alertSensitivity: "medium" as const,
    autoRefresh: true,
    realTimeUpdates: true,
    performanceMode: false,
    dataRetentionDays: 90,
  };
}
