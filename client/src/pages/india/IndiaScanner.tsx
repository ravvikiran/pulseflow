import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Zap, RefreshCw, Filter, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const INDIA_SECTORS = [
  "Information Technology", "Banking & Finance", "Energy & Oil", "Healthcare & Pharma",
  "Consumer Goods", "Metals & Mining", "Automobile", "Real Estate", "Telecom", "FMCG",
  "Infrastructure", "Chemicals",
];

const SCAN_TYPES = [
  { value: "ema_alignment" as const, label: "EMA Alignment" },
  { value: "volume_spike" as const, label: "Volume Spike" },
  { value: "breakout_52w" as const, label: "52-Week High Breakout" },
  { value: "ath_breakout" as const, label: "ATH Breakout" },
  { value: "momentum_continuation" as const, label: "Momentum Continuation" },
  { value: "relative_strength" as const, label: "Relative Strength" },
];

const TIMEFRAMES = [
  { value: "1D" as const, label: "Daily" },
  { value: "4H" as const, label: "4 Hour" },
  { value: "1H" as const, label: "1 Hour" },
  { value: "15M" as const, label: "15 Min" },
  { value: "1W" as const, label: "Weekly" },
];

type ScanType = typeof SCAN_TYPES[number]["value"];
type Timeframe = typeof TIMEFRAMES[number]["value"];

function ScanResultCard({ result, currency = "INR" }: {
  result: {
    symbol: string; name: string; sector: string; price: number; changePct: number;
    volume: number; volumeRatio: number; qualityScore: number; confidence: "high" | "medium" | "low";
    signals: string[]; details: { ema20?: number; ema50?: number; ema200?: number; rsi?: number; volumeConfirmed: boolean; trendAligned: boolean };
  };
  currency?: string;
}) {
  const isPositive = result.changePct >= 0;
  const fmtPrice = (p: number) => currency === "INR"
    ? `₹${p.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  const emaAlignment = result.details.ema20 && result.details.ema50
    ? (result.price > result.details.ema20 && result.details.ema20 > result.details.ema50 ? "bullish" : result.price < result.details.ema20 ? "bearish" : "neutral")
    : "neutral";

  const confidenceColor = result.confidence === "high" ? "text-bull" : result.confidence === "medium" ? "text-[oklch(0.65_0.12_80)]" : "text-muted-foreground";

  return (
    <div className="pf-card-hover p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-primary">{result.symbol.slice(0, 2)}</span>
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">{result.symbol}</div>
            {result.name && <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">{result.name}</div>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold font-mono tabular-nums text-foreground">{fmtPrice(result.price)}</div>
          <div className={cn("text-[10px] font-semibold tabular-nums", isPositive ? "text-bull" : "text-bear")}>
            {isPositive ? "+" : ""}{result.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="flex flex-wrap gap-1">
        {result.signals.slice(0, 3).map(sig => (
          <span key={sig} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{sig}</span>
        ))}
        {result.details.volumeConfirmed && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bull/10 text-bull font-medium">Vol ✓</span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 text-[9px]">
        <div className="bg-surface-2 rounded p-1 text-center">
          <div className="text-muted-foreground">Vol Ratio</div>
          <div className={cn("font-bold tabular-nums", result.volumeRatio >= 2 ? "text-bull" : "text-foreground")}>{result.volumeRatio.toFixed(1)}x</div>
        </div>
        <div className="bg-surface-2 rounded p-1 text-center">
          <div className="text-muted-foreground">EMA</div>
          <div className={cn("font-bold", emaAlignment === "bullish" ? "text-bull" : emaAlignment === "bearish" ? "text-bear" : "text-[oklch(0.65_0.12_80)]")}>{emaAlignment}</div>
        </div>
        <div className="bg-surface-2 rounded p-1 text-center">
          <div className="text-muted-foreground">Quality</div>
          <div className={cn("font-bold tabular-nums", result.qualityScore >= 70 ? "text-bull" : result.qualityScore >= 40 ? "text-[oklch(0.65_0.12_80)]" : "text-bear")}>{result.qualityScore}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {result.sector && (
          <div className="text-[9px] text-muted-foreground truncate">Sector: <span className="text-foreground">{result.sector}</span></div>
        )}
        <span className={cn("text-[9px] font-semibold ml-auto", confidenceColor)}>{result.confidence.toUpperCase()}</span>
      </div>
    </div>
  );
}

export default function IndiaScanner() {
  const [scanType, setScanType] = useState<ScanType>("ema_alignment");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [sector, setSector] = useState<string | undefined>(undefined);
  const [minQualityScore, setMinQualityScore] = useState(30);

  const queryInput = useMemo(() => ({
    scanType,
    timeframe,
    sector,
    minQualityScore,
    maxResults: 20,
    volumeMultiplier: 2.0,
  }), [scanType, timeframe, sector, minQualityScore]);

  const { data: results, isLoading, refetch, isFetching } = trpc.india.scanner.useQuery(
    queryInput,
    { refetchInterval: 120000 }
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.20_40)] to-[oklch(0.55_0.22_30)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">NSE Market Scanner</h1>
            <p className="text-[11px] text-muted-foreground">Improved accuracy engine — EMA alignment, volume spikes, breakouts — NSE stocks only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="badge-bull text-[9px]">NSE Only</Badge>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="pf-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Scanner Filters</span>
          <Badge variant="outline" className="text-[9px] ml-auto">Improved Engine v2</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scan Type</Label>
            <Select value={scanType} onValueChange={(v) => setScanType(v as ScanType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCAN_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Timeframe</Label>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
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
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">NSE Sector</Label>
            <Select value={sector ?? "all"} onValueChange={v => setSector(v === "all" ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All NSE Sectors</SelectItem>
                {INDIA_SECTORS.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min Quality Score: <span className="text-foreground font-semibold">{minQualityScore}</span>
            </Label>
            <Select value={String(minQualityScore)} onValueChange={v => setMinQualityScore(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 30, 40, 50, 60, 70].map(v => (
                  <SelectItem key={v} value={String(v)} className="text-xs">{v}+ (Quality)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <Zap className="w-3 h-3" />
          {isFetching ? "Scanning..." : "Run Scanner"}
        </Button>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Scan Results
            {results && (
              <Badge variant="outline" className="text-[9px] ml-1">{results.length} matches</Badge>
            )}
          </h2>
          <div className="text-[10px] text-muted-foreground">
            {SCAN_TYPES.find(t => t.value === scanType)?.label} · {timeframe} · NSE
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
        ) : results && results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {results.map(r => (
              <ScanResultCard key={r.symbol} result={r} currency="INR" />
            ))}
          </div>
        ) : (
          <div className="pf-card p-8 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">No NSE stocks match the current scan criteria.</div>
            <div className="text-[11px] text-muted-foreground mt-1">Try lowering the minimum quality score or adjusting the scan type.</div>
          </div>
        )}
      </div>
    </div>
  );
}
