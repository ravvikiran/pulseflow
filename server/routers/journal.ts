import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getAllTrades, getOpenTrades, getClosedTrades, saveTrade, updateTrade, deleteTrade, checkTradesAgainstPrices, findOpenTrade, clearClosedTrades, clearAllFeedback, getStrategyReliability } from "../tradeJournal";
import { getCurrentPrices } from "../dataProvider";

export const journalRouter = router({
  /** Get all trades */
  all: publicProcedure.query(async () => {
    const trades = getAllTrades();
    // Enrich open trades with current P&L
    const openSymbols = trades.filter(t => t.status === "open").map(t => t.symbol);
    if (openSymbols.length > 0) {
      const prices = await getCurrentPrices(openSymbols);
      for (const trade of trades) {
        if (trade.status === "open") {
          const cp = prices.get(trade.symbol);
          if (cp) {
            (trade as any).currentPrice = cp.price;
            (trade as any).unrealizedPnl = Math.round((cp.price - trade.entryPrice) * 100) / 100;
            (trade as any).unrealizedPnlPercent = Math.round(((cp.price - trade.entryPrice) / trade.entryPrice) * 10000) / 100;
          }
        }
      }
    }
    return trades;
  }),

  /** Get open trades only */
  open: publicProcedure.query(async () => {
    const trades = getOpenTrades();
    const symbols = trades.map(t => t.symbol);
    if (symbols.length > 0) {
      const prices = await getCurrentPrices(symbols);
      for (const trade of trades) {
        const cp = prices.get(trade.symbol);
        if (cp) {
          (trade as any).currentPrice = cp.price;
          (trade as any).unrealizedPnl = Math.round((cp.price - trade.entryPrice) * 100) / 100;
          (trade as any).unrealizedPnlPercent = Math.round(((cp.price - trade.entryPrice) / trade.entryPrice) * 10000) / 100;
        }
      }
    }
    return trades;
  }),

  /** Get closed trades (target hit, SL hit, or manual close) */
  closed: publicProcedure.query(async () => getClosedTrades()),

  /** Save a new trade from scanner result */
  save: publicProcedure
    .input(z.object({
      symbol: z.string().trim().min(1).max(32),
      name: z.string().max(200),
      sector: z.string().max(100),
      exchange: z.string().max(50),
      market: z.enum(["india", "crypto", "us", "commodities"]),
      scanType: z.string().max(64),
      // entryPrice is the P&L denominator, so it must be > 0
      entryPrice: z.number().positive().finite(),
      entryDate: z.string().max(64),
      stopLoss: z.number().nonnegative().finite(),
      target: z.number().nonnegative().finite(),
      riskReward: z.string().max(32),
      qualityScore: z.number().finite(),
      confidence: z.string().max(32),
      signals: z.array(z.string().max(200)).max(50),
      notes: z.string().max(5000).optional(),
    }))
    .mutation(async ({ input }) => {
      // Returns { success:false, duplicate:true, existingId, existingTrade }
      // when an OPEN trade for the same symbol+market already exists.
      return saveTrade(input);
    }),

  /** Check whether an open trade already exists for a symbol+market (pre-save UX) */
  checkDuplicate: publicProcedure
    .input(z.object({ symbol: z.string().trim().min(1).max(32), market: z.enum(["india", "crypto", "us", "commodities"]) }))
    .query(async ({ input }) => {
      const existing = findOpenTrade(input.symbol, input.market);
      return { duplicate: !!existing, existingId: existing?.id ?? null };
    }),

  /** Close a trade manually */
  close: publicProcedure
    .input(z.object({
      id: z.string().max(128),
      exitPrice: z.number().positive().finite(),
      notes: z.string().max(5000).optional(),
    }))
    .mutation(async ({ input }) => {
      const trade = getAllTrades().find(t => t.id === input.id);
      // Only open trades can be closed; re-closing would overwrite exit data.
      if (!trade || trade.status !== "open") return { success: false };

      const pnl = input.exitPrice - trade.entryPrice;
      const pnlPercent = (pnl / trade.entryPrice) * 100;

      updateTrade(input.id, {
        status: "closed_manual",
        exitPrice: input.exitPrice,
        exitDate: new Date().toISOString(),
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        notes: input.notes,
      });
      return { success: true };
    }),

  /** Delete a trade */
  delete: publicProcedure
    .input(z.object({ id: z.string().max(128) }))
    .mutation(async ({ input }) => {
      return { success: deleteTrade(input.id) };
    }),

  /** Add notes to a trade */
  addNote: publicProcedure
    .input(z.object({ id: z.string().max(128), notes: z.string().max(5000) }))
    .mutation(async ({ input }) => {
      const result = updateTrade(input.id, { notes: input.notes });
      return { success: !!result };
    }),

  /** Add feedback to a trade (for improving scanner logic) */
  addFeedback: publicProcedure
    .input(z.object({
      id: z.string().max(128),
      feedback: z.enum(["good_signal", "bad_signal", "early_exit", "late_entry"]),
      feedbackNote: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = updateTrade(input.id, { feedback: input.feedback, feedbackNote: input.feedbackNote });
      return { success: !!result };
    }),

  /** Check open trades against current prices (auto-close if SL/target hit) */
  checkPrices: publicProcedure.mutation(async () => {
    const openTrades = getOpenTrades();
    if (openTrades.length === 0) return { updated: 0, results: [] };

    const symbols = openTrades.map(t => t.symbol);
    const prices = await getCurrentPrices(symbols);
    return checkTradesAgainstPrices(prices);
  }),

  /** Get journal stats */
  stats: publicProcedure.query(async () => {
    const all = getAllTrades();
    const open = all.filter(t => t.status === "open");
    const closed = all.filter(t => t.status !== "open");
    const winners = closed.filter(t => (t.pnl ?? 0) > 0);
    const losers = closed.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

    return {
      totalTrades: all.length,
      openTrades: open.length,
      closedTrades: closed.length,
      winners: winners.length,
      losers: losers.length,
      winRate: Math.round(winRate),
      totalPnl: Math.round(totalPnl * 100) / 100,
      avgWin: winners.length > 0 ? Math.round(winners.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / winners.length * 100) / 100 : 0,
      avgLoss: losers.length > 0 ? Math.round(losers.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / losers.length * 100) / 100 : 0,
    };
  }),

  /** Per-strategy reliability scorecard (feedback + outcomes) */
  reliability: publicProcedure.query(async () => getStrategyReliability()),

  /** Reset closed-trade history (open positions are preserved) */
  clearHistory: publicProcedure.mutation(async () => {
    const removed = clearClosedTrades();
    return { success: true, removed };
  }),

  /** Reset all feedback across trades */
  clearFeedback: publicProcedure.mutation(async () => {
    const cleared = clearAllFeedback();
    return { success: true, cleared };
  }),
});
