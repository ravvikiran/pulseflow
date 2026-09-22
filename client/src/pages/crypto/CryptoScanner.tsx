import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Search, Filter, Play, Save, Trash2,
  TrendingUp, BarChart3, Activity, Zap,
  ArrowUpRight, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateView, QueryErrorState } from "@/components/shared/StateView";
import { SaveTradeButton } from "@/components/shared/SaveTradeButton";
import { StrategyReliabilityPanel } from "@/components/shared/StrategyReliability";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const SCAN_TYPES = [
  { value: "ema_alignment", label: "EMA Alignment", icon: TrendingUp, desc: "Price > EMA20 > EMA50 > EMA200 (Bullish Stack)" },
  { value: "volume_spike", label: "Volume Spike Detection", icon: BarChart3, desc: "Current volume significantly above 20-day average" },
  { value: "breakout_52w", label: "52-Week High Breakout", icon: ArrowUpRight, desc: "Price near or at 52-week high" },
  { value: "ath_breakout", label: "ATH Breakout", icon: Zap, desc: "Price near All-Time High" },
  { value: "momentum_continuation", label: "Momentum Continuation", icon: Activity, desc: "RSI > 55, positive price change, elevated volume" },
  { value: "relative_strength", label: "Relative Strength Ranking", icon: TrendingUp, desc: "Outperforming benchmark on relative basis" },
];

const TIMEFRAMES = [
  { value: "1D", label: "1D" },
  { value: "4H", label: "4H" },
  { value: "1H", label: "1H" },
  { value: "15M", label: "15M" },
  { value: "1W", label: "1W" },
];

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${fmt(v)}%`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "var(--color-bull)" : score >= 60 ? "var(--color-primary)" : score >= 40 ? "var(--color-neutral)" : "var(--color-bear)";
  return (
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${(score / 100) * 100} 100`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xs font-bold tabular-nums" style={{ color }}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

