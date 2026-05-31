import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ScanSearch, RefreshCw, Filter, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, BarChart3, Target, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PatternSeverity = "bullish" | "bearish" | "neutral";

interface PatternResult {
  symbol: string;
  patternType: string;
  patternName: string;
  timeframe: string;
  severity: PatternSeverity;
  confidenceScore: number;
  patternStrength: number;
  volumeConfirmed: boolean;
  breakoutConfirmed: boolean;
  isFalseBreakout: boolean;
  breakoutLevel: number;
  stopLossZone: number;
  targetLevel: number;
  description: string;
  detectedAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MARKETS = [
  { value: "all", label: "All Markets" },
  { value: "india", label: "India NSE" },
  { value: "crypto", label: "Crypto" },
  { value: "us", label: "US Stocks" },
];

const TIMEFRAMES = [
  { value: "1d", label: "Daily" },
  { value: "4h", label: "4 Hour" },
  { value: "1h", label: "1 Hour" },
  { value: "15m", label: "15 Min" },
  { value: "1w", label: "Weekly" },
];

const PATTERN_CATEGORIES = [
  { value: "all", label: "All Patterns" },
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "neutral", label: "Neutral" },
];

const MIN_CONFIDENCE_OPTIONS = [
  { value: 40, label: "40+ (Any)" },
  { value: 50, label: "50+ (Moderate)" },
  { value: 60, label: "60+ (Good)" },
  { value: 70, label: "70+ (High)" },
  { value: 80, label: "80+ (Very High)" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getMarketBadge(symbol: string) {
  // Simple heuristic: crypto symbols are short and uppercase
  const cryptoSymbols = ["BTC", "ETH", "BNB", "SOL", "ADA", "DOT", "MATIC", "AVAX", "LINK", "UNI", "AAVE", "CRV"];
  const usSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "JNJ", "XOM"];
  if (cryptoSymbols.includes(symbol)) return { label: "Crypto", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
  if (usSymbols.includes(symbol)) return { label: "US", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" };
  return { label: "NSE", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
}

function getSeverityConfig(severity: PatternSeverity) {
  if (severity === "bullish") return { color: "text-bull", bg: "bg-bull/10 border-bull/20", icon: TrendingUp };
  if (severity === "bearish") return { color: "text-bear", bg: "bg-bear/10 border-bear/20", icon: TrendingDown };
  return { color: "text-[oklch(0.65_0.12_80)]", bg: "bg-[oklch(0.65_0.12_80)]/10 border-[oklch(0.65_0.12_80)]/20", icon: BarChart3 };
}

function getConfidenceConfig(score: number) {
  if (score >= 75) return { label: "High", color: "text-bull", bg: "bg-bull/10" };
  if (score >= 55) return { label: "Medium", color: "text-[oklch(0.65_0.12_80)]", bg: "bg-[oklch(0.65_0.12_80)]/10" };
  return { label: "Low", color: "text-muted-foreground", bg: "bg-muted/30" };
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Pattern Card ──────────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: PatternResult }) {
  const [expanded, setExpanded] = useState(false);
  const severityConfig = getSeverityConfig(pattern.severity);
  const confidenceConfig = getConfidenceConfig(pattern.confidenceScore);
  const marketBadge = getMarketBadge(pattern.symbol);
  const SeverityIcon = severityConfig.icon;

  return (
    <div className={cn("pf-card overflow-hidden transition-all duration-200", expanded && "ring-1 ring-primary/20")}>
      {/* Main row */}
      <div
        className="p-4 cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: symbol + pattern */}
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border", severityConfig.bg)}>
              <SeverityIcon className={cn("w-4 h-4", severityConfig.color)} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground font-mono">{pattern.symbol}</span>
                <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border", marketBadge.color)}>{marketBadge.label}</Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{pattern.timeframe.toUpperCase()}</Badge>
              </div>
              <div className="text-xs font-semibold text-foreground mt-0.5">{pattern.patternName}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{pattern.description}</div>
            </div>
          </div>

          {/* Right: confidence + badges */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", confidenceConfig.bg, confidenceConfig.color)}>
              <span>{pattern.confidenceScore.toFixed(0)}%</span>
              <span className="opacity-70">{confidenceConfig.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {pattern.volumeConfirmed && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bull/10 text-bull border border-bull/20 font-medium">Vol ✓</span>
              )}
              {pattern.breakoutConfirmed && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">BO ✓</span>
              )}
              {pattern.isFalseBreakout && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bear/10 text-bear border border-bear/20 font-medium">False BO</span>
              )}
            </div>
            <div className="text-[9px] text-muted-foreground">{timeAgo(pattern.detectedAt)}</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pattern.severity === "bullish" ? "bg-bull" : pattern.severity === "bearish" ? "bg-bear" : "bg-primary")}
              style={{ width: `${pattern.confidenceScore}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground shrink-0">Strength: {pattern.patternStrength.toFixed(0)}</span>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 bg-accent/5">
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3 h-3 text-bull" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Target</span>
              </div>
              <div className="text-xs font-bold text-bull font-mono">{fmtPrice(pattern.targetLevel)}</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Breakout</span>
              </div>
              <div className="text-xs font-bold text-primary font-mono">{fmtPrice(pattern.breakoutLevel)}</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="w-3 h-3 text-bear" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Stop Loss</span>
              </div>
              <div className="text-xs font-bold text-bear font-mono">{fmtPrice(pattern.stopLossZone)}</div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{pattern.description}</p>

          <div className="mt-3 flex items-center gap-2">
            <Link href={`/assets/${pattern.symbol}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <BarChart3 className="w-3 h-3" /> View Chart
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Strip ───────────────────────────────────────────────────────────────

function PatternStats({ patterns }: { patterns: PatternResult[] }) {
  const bullish = patterns.filter(p => p.severity === "bullish").length;
  const bearish = patterns.filter(p => p.severity === "bearish").length;
  const highConf = patterns.filter(p => p.confidenceScore >= 70).length;
  const volConfirmed = patterns.filter(p => p.volumeConfirmed).length;

  const stats = [
    { label: "Total Patterns", value: patterns.length, color: "text-foreground" },
    { label: "Bullish", value: bullish, color: "text-bull" },
    { label: "Bearish", value: bearish, color: "text-bear" },
    { label: "High Confidence", value: highConf, color: "text-primary" },
    { label: "Vol Confirmed", value: volConfirmed, color: "text-[oklch(0.65_0.12_80)]" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map(s => (
        <div key={s.label} className="pf-card p-3 text-center">
          <div className={cn("text-xl font-bold tabular-nums", s.color)}>{s.value}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PatternScanner() {
  const [market, setMarket] = useState<"all" | "india" | "crypto" | "us">("all");
  const [timeframe, setTimeframe] = useState("1d");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState(50);
  const [requireVolumeConfirmation, setRequireVolumeConfirmation] = useState(false);
  const [filterFalseBreakouts, setFilterFalseBreakouts] = useState(true);

  const queryInput = useMemo(() => ({
    market: market as any,
    timeframes: [timeframe as any],
    minConfidence,
    requireVolumeConfirmation,
    filterFalseBreakouts,
  }), [market, timeframe, minConfidence, requireVolumeConfirmation, filterFalseBreakouts]);

  const { data: rawPatterns, isLoading, refetch, isFetching } = trpc.global.patterns.useQuery(
    queryInput,
    { refetchInterval: 180000 }
  );

  const patterns = useMemo(() => {
    if (!rawPatterns) return [];
    let filtered = rawPatterns as PatternResult[];
    if (severityFilter !== "all") {
      filtered = filtered.filter(p => p.severity === severityFilter);
    }
    return filtered;
  }, [rawPatterns, severityFilter]);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
            <ScanSearch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Pattern Scanner</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              14 chart pattern types — Head &amp; Shoulders, Flags, Triangles, Wedges, Cup &amp; Handle and more
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rawPatterns && (
            <Badge variant="outline" className="text-xs px-3 py-1">
              {rawPatterns.length} patterns detected
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Scanning..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {patterns.length > 0 && <PatternStats patterns={patterns} />}

      {/* Filters */}
      <div className="pf-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Pattern Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Market</Label>
            <Select value={market} onValueChange={(v) => setMarket(v as any)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETS.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Timeframe</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map(tf => (
                  <SelectItem key={tf.value} value={tf.value} className="text-xs">{tf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Direction</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PATTERN_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min Confidence</Label>
            <Select value={String(minConfidence)} onValueChange={v => setMinConfidence(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_CONFIDENCE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Options</Label>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireVolumeConfirmation}
                  onChange={e => setRequireVolumeConfirmation(e.target.checked)}
                  className="w-3 h-3 accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">Volume Confirmed Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterFalseBreakouts}
                  onChange={e => setFilterFalseBreakouts(e.target.checked)}
                  className="w-3 h-3 accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">Filter False Breakouts</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-primary" />
            Pattern Results
            {patterns.length > 0 && (
              <Badge variant="outline" className="text-[9px] ml-1">{patterns.length} patterns</Badge>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* Severity legend */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bull inline-block" />Bullish</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bear inline-block" />Bearish</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Neutral</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : patterns.length > 0 ? (
          <div className="space-y-3">
            {patterns.map((p, i) => (
              <PatternCard key={`${p.symbol}-${p.patternType}-${p.timeframe}-${i}`} pattern={p} />
            ))}
          </div>
        ) : (
          <div className="pf-card p-12 text-center">
            <ScanSearch className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <div className="text-sm font-medium text-muted-foreground">No patterns detected</div>
            <div className="text-[11px] text-muted-foreground/60 mt-1">
              Try lowering the minimum confidence threshold or selecting a different market.
            </div>
            <Button size="sm" variant="outline" className="mt-4 h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3" /> Run Pattern Scan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
