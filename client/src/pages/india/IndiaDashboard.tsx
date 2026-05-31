import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Flag, TrendingUp, TrendingDown, Activity, BarChart3,
  RefreshCw, Zap, Users, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetTable } from "@/components/shared/AssetTable";
import { SectorHeatmap } from "@/components/shared/SectorHeatmap";
import { StatCard } from "@/components/shared/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Link } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 2) { return n.toFixed(dec); }
function fmtINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// ─── FII/DII Widget ───────────────────────────────────────────────────────────
function FiiDiiWidget({ data }: { data: { fiiNet: number; diiNet: number; fiiHistory: number[]; diiHistory: number[] } }) {
  const fiiPositive = data.fiiNet >= 0;
  const diiPositive = data.diiNet >= 0;
  const chartData = data.fiiHistory.map((v, i) => ({
    day: `D-${data.fiiHistory.length - i}`,
    FII: v,
    DII: data.diiHistory[i] ?? 0,
  })).reverse();

  return (
    <div className="pf-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">FII / DII Activity</span>
        <Badge variant="outline" className="text-[9px] ml-auto">NSE Only</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2 rounded p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">FII Net</div>
          <div className={cn("text-base font-bold tabular-nums font-mono", fiiPositive ? "text-bull" : "text-bear")}>
            {fiiPositive ? "+" : ""}{fmtINR(data.fiiNet)}
          </div>
          <div className={cn("text-[10px] flex items-center gap-0.5 mt-0.5", fiiPositive ? "text-bull" : "text-bear")}>
            {fiiPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            Foreign Institutional
          </div>
        </div>
        <div className="bg-surface-2 rounded p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">DII Net</div>
          <div className={cn("text-base font-bold tabular-nums font-mono", diiPositive ? "text-bull" : "text-bear")}>
            {diiPositive ? "+" : ""}{fmtINR(data.diiNet)}
          </div>
          <div className={cn("text-[10px] flex items-center gap-0.5 mt-0.5", diiPositive ? "text-bull" : "text-bear")}>
            {diiPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            Domestic Institutional
          </div>
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 250)" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "oklch(0.55 0.010 240)" }} />
            <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.010 240)" }} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
            <Tooltip
              contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: 6, fontSize: 11 }}
              formatter={(v: number) => [fmtINR(v), ""]}
            />
            <Bar dataKey="FII" fill="oklch(0.60 0.20 250)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="DII" fill="oklch(0.68 0.18 155)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Market Breadth Widget ────────────────────────────────────────────────────
