/**
 * PulseFlow Trade Journal
 * Stores saved trades in a local JSON file for tracking and review.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL_PATH = path.resolve(__dirname, "../data/trade-journal.json");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedTrade {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  market: "india" | "crypto" | "us" | "commodities";
  scanType: string;
  // Entry details
  entryPrice: number;
  entryDate: string; // ISO timestamp
  stopLoss: number;
  target: number;
  riskReward: string;
  qualityScore: number;
  confidence: string;
  signals: string[];
  // Tracking
  status: "open" | "target_hit" | "sl_hit" | "closed_manual";
  exitPrice?: number;
  exitDate?: string;
  pnl?: number; // in absolute terms
  pnlPercent?: number;
  notes?: string;
  feedback?: "good_signal" | "bad_signal" | "early_exit" | "late_entry" | null;
  feedbackNote?: string;
}

interface JournalData {
  trades: SavedTrade[];
  lastUpdated: string;
}

// ─── File Operations ──────────────────────────────────────────────────────────

function ensureDataDir() {
  const dir = path.dirname(JOURNAL_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJournal(): JournalData {
  try {
    if (fs.existsSync(JOURNAL_PATH)) {
      const raw = fs.readFileSync(JOURNAL_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted file, start fresh
  }
  return { trades: [], lastUpdated: new Date().toISOString() };
}

function writeJournal(data: JournalData) {
  ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllTrades(): SavedTrade[] {
  return readJournal().trades;
}

export function getOpenTrades(): SavedTrade[] {
  return readJournal().trades.filter(t => t.status === "open");
}

export function getClosedTrades(): SavedTrade[] {
  return readJournal().trades.filter(t => t.status !== "open");
}

/**
 * Find an existing OPEN trade for the same symbol in the same market.
 * A symbol may be re-traded once the prior position is closed, so only
 * open trades block a new entry.
 */
export function findOpenTrade(symbol: string, market: SavedTrade["market"]): SavedTrade | null {
  return readJournal().trades.find(
    t => t.status === "open" && t.symbol === symbol && t.market === market
  ) ?? null;
}

export type SaveTradeResult =
  | { success: true; duplicate: false; trade: SavedTrade }
  | { success: false; duplicate: true; existingId: string; existingTrade: SavedTrade };

export function saveTrade(trade: Omit<SavedTrade, "id" | "status">): SaveTradeResult {
  const journal = readJournal();

  // Guard: refuse a second OPEN trade for the same symbol+market.
  const existing = journal.trades.find(
    t => t.status === "open" && t.symbol === trade.symbol && t.market === trade.market
  );
  if (existing) {
    return { success: false, duplicate: true, existingId: existing.id, existingTrade: existing };
  }

  const newTrade: SavedTrade = {
    ...trade,
    id: `${trade.symbol}-${Date.now()}`,
    status: "open",
  };
  journal.trades.unshift(newTrade); // newest first
  writeJournal(journal);
  return { success: true, duplicate: false, trade: newTrade };
}

export function updateTrade(id: string, updates: Partial<Pick<SavedTrade, "status" | "exitPrice" | "exitDate" | "pnl" | "pnlPercent" | "notes" | "feedback" | "feedbackNote">>): SavedTrade | null {
  const journal = readJournal();
  const idx = journal.trades.findIndex(t => t.id === id);
  if (idx === -1) return null;

  journal.trades[idx] = { ...journal.trades[idx], ...updates };
  writeJournal(journal);
  return journal.trades[idx];
}

export function deleteTrade(id: string): boolean {
  const journal = readJournal();
  const before = journal.trades.length;
  journal.trades = journal.trades.filter(t => t.id !== id);
  if (journal.trades.length < before) {
    writeJournal(journal);
    return true;
  }
  return false;
}

/**
 * Check all open trades against current prices and update status
 * if target or stop loss was hit.
 */
export function checkTradesAgainstPrices(prices: Map<string, { price: number }>): { updated: number; results: Array<{ id: string; symbol: string; status: string; pnl: number }> } {
  const journal = readJournal();
  let updated = 0;
  const results: Array<{ id: string; symbol: string; status: string; pnl: number }> = [];

  for (const trade of journal.trades) {
    if (trade.status !== "open") continue;

    const currentPrice = prices.get(trade.symbol)?.price;
    if (!currentPrice) continue;

    const pnl = currentPrice - trade.entryPrice;
    const pnlPercent = (pnl / trade.entryPrice) * 100;

    // Check if target hit
    if (currentPrice >= trade.target) {
      trade.status = "target_hit";
      trade.exitPrice = currentPrice;
      trade.exitDate = new Date().toISOString();
      trade.pnl = Math.round(pnl * 100) / 100;
      trade.pnlPercent = Math.round(pnlPercent * 100) / 100;
      updated++;
      results.push({ id: trade.id, symbol: trade.symbol, status: "target_hit", pnl: trade.pnl });
    }
    // Check if stop loss hit
    else if (currentPrice <= trade.stopLoss) {
      trade.status = "sl_hit";
      trade.exitPrice = currentPrice;
      trade.exitDate = new Date().toISOString();
      trade.pnl = Math.round(pnl * 100) / 100;
      trade.pnlPercent = Math.round(pnlPercent * 100) / 100;
      updated++;
      results.push({ id: trade.id, symbol: trade.symbol, status: "sl_hit", pnl: trade.pnl });
    }
  }

  if (updated > 0) writeJournal(journal);
  return { updated, results };
}

// ─── Reset / Maintenance ──────────────────────────────────────────────────────

/**
 * Clear CLOSED trades only (target_hit / sl_hit / closed_manual).
 * Open positions are preserved so an in-flight trade is never lost.
 * Returns the number of trades removed.
 */
