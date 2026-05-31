import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Flag, Activity, TrendingUp, TrendingDown, RefreshCw,
  ArrowUpRight, BarChart3, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectorHeatmap } from "@/components/shared/SectorHeatmap";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const TIMEFRAMES = ["1d", "1w", "1m"] as const;
type Timeframe = typeof TIMEFRAMES[number];

function SectorRow({ sector, rank, timeframe }: {
  sector: { sector: string; performanceScore: number; momentumScore: number; strengthScore: number; volumeScore: number; breakoutFrequency: number; inflowOutflow: number; priceChange1d: number; priceChange1w: number; priceChange1m: number };
  rank: number;
  timeframe: Timeframe;
}) {
  const change = timeframe === "1d" ? sector.priceChange1d : timeframe === "1w" ? sector.priceChange1w : sector.priceChange1m;
  const isPositive = change >= 0;
  const score = sector.performanceScore;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors border-b border-border/50">
      <span className="text-[10px] text-muted-foreground w-5 tabular-nums shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground">{sector.sector}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Mom</span>
            <div className="w-10 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${sector.momentumScore}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Str</span>
            <div className="w-10 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-bull rounded-full" style={{ width: `${sector.strengthScore}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Vol</span>
            <div className="w-10 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-[oklch(0.65_0.12_80)] rounded-full" style={{ width: `${sector.volumeScore}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className={cn("text-xs font-bold tabular-nums", isPositive ? "text-bull" : "text-bear")}>
            {isPositive ? "+" : ""}{change.toFixed(2)}%
          </div>
          <div className="text-[9px] text-muted-foreground">
            {sector.inflowOutflow >= 0 ? "↑" : "↓"} {Math.abs(sector.inflowOutflow / 1000).toFixed(1)}B
          </div>
        </div>
        <span className={cn("score-badge text-[10px] w-8",
          score >= 70 ? "bg-bull/15 text-bull" : score >= 40 ? "bg-[oklch(0.65_0.12_80/0.15)] text-[oklch(0.65_0.12_80)]" : "bg-bear/15 text-bear"
        )}>{score.toFixed(0)}</span>
      </div>
    </div>
  );
}

export default function IndiaSectors() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const { data: sectors, isLoading, refetch, isFetching } = trpc.india.sectorRotation.useQuery(
    { timeframe },
    { refetchInterval: 60000 }
  );

  const { data: heatmap } = trpc.india.sectorHeatmap.useQuery(undefined, { refetchInterval: 60000 });

  const { data: sectorDetail } = trpc.india.sectorDetail.useQuery(
    { sector: selectedSector ?? "", days: 30 },
    { enabled: !!selectedSector }
  );

  const inflowData = (sectors ?? []).map(s => ({
    name: s.sector.split(" ")[0],
    inflow: s.inflowOutflow,
    score: s.performanceScore,
  }));

  const radarData = selectedSector && sectorDetail ? [
    { metric: "Momentum", value: sectorDetail.current.momentumScore },
    { metric: "Strength", value: sectorDetail.current.strengthScore },
    { metric: "Volume", value: sectorDetail.current.volumeScore },
    { metric: "Breakout", value: sectorDetail.current.breakoutFrequency * 10 },
    { metric: "Performance", value: sectorDetail.current.performanceScore },
  ] : [];

  return (
    <div className="p-4 md:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.20_40)] to-[oklch(0.55_0.22_30)] flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sector Rotation Engine</h1>
            <p className="text-[11px] text-muted-foreground">NSE sector rankings, momentum, and inflow/outflow analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="badge-bull text-[9px]">NSE Only</Badge>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-2">
        {TIMEFRAMES.map(tf => (
          <Button
            key={tf}
            variant={timeframe === tf ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setTimeframe(tf)}
          >
            {tf === "1d" ? "1 Day" : tf === "1w" ? "1 Week" : "1 Month"}
          </Button>
        ))}
      </div>

      {/* Heatmap */}
      <div className="pf-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">NSE Sector Heatmap</span>
          <Badge variant="outline" className="text-[9px] ml-auto">Click to select</Badge>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-6 gap-1.5">{[...Array(12)].map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
        ) : (
          <SectorHeatmap
            data={(heatmap ?? []).map(s => ({ sector: s.sector, change: s.change, inflowOutflow: s.inflowOutflow }))}
            onSelect={setSelectedSector}
            selected={selectedSector ?? undefined}
          />
        )}
      </div>

      {/* Sector Detail */}
      {selectedSector && sectorDetail && (
        <div className="pf-card p-4 space-y-3 border-l-2 border-l-primary">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{selectedSector} — Sector Detail</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedSector(null)}>✕ Close</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48">
              <RadarChart width={220} height={180} data={radarData}>
                <PolarGrid stroke="oklch(0.22 0.010 250)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "oklch(0.55 0.010 240)" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                <Radar name="Score" dataKey="value" stroke="oklch(0.60 0.20 250)" fill="oklch(0.60 0.20 250)" fillOpacity={0.3} />
              </RadarChart>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Stocks in Sector</div>
              {(sectorDetail.assets ?? []).slice(0, 5).map(a => (
                <div key={a.symbol} className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-xs font-medium text-foreground">{a.symbol}</span>
                  <span className={cn("text-xs font-semibold tabular-nums", a.changePercent >= 0 ? "text-bull" : "text-bear")}>
                    {a.changePercent >= 0 ? "+" : ""}{a.changePercent.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Rankings List */}
        <div className="pf-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Flag className="w-4 h-4 text-[oklch(0.65_0.20_40)]" />
            <span className="text-sm font-semibold text-foreground">Sector Rankings</span>
            <Badge variant="outline" className="text-[9px] ml-auto">NSE Only</Badge>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div>
              {(sectors ?? []).map((s, i) => (
                <SectorRow key={s.sector} sector={s} rank={i + 1} timeframe={timeframe} />
              ))}
            </div>
          )}
        </div>

        {/* Inflow/Outflow Chart */}
        <div className="pf-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Sector Inflow / Outflow</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inflowData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "oklch(0.55 0.010 240)" }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}B`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "oklch(0.55 0.010 240)" }} width={55} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number) => [`${(v / 1000).toFixed(2)}B`, "Net Flow"]}
                />
                <Bar dataKey="inflow" radius={[0, 3, 3, 0]}>
                  {inflowData.map((entry, index) => (
                    <Cell key={index} fill={entry.inflow >= 0 ? "oklch(0.68 0.18 155)" : "oklch(0.58 0.22 25)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