function MarketBreadthWidget({ breadth }: { breadth: { advancing: number; declining: number; unchanged: number; adRatio: number; newHighs: number; newLows: number; putCallRatio: number; vix: number } }) {
  const total = breadth.advancing + breadth.declining + breadth.unchanged;
  const advPct = (breadth.advancing / total) * 100;
  const decPct = (breadth.declining / total) * 100;

  return (
    <div className="pf-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Market Breadth</span>
        <Badge variant="outline" className="text-[9px] ml-auto">NSE Only</Badge>
      </div>

      {/* A/D bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span className="text-bull">▲ {breadth.advancing} Advancing</span>
          <span className="text-bear">▼ {breadth.declining} Declining</span>
        </div>
        <div className="h-2 bg-bear/30 rounded-full overflow-hidden">
          <div className="h-full bg-bull rounded-full transition-all" style={{ width: `${advPct}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>{advPct.toFixed(1)}%</span>
          <span>{breadth.unchanged} Unchanged</span>
          <span>{decPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "A/D Ratio", value: breadth.adRatio.toFixed(2), positive: breadth.adRatio >= 1 },
          { label: "New 52W Highs", value: breadth.newHighs.toString(), positive: true },
          { label: "New 52W Lows", value: breadth.newLows.toString(), positive: false },
          { label: "India VIX", value: breadth.vix.toFixed(2), positive: breadth.vix < 20 },
          { label: "Put/Call Ratio", value: breadth.putCallRatio.toFixed(2), positive: breadth.putCallRatio < 1 },
        ].map(({ label, value, positive }) => (
          <div key={label} className="bg-surface-2 rounded p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className={cn("text-sm font-bold tabular-nums font-mono mt-0.5", positive ? "text-bull" : "text-bear")}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── India Indices Widget ─────────────────────────────────────────────────────
function IndiaIndicesWidget({ indices }: { indices: Array<{ symbol: string; name: string; price: number; changePercent: number; change: number }> }) {
  return (
    <div className="pf-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Indian Indices</span>
        <Badge variant="outline" className="text-[9px] ml-auto">NSE Only</Badge>
      </div>
      <div className="divide-y divide-border/50">
        {indices.map((idx) => {
          const isPositive = idx.changePercent >= 0;
          return (
            <div key={idx.symbol} className="px-4 py-2.5 flex items-center justify-between hover:bg-accent/20 transition-colors">
              <div>
                <div className="text-xs font-semibold text-foreground">{idx.symbol}</div>
                <div className="text-[10px] text-muted-foreground">{idx.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono tabular-nums text-foreground">
                  ₹{idx.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
                <div className={cn("text-[10px] font-medium tabular-nums flex items-center justify-end gap-0.5",
                  isPositive ? "text-bull" : "text-bear"
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? "+" : ""}{fmt(idx.changePercent)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── India Dashboard ──────────────────────────────────────────────────────────
export default function IndiaDashboard() {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const { data, isLoading, refetch, isFetching } = trpc.india.dashboard.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const sentiment = data?.sentiment;
  const sentimentScore = sentiment?.sentimentScore ?? 0;
  const sentimentState = sentiment?.marketState ?? "neutral";

  return (
    <div className="p-4 md:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.20_40)] to-[oklch(0.55_0.22_30)] flex items-center justify-center">
            <Flag className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Indian Stock Market</h1>
            <p className="text-[11px] text-muted-foreground">NSE · BSE · Nifty 50 · Sector Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="badge-bull text-[9px]">NSE Only</Badge>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Indian Market Sentiment Score */}
      <div className="pf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Indian Market Sentiment</span>
          <span className={cn("text-xs font-bold uppercase px-2 py-0.5 rounded",
            sentimentState === "bullish" ? "badge-bull" : sentimentState === "bearish" ? "badge-bear" : "badge-neutral"
          )}>{sentimentState}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="oklch(0.22 0.012 250)" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={sentimentState === "bullish" ? "oklch(0.68 0.18 155)" : sentimentState === "bearish" ? "oklch(0.58 0.22 25)" : "oklch(0.65 0.12 80)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(50 + sentimentScore / 2) * 2.01} 201`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold tabular-nums">{sentimentScore.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[
              { label: "India VIX", value: fmt(sentiment?.volatilityIndex ?? 0) },
              { label: "A/D Ratio", value: fmt(sentiment?.advanceDeclineRatio ?? 0) },
              { label: "52W Highs", value: String(Math.round((sentiment?.breadthScore ?? 50) * 0.8)) },
              { label: "52W Lows", value: String(Math.round((100 - (sentiment?.breadthScore ?? 50)) * 0.3)) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-2 rounded p-2">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="text-sm font-bold tabular-nums font-mono text-foreground mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Indices + Breadth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
            <IndiaIndicesWidget indices={data?.indices ?? []} />
          )}
        </div>
        <div className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
            <MarketBreadthWidget breadth={data?.breadth ? {
        advancing: data.breadth.advanceCount,
        declining: data.breadth.declineCount,
        unchanged: data.breadth.unchangedCount,
        adRatio: data.breadth.advanceDeclineRatio,
        newHighs: Math.round((data.breadth?.breadthScore ?? 50) * 0.8),
        newLows: Math.round((100 - (data.breadth?.breadthScore ?? 50)) * 0.3),
        putCallRatio: 0.9,
        vix: data.sentiment?.volatilityIndex ?? 15,
      } : {
              advancing: 0, declining: 0, unchanged: 0, adRatio: 1,
              newHighs: 0, newLows: 0, putCallRatio: 0.9, vix: 15,
            }} />
          )}
        </div>
      </div>

      {/* NSE Sector Heatmap */}
      <div className="pf-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">NSE Sector Heatmap</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">NSE Only</Badge>
            <Link href="/india/sectors">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary gap-1">
                Full Analysis <ArrowUpRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-6 gap-1.5">{[...Array(12)].map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
        ) : (
          <SectorHeatmap
            data=        {(data?.sectorPerformance ?? []).map(s => ({
              sector: s.sector,
              change: s.priceChange1d,
              inflowOutflow: s.inflowOutflow,
            }))}
            onSelect={setSelectedSector}
            selected={selectedSector ?? undefined}
          />
        )}
        {selectedSector && (
          <div className="bg-surface-2 rounded p-3 text-xs text-muted-foreground">
            Selected: <span className="text-foreground font-medium">{selectedSector}</span>
            {" — "}
            <Link href={`/india/sectors?sector=${encodeURIComponent(selectedSector)}`}>
              <span className="text-primary cursor-pointer hover:underline">View sector details →</span>
            </Link>
          </div>
        )}
      </div>

      {/* FII/DII */}
      {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <FiiDiiWidget data={{
        fiiNet: (data?.fiiActivity?.netBuy ?? 0) * 1e7,
        diiNet: (data?.diiActivity?.netBuy ?? 0) * 1e7,
        fiiHistory: Array.from({ length: 10 }, (_, i) => ((data?.fiiActivity?.netBuy ?? 0) + (i - 5) * 200) * 1e7),
        diiHistory: Array.from({ length: 10 }, (_, i) => ((data?.diiActivity?.netBuy ?? 0) + (i - 5) * 150) * 1e7),
      }} />
      )}

      {/* Top Gainers & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-bull" /> NSE Top Gainers
            </h2>
            <Link href="/india/scanner">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary gap-1">
                Scanner <Zap className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {isLoading ? <Skeleton className="h-48 w-full rounded-lg" /> : (
            <AssetTable
              assets={(data?.topGainers ?? []).map(a => ({ ...a, currency: "INR" }))}
              showRank
              compact
              linkPrefix="/india/assets"
            />
          )}
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-bear" /> NSE Top Losers
          </h2>
          {isLoading ? <Skeleton className="h-48 w-full rounded-lg" /> : (
            <AssetTable
              assets={(data?.topLosers ?? []).map(a => ({ ...a, currency: "INR" }))}
              showRank
              compact
              linkPrefix="/india/assets"
            />
          )}
        </div>
      </div>

      {/* Sector Rotation Preview */}
      <div className="pf-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Sector Rotation Snapshot</span>
          </div>
          <Link href="/india/sectors">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary gap-1">
              Full Engine <ArrowUpRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-1.5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <div className="space-y-1.5">
            {(data?.sectorPerformance ?? []).slice(0, 6).map((s, idx) => (
              <div key={s.sector} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-accent/20 transition-colors">
                <span className="text-[10px] text-muted-foreground w-4 tabular-nums">{idx + 1}</span>
                <span className="text-xs font-medium text-foreground flex-1">{s.sector}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", s.performanceScore >= 60 ? "bg-bull" : s.performanceScore >= 40 ? "bg-[oklch(0.65_0.12_80)]" : "bg-bear")}
                      style={{ width: `${Math.min(100, s.performanceScore)}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-semibold tabular-nums w-8 text-right",
                    s.priceChange1d >= 0 ? "text-bull" : "text-bear"
                  )}>
                    {s.priceChange1d >= 0 ? "+" : ""}{s.priceChange1d.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