export function clearClosedTrades(): number {
  const journal = readJournal();
  const before = journal.trades.length;
  journal.trades = journal.trades.filter(t => t.status === "open");
  const removed = before - journal.trades.length;
  if (removed > 0) writeJournal(journal);
  return removed;
}

/**
 * Clear feedback (and feedback notes) from every trade. Does not delete trades.
 * Returns the number of trades whose feedback was cleared.
 */
export function clearAllFeedback(): number {
  const journal = readJournal();
  let cleared = 0;
  for (const t of journal.trades) {
    if (t.feedback != null || t.feedbackNote != null) {
      t.feedback = null;
      t.feedbackNote = undefined;
      cleared++;
    }
  }
  if (cleared > 0) writeJournal(journal);
  return cleared;
}

// ─── Strategy Reliability (feedback + outcome read path) ────────────────────────

export interface StrategyReliability {
  scanType: string;
  totalTrades: number;      // closed trades for this strategy
  openTrades: number;
  winners: number;
  losers: number;
  winRate: number;          // % of closed trades that were profitable
  avgWinPct: number;        // mean pnlPercent of winners
  avgLossPct: number;       // mean pnlPercent of losers (negative)
  expectancy: number;       // (winRate*avgWin) + (lossRate*avgLoss), in % per trade
  goodSignals: number;      // feedback == good_signal
  badSignals: number;       // feedback == bad_signal
  earlyExits: number;       // feedback == early_exit
  lateEntries: number;      // feedback == late_entry
  feedbackCount: number;
  reliabilityScore: number; // 0-100 blended trust score
  sampleSize: "none" | "low" | "medium" | "high";
  verdict: "trusted" | "promising" | "watch" | "caution" | "insufficient";
}

/**
 * Aggregate closed-trade outcomes AND user feedback per scanType into a
 * per-strategy reliability scorecard. This is the read path that makes
 * feedback actually influence decisions: the user can see which strategies
 * have been reliable (win rate, expectancy, good/bad-signal ratio) before
 * acting on a fresh signal — the market-standard "journal improves the system"
 * loop, kept transparent rather than silently re-weighting the scanner.
 */
export function getStrategyReliability(): StrategyReliability[] {
  const all = getAllTrades();
  const byType = new Map<string, SavedTrade[]>();
  for (const t of all) {
    const key = t.scanType || "unknown";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(t);
  }

  const out: StrategyReliability[] = [];
  for (const [scanType, trades] of byType) {
    const closed = trades.filter(t => t.status !== "open");
    const open = trades.filter(t => t.status === "open");
    const winners = closed.filter(t => (t.pnl ?? 0) > 0);
    const losers = closed.filter(t => (t.pnl ?? 0) < 0);

    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
    const lossRate = 100 - winRate;
    const avgWinPct = winners.length > 0
      ? winners.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / winners.length : 0;
    const avgLossPct = losers.length > 0
      ? losers.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / losers.length : 0;
    // Expectancy per trade (%): probability-weighted average outcome.
    const expectancy = (winRate / 100) * avgWinPct + (lossRate / 100) * avgLossPct;

    const goodSignals = trades.filter(t => t.feedback === "good_signal").length;
    const badSignals = trades.filter(t => t.feedback === "bad_signal").length;
    const earlyExits = trades.filter(t => t.feedback === "early_exit").length;
    const lateEntries = trades.filter(t => t.feedback === "late_entry").length;
    const feedbackCount = goodSignals + badSignals + earlyExits + lateEntries;

    // Sample-size tiers (statistical confidence proxy).
    const n = closed.length;
    const sampleSize: StrategyReliability["sampleSize"] =
      n === 0 ? "none" : n < 5 ? "low" : n < 15 ? "medium" : "high";

    // Reliability score (0-100): blend win rate, expectancy, and the
    // good/bad feedback ratio, then damp by sample size so a 1-trade
    // "100% win" doesn't masquerade as a trusted strategy.
    let raw = 0;
    if (closed.length > 0 || feedbackCount > 0) {
      const winComponent = winRate;                                   // 0-100
      const expComponent = Math.max(-100, Math.min(100, expectancy * 10)) / 2 + 50; // recenter to 0-100
      const fbTotal = goodSignals + badSignals;
      const fbComponent = fbTotal > 0 ? (goodSignals / fbTotal) * 100 : 50; // neutral 50 when no signal feedback
      raw = winComponent * 0.45 + expComponent * 0.35 + fbComponent * 0.20;
    }
    // Confidence damping: pull toward a neutral 50 when the sample is thin.
    const confidence = n === 0 ? 0 : n < 5 ? 0.4 : n < 15 ? 0.7 : 1;
    const reliabilityScore = Math.round(50 + (raw - 50) * confidence);

    const verdict: StrategyReliability["verdict"] =
      (closed.length === 0 && feedbackCount === 0) ? "insufficient"
      : sampleSize === "low" ? "watch"
      : reliabilityScore >= 65 ? "trusted"
      : reliabilityScore >= 55 ? "promising"
      : reliabilityScore >= 45 ? "watch"
      : "caution";

    out.push({
      scanType,
      totalTrades: closed.length,
      openTrades: open.length,
      winners: winners.length,
      losers: losers.length,
      winRate: Math.round(winRate),
      avgWinPct: Math.round(avgWinPct * 100) / 100,
      avgLossPct: Math.round(avgLossPct * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      goodSignals, badSignals, earlyExits, lateEntries, feedbackCount,
      reliabilityScore: Math.max(0, Math.min(100, reliabilityScore)),
      sampleSize,
      verdict,
    });
  }

  // Most-traded first, then by reliability.
  out.sort((a, b) => (b.totalTrades + b.openTrades) - (a.totalTrades + a.openTrades) || b.reliabilityScore - a.reliabilityScore);
  return out;
}