function ResultRow({ result, index }: { result: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const change = Number(result.changePct ?? result.changePercent ?? 0);
  const confidence = result.confidence ?? "low";
  const confidenceColor = confidence === "high" ? "text-bull" : confidence === "medium" ? "text-warning" : "text-muted-foreground";

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="grid grid-cols-12 px-4 py-3 hover:bg-accent/30 cursor-pointer transition-colors items-center"
        onClick={() => setExpanded(!expanded)}>
        <div className="col-span-1 text-xs text-muted-foreground tabular-nums font-medium">{index + 1}</div>
        <div className="col-span-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-3xs font-bold text-primary">{result.symbol?.slice(0, 3)}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">{result.symbol}</div>
            <div className="text-3xs text-muted-foreground truncate max-w-[80px]">{result.name}</div>
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs font-semibold tabular-nums text-foreground">${fmt(Number(result.price ?? 0))}</div>
          <div className={cn("text-2xs font-medium tabular-nums", change >= 0 ? "text-bull" : "text-bear")}>{fmtPct(change)}</div>
        </div>
        <div className="col-span-2"><ScoreRing score={Number(result.qualityScore ?? result.score ?? 0)} /></div>
        <div className="col-span-2">
          <div className="text-xs text-foreground tabular-nums">{fmt(result.details?.rsi, 1)}</div>
          <div className="text-2xs text-muted-foreground">RSI</div>
        </div>
        <div className="col-span-2">
          <div className={cn("text-xs tabular-nums font-semibold", confidenceColor)}>{confidence.toUpperCase()}</div>
          <div className="text-2xs text-muted-foreground">Confidence</div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 bg-accent/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {[
              { label: "Stop Loss", value: result.stopLoss ? `$${fmt(result.stopLoss)}` : "—" },
              { label: "Target", value: result.target ? `$${fmt(result.target)}` : "—" },
              { label: "Risk:Reward", value: result.riskReward ?? "—" },
              { label: "Volume Ratio", value: `${fmt(result.volumeRatio ?? 0)}x` },
              { label: "RSI", value: fmt(result.details?.rsi, 1) },
              { label: "Quality", value: `${result.qualityScore}/100` },
              { label: "Confidence", value: (result.confidence ?? "low").toUpperCase() },
              { label: "Trend Aligned", value: result.details?.trendAligned ? "Yes ✓" : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card rounded p-2">
                <div className="text-3xs text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{value}</div>
              </div>
            ))}
          </div>
          {result.signals && result.signals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.signals.map((sig: string) => (
                <span key={sig} className="text-3xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{sig}</span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <Link href={`/assets/${result.symbol}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <BarChart3 className="w-3 h-3" /> View Chart
              </Button>
            </Link>
            <SaveTradeButton result={result} defaultMarket="crypto" defaultExchange="CRYPTO" variant="button" />
          </div>
        </div>
      )}
    </div>
  );
}

function CopySymbolsButton({ symbols, exchange, suffix = "" }: { symbols: string[]; exchange: string; suffix?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Format: EXCHANGE:SYMBOLsuffix,EXCHANGE:SYMBOLsuffix,...
    const tvSymbols = symbols.map(s => `${exchange}:${s}${suffix}`).join(",");
    navigator.clipboard.writeText(tvSymbols).then(() => {
      setCopied(true);
      toast.success(`${symbols.length} symbols copied for TradingView`, {
        description: "Paste in TradingView's 'Add Symbol' to add all at once",
      });
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  if (symbols.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-7 text-xs gap-1.5 transition-all",
        copied && "border-bull/50 text-bull bg-bull/5"
      )}
      onClick={handleCopy}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : `Copy for TradingView`}
    </Button>
  );
}

export default function CryptoScanner() {
  const { isAuthenticated } = useAuth();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["ema_alignment"]);
  const [timeframe, setTimeframe] = useState("1D");
  const [minQualityScore, setMinQualityScore] = useState(30);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const toggleType = (t: string) => {
    setSelectedTypes(prev =>
      prev.includes(t)
        ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) // keep at least one
        : [...prev, t]
    );
  };
  const isCombo = selectedTypes.length > 1;

  const queryInput = useMemo(() => ({
    scanType: selectedTypes[0] as any,
    scanTypes: selectedTypes as any,
    timeframe: timeframe as any,
    minQualityScore,
    maxResults: 20,
    volumeMultiplier: 2.0,
  }), [selectedTypes, timeframe, minQualityScore]);

  const { data: results, isLoading, isError, refetch, isFetching } = trpc.crypto.scanner.useQuery(queryInput, {
    refetchInterval: false,
  });
  const { data: savedScans } = trpc.crypto.savedScans.useQuery(undefined, { enabled: isAuthenticated });
  const saveScanMutation = trpc.crypto.saveScan.useMutation({
    onSuccess: () => { toast.success("Scan configuration saved"); setSaveDialogOpen(false); setSaveName(""); },
  });
  const deleteScanMutation = trpc.crypto.deleteSavedScan.useMutation({
    onSuccess: () => toast.success("Scan deleted"),
  });

  const currentScanType = SCAN_TYPES.find(s => s.value === selectedTypes[0]);
  const ScanIcon = currentScanType?.icon ?? Search;

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-bull pulse-live" />
            <span className="text-2xs uppercase tracking-widest text-bull font-semibold">Crypto Market</span>
          </div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Crypto Market Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Improved accuracy engine — BTC, ETH, Altcoins only
          </p>
        </div>
        {results && (
          <Badge className="badge-bull text-xs px-3 py-1">{results.length} crypto matches</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Filter Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="pf-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Crypto Filters</h3>
              <Badge variant="outline" className="text-3xs ml-auto">v2 Engine</Badge>
            </div>

            {/* Scan Type (multi-select confluence) */}
            <div className="space-y-2">
              <label className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                Scan Strategy {isCombo && <span className="text-primary normal-case">· Confluence ({selectedTypes.length})</span>}
              </label>
              <div className="space-y-1.5">
                {SCAN_TYPES.map(({ value, label, icon: Icon, desc }) => {
                  const active = selectedTypes.includes(value);
                  return (
                  <button key={value} onClick={() => toggleType(value)}
                    aria-pressed={active}
                    className={cn("w-full text-left px-3 py-2 rounded-md text-xs transition-all focus-ring",
                      active
                        ? "bg-primary/15 border border-primary/30 text-primary"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground border border-transparent")}>
                    <div className="flex items-center gap-2">
                      {active ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
                      <span className="font-medium">{label}</span>
                    </div>
                    {active && <div className="text-3xs mt-1 text-primary/70">{desc}</div>}
                  </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSelectedTypes(SCAN_TYPES.map(s => s.value))}
                  className="flex-1 px-2 py-1 rounded text-3xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground focus-ring">
                  Select All (Confluence)
                </button>
                {isCombo && (
                  <button
                    onClick={() => setSelectedTypes([selectedTypes[0]])}
                    className="px-2 py-1 rounded text-3xs font-medium border border-border text-muted-foreground hover:text-foreground focus-ring">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-3xs text-muted-foreground">
                Combine strategies — an asset must pass <span className="font-semibold">every</span> selected gate.
              </p>
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
              <label className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">Timeframe</label>
              <div className="flex flex-wrap gap-1.5">
                {TIMEFRAMES.map(tf => (
                  <button key={tf.value} onClick={() => setTimeframe(tf.value)}
                    aria-pressed={timeframe === tf.value}
                    className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors focus-ring min-h-[32px]",
                      timeframe === tf.value ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Quality Score */}
            <div className="space-y-2">
              <label className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                Min Quality: {minQualityScore}
              </label>
              <div className="flex flex-wrap gap-1">
                {[20, 30, 40, 50, 60, 70].map(v => (
                  <button key={v} onClick={() => setMinQualityScore(v)}
                    aria-pressed={minQualityScore === v}
                    aria-label={`Minimum quality score ${v}`}
                    className={cn("px-2 py-0.5 rounded text-2xs font-medium transition-colors focus-ring",
                      minQualityScore === v ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                    {v}+
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full gap-2 h-9" onClick={() => refetch()} disabled={isLoading}>
              <Play className="w-3.5 h-3.5" />
              {isLoading ? "Scanning..." : "Run Crypto Scanner"}
            </Button>

            {/* Save Scan */}
            {isAuthenticated && (
              <div className="space-y-2">
                {saveDialogOpen ? (
                  <div className="space-y-2">
                    <input
                      type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                      placeholder="Scan name..."
                      className="w-full px-3 py-1.5 rounded bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="flex-1 h-7 text-xs"
                        onClick={() => saveScanMutation.mutate({ name: saveName, config: { scanType: selectedTypes[0], timeframe } })}
                        disabled={!saveName.trim()}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5"
                    onClick={() => setSaveDialogOpen(true)}>
                    <Save className="w-3 h-3" /> Save This Scan
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Saved Scans */}
          {isAuthenticated && savedScans && savedScans.length > 0 && (
            <div className="pf-card p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Saved Scans</h4>
              {savedScans.map((scan: any) => (
                <div key={scan.id} className="flex items-center justify-between group">
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
                    onClick={() => { setSelectedTypes([scan.config?.scanType ?? "ema_alignment"]); setTimeframe(scan.config?.timeframe ?? "1D"); }}>
                    {scan.name}
                  </button>
                  <button aria-label={`Delete saved scan ${scan.name}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-2 -m-1 rounded focus-ring"
                    onClick={() => deleteScanMutation.mutate({ id: scan.id })}>
                    <Trash2 className="w-3 h-3 text-bear" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3 space-y-4">
        <StrategyReliabilityPanel filterScanTypes={selectedTypes} compact title="Track Record — Selected Strategy" />
        <div className="pf-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{currentScanType?.label}</span>
              <Badge variant="outline" className="text-3xs">Crypto Only</Badge>
            </div>
            <div className="flex items-center gap-2">
              {results && results.length > 0 && (
                <CopySymbolsButton symbols={results.map((r: any) => r.symbol)} exchange="BINANCE" suffix="USDT" />
              )}
              {results && <span className="text-xs text-muted-foreground">{results.length} results</span>}
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-12 px-4 py-2 border-b border-border/30 bg-muted/30">
            {["#", "Asset", "Price / Change", "Quality", "RSI", "Confidence"].map((h, i) => (
              <div key={h} className={cn("text-3xs uppercase tracking-wider text-muted-foreground font-semibold",
                i === 0 ? "col-span-1" : i === 1 ? "col-span-3" : "col-span-2")}>{h}</div>
            ))}
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : isError ? (
            <QueryErrorState
              onRetry={() => refetch()}
              isRetrying={isFetching}
              title="Scan failed"
              description="The crypto scanner couldn't complete. Check your connection and retry."
            />
          ) : !results || results.length === 0 ? (
            <StateView
              icon={<Search className="w-10 h-10 text-muted-foreground/30" />}
              title="No crypto assets match this scan"
              description="Try lowering the minimum quality score or switching scan strategy."
              size="lg"
            />
          ) : (
            <div>
              {results.map((result: any, i: number) => (
                <ResultRow key={result.symbol} result={result} index={i} />
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
