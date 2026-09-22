import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ShieldCheck, TrendingUp, AlertTriangle, HelpCircle } from "lucide-react";

const LABELS: Record<string, string> = {
  ema_alignment: "EMA Alignment",
  volume_spike: "Volume Spike",
  breakout_52w: "52W Breakout",
  ath_breakout: "ATH Breakout",
  momentum_continuation: "Momentum",
  relative_strength: "Relative Strength",
};

function labelFor(scanType: string): string {
  // Combination strategies are stored as "a+b"; render each part.
  return scanType.split("+").map(s => LABELS[s] ?? s.replace(/_/g, " ")).join(" + ");
}

const VERDICT_STYLE: Record<string, { text: string; badge: string; label: string }> = {
  trusted:      { text: "text-bull",    badge: "bg-bull/15 text-bull border-bull/30",       label: "Trusted" },
  promising:    { text: "text-bull",    badge: "bg-bull/10 text-bull border-bull/20",       label: "Promising" },
  watch:        { text: "text-warning", badge: "bg-[var(--color-warning)]/15 text-warning border-[var(--color-warning)]/30", label: "Watch" },
  caution:      { text: "text-bear",    badge: "bg-bear/15 text-bear border-bear/30",       label: "Caution" },
  insufficient: { text: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border", label: "No data" },
};

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "trusted" || verdict === "promising") return <ShieldCheck className="w-3.5 h-3.5 text-bull" />;
  if (verdict === "watch") return <TrendingUp className="w-3.5 h-3.5 text-warning" />;
  if (verdict === "caution") return <AlertTriangle className="w-3.5 h-3.5 text-bear" />;
  return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />;
}

interface Row {
  scanType: string;
  totalTrades: number;
  openTrades: number;
  winRate: number;
  expectancy: number;
  avgWinPct: number;
  avgLossPct: number;
  goodSignals: number;
  badSignals: number;
  reliabilityScore: number;
  sampleSize: "none" | "low" | "medium" | "high";
  verdict: string;
}

function ReliabilityCard({ r }: { r: Row }) {
  const style = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.insufficient;
  return (
    <div className="pf-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <VerdictIcon verdict={r.verdict} />
          <span className="text-xs font-semibold text-foreground truncate">{labelFor(r.scanType)}</span>
        </div>
        <span className={cn("text-3xs font-semibold px-1.5 py-0.5 rounded border shrink-0", style.badge)}>
          {style.label}
        </span>
      </div>

      {/* Reliability bar */}
      <div>
        <div className="flex items-center justify-between text-3xs text-muted-foreground mb-0.5">
          <span>Reliability</span>
          <span className={cn("tabular-nums font-semibold", style.text)}>{r.reliabilityScore}/100</span>
        </div>
        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full",
              r.reliabilityScore >= 65 ? "bg-bull" : r.reliabilityScore >= 45 ? "bg-[var(--color-warning)]" : "bg-bear")}
            style={{ width: `${r.reliabilityScore}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-3xs">
        <div>
          <div className="text-muted-foreground">Win Rate</div>
          <div className="tabular-nums font-semibold text-foreground">{r.totalTrades > 0 ? `${r.winRate}%` : "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Expectancy</div>
          <div className={cn("tabular-nums font-semibold", r.expectancy >= 0 ? "text-bull" : "text-bear")}>
            {r.totalTrades > 0 ? `${r.expectancy >= 0 ? "+" : ""}${r.expectancy}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Sample</div>
          <div className="tabular-nums font-semibold text-foreground">
            {r.totalTrades}<span className="text-muted-foreground">c</span>
            {r.openTrades > 0 && <span className="text-blue-400"> · {r.openTrades}o</span>}
          </div>
        </div>
      </div>

      {(r.goodSignals > 0 || r.badSignals > 0) && (
        <div className="flex items-center gap-2 text-3xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Feedback:</span>
          {r.goodSignals > 0 && <span className="text-bull">✅ {r.goodSignals} good</span>}
          {r.badSignals > 0 && <span className="text-bear">❌ {r.badSignals} bad</span>}
        </div>
      )}

      {r.sampleSize === "low" && (
        <div className="text-3xs text-muted-foreground italic">Low sample — treat as indicative only.</div>
      )}
    </div>
  );
}

/**
 * Strategy reliability scorecard. Feeds closed-trade outcomes + user feedback
 * back to the user so they can trust or avoid a strategy before acting on a
 * fresh signal. Pass `filterScanTypes` to show only relevant strategies
 * (e.g. on a scanner page for the currently selected scan type(s)).
 */
export function StrategyReliabilityPanel({
  filterScanTypes, compact = false, title = "Strategy Reliability",
}: {
  filterScanTypes?: string[];
  compact?: boolean;
  title?: string;
}) {
  const { data, isLoading } = trpc.journal.reliability.useQuery();

  const rows = (data ?? []) as Row[];
  const filtered = filterScanTypes && filterScanTypes.length > 0
    ? rows.filter(r => filterScanTypes.some(f => r.scanType === f || r.scanType.split("+").includes(f)))
    : rows;

  if (isLoading) return null;
  if (filtered.length === 0) {
    if (compact) {
      return (
        <div className="pf-card p-3 text-3xs text-muted-foreground">
          No journal history yet for {filterScanTypes && filterScanTypes.length ? "this strategy" : "any strategy"}.
          Save trades and add feedback to build a reliability track record.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-3xs text-muted-foreground">outcomes + feedback</span>
        </div>
      )}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
        {filtered.map(r => <ReliabilityCard key={r.scanType} r={r} />)}
      </div>
    </div>
  );
}
