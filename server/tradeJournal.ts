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

export function saveTrade(trade: Omit<SavedTrade, "id" | "status">): SavedTrade {
  const journal = readJournal();
  const newTrade: SavedTrade = {
    ...trade,
    id: `${trade.symbol}-${Date.now()}`,
    status: "open",
  };
  journal.trades.unshift(newTrade); // newest first
  writeJournal(journal);
  return newTrade;
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
