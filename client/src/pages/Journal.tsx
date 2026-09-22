import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, Trash2, RefreshCw, History, MessageSquareX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StrategyReliabilityPanel } from "@/components/shared/StrategyReliability";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function fmt(n: number | undefined | null, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Journal() {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [marketFilter, setMarketFilter] = useState<"all" | "india" | "crypto" | "us" | "commodities">("all");
  const utils = trpc.useUtils();

  const { data: allTrades, isLoading } = trpc.journal.all.useQuery(undefined, { refetchInterval: 60000 });
  const { data: stats } = trpc.journal.stats.useQuery();
  const checkMutation = trpc.journal.checkPrices.useMutation({
    onSuccess: (result) => {
      utils.journal.all.invalidate();
      utils.journal.stats.invalidate();
      if (result.updated > 0) {
        toast.success(`${result.updated} trade(s) auto-closed`, {
          description: result.results.map(r => `${r.symbol}: ${r.status === "target_hit" ? "🎯 Target" : "🛑 SL"}`).join(", "),
        });
      } else {
        toast.info("All trades within range — no changes");
      }
    },
  });
  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => { utils.journal.all.invalidate(); utils.journal.stats.invalidate(); utils.journal.reliability.invalidate(); toast.success("Trade deleted"); },
  });
  const clearHistoryMutation = trpc.journal.clearHistory.useMutation({
    onSuccess: (r) => {
      utils.journal.all.invalidate(); utils.journal.stats.invalidate(); utils.journal.reliability.invalidate();
      toast.success(r.removed > 0 ? `Cleared ${r.removed} closed trade(s)` : "No closed trades to clear");
    },
  });
  const clearFeedbackMutation = trpc.journal.clearFeedback.useMutation({
    onSuccess: (r) => {
      utils.journal.all.invalidate(); utils.journal.reliability.invalidate();
      toast.success(r.cleared > 0 ? `Reset feedback on ${r.cleared} trade(s)` : "No feedback to reset");
    },
  });

  const filteredTrades = allTrades?.filter(t => marketFilter === "all" || t.market === marketFilter) ?? [];
  const openTrades = filteredTrades.filter(t => t.status === "open");
  const closedTrades = filteredTrades.filter(t => t.status !== "open");

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Trade Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track scanner suggestions & P&L performance</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Reset feedback */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <MessageSquareX className="w-3.5 h-3.5" /> Reset Feedback
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all feedback?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears the feedback (good/bad signal, early exit, late entry) from every trade.
                  Trades themselves are kept. Strategy reliability will recompute from outcomes only.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearFeedbackMutation.mutate()}>Reset Feedback</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset history */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <History className="w-3.5 h-3.5" /> Reset History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset trade history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all <span className="font-semibold">closed</span> trades
                  (target hit, SL hit, manually closed). Your <span className="font-semibold">open</span> positions
                  are kept. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearHistoryMutation.mutate()}>Reset History</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending}>
            <RefreshCw className={cn("w-3.5 h-3.5", checkMutation.isPending && "animate-spin")} />
            Check Prices
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Trades", value: stats.totalTrades, color: "text-foreground" },
            { label: "Open", value: stats.openTrades, color: "text-blue-400" },
            { label: "Win Rate", value: `${stats.winRate}%`, color: stats.winRate >= 50 ? "text-bull" : "text-bear" },
            { label: "Total P&L", value: `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)}`, color: stats.totalPnl >= 0 ? "text-bull" : "text-bear" },
            { label: "Avg Win", value: `+${fmt(stats.avgWin)}%`, color: "text-bull" },
            { label: "Avg Loss", value: `${fmt(stats.avgLoss)}%`, color: "text-bear" },
          ].map(s => (
            <div key={s.label} className="pf-card p-3 text-center">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className={cn("text-lg font-bold tabular-nums mt-0.5", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy reliability — feedback + outcomes make the system improve */}
      <StrategyReliabilityPanel />

      {/* Market filter + Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
          {[
            { id: "all" as const, label: "All" },
            { id: "india" as const, label: "🇮🇳 India" },
            { id: "crypto" as const, label: "₿ Crypto" },
            { id: "us" as const, label: "🇺🇸 US" },
            { id: "commodities" as const, label: "🏆 Commodities" },
          ].map(m => (
            <button key={m.id} onClick={() => setMarketFilter(m.id)}
              aria-pressed={marketFilter === m.id}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-ring",
                marketFilter === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{m.label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
          {[
            { id: "open" as const, label: `Open (${openTrades.length})` },
            { id: "closed" as const, label: `Closed (${closedTrades.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn("px-4 py-1.5 rounded-md text-xs font-medium transition-all focus-ring",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Trade List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {(tab === "open" ? openTrades : closedTrades).length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {tab === "open" ? "No open trades. Save a trade from the scanner to track it here." : "No closed trades yet."}
              </p>
            </div>
          ) : (
            (tab === "open" ? openTrades : closedTrades).map((trade: any) => (
              <div key={trade.id} className="pf-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-2xs font-bold text-primary">{trade.symbol.slice(0, 3)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{trade.symbol}</div>
                      <div className="text-2xs text-muted-foreground">{trade.name} · {trade.scanType.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.status === "open" ? (
                      <div className={cn("text-sm font-bold tabular-nums", (trade.unrealizedPnl ?? 0) >= 0 ? "text-bull" : "text-bear")}>
                        {(trade.unrealizedPnl ?? 0) >= 0 ? "+" : ""}{fmt(trade.unrealizedPnl)} ({fmt(trade.unrealizedPnlPercent)}%)
                      </div>
                    ) : (
                      <div className={cn("text-sm font-bold tabular-nums", (trade.pnl ?? 0) >= 0 ? "text-bull" : "text-bear")}>
                        {(trade.pnl ?? 0) >= 0 ? "+" : ""}{fmt(trade.pnl)} ({fmt(trade.pnlPercent)}%)
                      </div>
                    )}
                    <Badge variant="outline" className={cn("text-3xs mt-0.5",
                      trade.status === "target_hit" ? "border-bull/40 text-bull" :
                      trade.status === "sl_hit" ? "border-bear/40 text-bear" :
                      trade.status === "open" ? "border-blue-400/40 text-blue-400" : "border-muted-foreground/40"
                    )}>
                      {trade.status === "target_hit" ? "🎯 Target Hit" :
                       trade.status === "sl_hit" ? "🛑 SL Hit" :
                       trade.status === "open" ? "● Open" : "Closed"}
                    </Badge>
                  </div>
                </div>

                {/* Trade details grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-3xs">
                  <div>
                    <div className="text-muted-foreground">Entry</div>
                    <div className="font-bold tabular-nums text-foreground">{fmt(trade.entryPrice)}</div>
                  </div>
                  {trade.status === "open" && trade.currentPrice && (
                    <div>
                      <div className="text-muted-foreground">Current</div>
                      <div className="font-bold tabular-nums text-foreground">{fmt(trade.currentPrice)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Stop Loss</div>
                    <div className="font-bold tabular-nums text-bear">{fmt(trade.stopLoss)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-bold tabular-nums text-bull">{fmt(trade.target)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">R:R</div>
                    <div className="font-bold tabular-nums">{trade.riskReward}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Quality</div>
                    <div className="font-bold tabular-nums">{trade.qualityScore}/100</div>
                  </div>
                </div>

                {/* Close trade button (for open trades only) */}
                {trade.status === "open" && (
                  <CloseTradeButton trade={trade} />
                )}

                {/* Date + actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="text-3xs text-muted-foreground">
                    Saved: {new Date(trade.entryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {trade.exitDate && ` · Closed: ${new Date(trade.exitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </div>
                  <button onClick={() => deleteMutation.mutate({ id: trade.id })}
                    aria-label={`Delete ${trade.symbol} trade`}
                    className="text-muted-foreground hover:text-bear transition-colors p-2 -m-1 rounded focus-ring">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Feedback section */}
                <FeedbackSection trade={trade} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CloseTradeButton({ trade }: { trade: any }) {
  const [showInput, setShowInput] = useState(false);
  const [exitPrice, setExitPrice] = useState(String(trade.currentPrice ?? trade.entryPrice));
  const utils = trpc.useUtils();
  const closeMutation = trpc.journal.close.useMutation({
    onSuccess: () => {
      utils.journal.all.invalidate();
      utils.journal.stats.invalidate();
      toast.success(`${trade.symbol} closed`);
      setShowInput(false);
    },
  });

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="text-3xs px-2.5 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium transition-colors"
      >
        ✋ Close Trade
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border/50">
      <span className="text-3xs text-muted-foreground">Exit Price:</span>
      <input
        type="number"
        step="0.01"
        value={exitPrice}
        onChange={e => setExitPrice(e.target.value)}
        className="w-24 px-2 py-1 rounded bg-background border border-border text-xs tabular-nums text-foreground"
      />
      <button
        onClick={() => closeMutation.mutate({ id: trade.id, exitPrice: parseFloat(exitPrice) })}
        disabled={closeMutation.isPending || !exitPrice}
        className="text-3xs px-2 py-1 rounded bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {closeMutation.isPending ? "..." : "Confirm"}
      </button>
      <button onClick={() => setShowInput(false)} aria-label="Cancel" className="text-3xs text-muted-foreground hover:text-foreground p-2 -m-1 rounded focus-ring">✕</button>
    </div>
  );
}

function FeedbackSection({ trade }: { trade: any }) {
  const utils = trpc.useUtils();
  const feedbackMutation = trpc.journal.addFeedback.useMutation({
    onSuccess: () => { utils.journal.all.invalidate(); toast.success("Feedback saved"); },
  });

  const feedbackOptions = [
    { value: "good_signal", label: "✅ Good Signal", desc: "Scanner was right" },
    { value: "bad_signal", label: "❌ Bad Signal", desc: "Should not have triggered" },
    { value: "early_exit", label: "⏰ Early Exit", desc: "Hit SL but stock recovered" },
    { value: "late_entry", label: "🐌 Late Entry", desc: "Signal came too late" },
  ];

  if (trade.feedback) {
    const fb = feedbackOptions.find(f => f.value === trade.feedback);
    return (
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-3xs text-muted-foreground">Feedback:</span>
        <span className="text-3xs font-medium text-foreground">{fb?.label ?? trade.feedback}</span>
        {trade.feedbackNote && <span className="text-3xs text-muted-foreground italic">"{trade.feedbackNote}"</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
      <span className="text-3xs text-muted-foreground">Feedback:</span>
      {feedbackOptions.map(opt => (
        <button
          key={opt.value}
          onClick={() => feedbackMutation.mutate({ id: trade.id, feedback: opt.value as any })}
          disabled={feedbackMutation.isPending}
          className="text-3xs px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
