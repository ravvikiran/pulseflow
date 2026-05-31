import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNotificationsForUser(userId: number, limit = 50, unreadOnly = false) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.isRead, false));

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .limit(100);
  return rows.length;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const notificationsRouter = router({
  /** Get paginated notifications for the current user */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      unreadOnly: z.boolean().default(false),
      category: z.enum([
        "breakout", "volume_spike", "ema_crossover", "sector_momentum",
        "pattern_detected", "system", "alert_triggered"
      ]).optional(),
      marketDomain: z.enum(["india", "crypto", "us", "global"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { notifications: [], total: 0 };

      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input.unreadOnly) conditions.push(eq(notifications.isRead, false));
      if (input.category) conditions.push(eq(notifications.category, input.category));
      if (input.marketDomain) conditions.push(eq(notifications.marketDomain, input.marketDomain));

      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);

      return {
        notifications: rows,
        total: rows.length,
      };
    }),

  /** Get unread count for the bell badge */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return { count: await getUnreadCount(ctx.user.id) };
  }),

  /** Get the 5 most recent unread notifications for the dropdown panel */
  recent: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(5);
  }),

  /** Mark a single notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),

  /** Delete a single notification */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .delete(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Clear all read notifications */
  clearRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, true)));
    return { success: true };
  }),

  /**
   * Seed demo notifications for the current user (called once on first login or
   * triggered by the background job engine).
   */
  seedDemo: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };

    const demoNotifications = [
      {
        userId: ctx.user.id,
        category: "breakout" as const,
        severity: "critical" as const,
        title: "RELIANCE — 52-Week High Breakout",
        message: "RELIANCE has broken above its 52-week high of ₹2,847. Volume is 2.3× average. Strong institutional buying detected.",
        symbol: "RELIANCE",
        sector: "Energy",
        marketDomain: "india" as const,
        metadata: { breakoutLevel: 2847, volumeRatio: 2.3, timeframe: "1d" },
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "volume_spike" as const,
        severity: "warning" as const,
        title: "BTC/USDT — Unusual Volume Spike",
        message: "Bitcoin volume is 3.1× the 20-day average. Price is approaching key resistance at $68,500. Watch for breakout or rejection.",
        symbol: "BTC/USDT",
        sector: "Layer 1",
        marketDomain: "crypto" as const,
        metadata: { volumeRatio: 3.1, resistanceLevel: 68500, timeframe: "4h" },
        isRead: false,
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "ema_crossover" as const,
        severity: "info" as const,
        title: "INFY — EMA 20/50 Golden Cross",
        message: "INFY EMA 20 has crossed above EMA 50 on the daily chart. Momentum is turning bullish. RSI at 58.",
        symbol: "INFY",
        sector: "Information Technology",
        marketDomain: "india" as const,
        metadata: { ema20: 1842, ema50: 1835, rsi: 58, timeframe: "1d" },
        isRead: false,
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "sector_momentum" as const,
        severity: "info" as const,
        title: "IT Sector — Momentum Shift Detected",
        message: "NSE IT sector has moved from Neutral to Bullish. Sector strength score increased by 18 points. FII inflows accelerating.",
        symbol: null,
        sector: "Information Technology",
        marketDomain: "india" as const,
        metadata: { previousState: "neutral", newState: "bullish", strengthDelta: 18 },
        isRead: false,
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "pattern_detected" as const,
        severity: "info" as const,
        title: "ETH/USDT — Bull Flag Pattern",
        message: "ETH/USDT has formed a Bull Flag on the 4H chart. Pole gain: 12.4%. Handle depth: 3.1%. Confidence: 78%. Target: $3,850.",
        symbol: "ETH/USDT",
        sector: "Smart Contract Platform",
        marketDomain: "crypto" as const,
        metadata: { pattern: "bull_flag", confidence: 78, targetLevel: 3850, timeframe: "4h" },
        isRead: true,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "alert_triggered" as const,
        severity: "critical" as const,
        title: "Alert: HDFC Bank — Price Target Hit",
        message: "Your price alert for HDFC Bank at ₹1,650 has been triggered. Current price: ₹1,652. Consider reviewing your position.",
        symbol: "HDFCBANK",
        sector: "Banking",
        marketDomain: "india" as const,
        metadata: { targetPrice: 1650, currentPrice: 1652, alertType: "price_target" },
        isRead: true,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        userId: ctx.user.id,
        category: "system" as const,
        severity: "info" as const,
        title: "Market Data Refresh Complete",
        message: "All market data has been refreshed. 105 assets updated. Sector scores recalculated. Scanner results ready.",
        symbol: null,
        sector: null,
        marketDomain: "global" as const,
        metadata: { assetsUpdated: 105, sectorsRecalculated: 22, scannerResultsCount: 47 },
        isRead: true,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
    ];

    // Only seed if user has no notifications yet
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .limit(1);

    if (existing.length > 0) return { success: true, seeded: 0 };

    await db.insert(notifications).values(demoNotifications as any);
    return { success: true, seeded: demoNotifications.length };
  }),
});
