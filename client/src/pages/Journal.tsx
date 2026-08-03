import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, TrendingUp, TrendingDown, Target, ShieldAlert, Trash2, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function fmt(n: number | undefined | null, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Journal() {
  const [tab, setTab] = useState<"open" | "closed" | "stats">("open");
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
    onSuccess: () => { utils.journal.all.invalidate(); utils.journal.stats.invalidate(); toast.success("Trade deleted"); },
  });

  const openTrades = allTrades?.filter(t => t.status === "open") ?? [];
  const closedTrades = allTrades?.filter(t => t.status !== "open") ?? [];

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
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending}>
          <RefreshCw className={cn("w-3.5 h-3.5", checkMutation.isPending && "animate-spin")} />
          Check Prices
        </Button>
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
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className={cn("text-lg font-bold tabular-nums mt-0.5", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg w-fit">
        {[
          { id: "open" as const, label: `Open (${openTrades.length})` },
          { id: "closed" as const, label: `Closed (${closedTrades.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>{t.label}</button>
        ))}
      </div>

      {/* Trade List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading journal...</div>
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
                      <span className="text-[10px] font-bold text-primary">{trade.symbol.slice(0, 3)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{trade.symbol}</div>
                      <div className="text-[10px] text-muted-foreground">{trade.name} · {trade.scanType.replace(/_/g, " ")}</div>
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
                    <Badge variant="outline" className={cn("text-[9px] mt-0.5",
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
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-[9px]">
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

                {/* Date + actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="text-[9px] text-muted-foreground">
                    Saved: {new Date(trade.entryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {trade.exitDate && ` · Closed: ${new Date(trade.exitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </div>
                  <button onClick={() => deleteMutation.mutate({ id: trade.id })}
                    className="text-muted-foreground hover:text-bear transition-colors p-1">
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
        <span className="text-[9px] text-muted-foreground">Feedback:</span>
        <span className="text-[9px] font-medium text-foreground">{fb?.label ?? trade.feedback}</span>
        {trade.feedbackNote && <span className="text-[9px] text-muted-foreground italic">"{trade.feedbackNote}"</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
      <span className="text-[9px] text-muted-foreground">Feedback:</span>
      {feedbackOptions.map(opt => (
        <button
          key={opt.value}
          onClick={() => feedbackMutation.mutate({ id: trade.id, feedback: opt.value as any })}
          disabled={feedbackMutation.isPending}
          className="text-[8px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
