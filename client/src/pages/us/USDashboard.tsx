import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, RefreshCw, Flag,
  DollarSign, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip, Cell,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${fmt(v)}%`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string; icon?: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="pf-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="stat-value">{value}</div>
      {sub && (
        <div className={cn("stat-change", trend === "up" ? "text-bull" : trend === "down" ? "text-bear" : "text-muted-foreground")}>
          {trend === "up" && <ArrowUpRight className="inline w-3 h-3 mr-0.5" />}
          {trend === "down" && <ArrowDownRight className="inline w-3 h-3 mr-0.5" />}
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Mover Row ────────────────────────────────────────────────────────────────
function MoverRow({ symbol, name, price, changePercent, isGainer }: {
  symbol: string; name: string; price: number; changePercent: number; isGainer: boolean;
}) {
  return (
    <Link href={`/assets/${symbol}`}>
      <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-7 h-7 rounded flex items-center justify-center shrink-0 text-[10px] font-bold",
            isGainer ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear")}>
            {symbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">{symbol}</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{name}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-semibold tabular-nums text-foreground">${fmt(price)}</div>
          <div className={cn("text-[10px] font-medium tabular-nums", isGainer ? "text-bull" : "text-bear")}>
            {fmtPct(changePercent)}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground font-medium tabular-nums">{fmt(p.value)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── US Dashboard ─────────────────────────────────────────────────────────────
export default function USDashboard() {
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");

  const { data, isLoading, refetch } = trpc.us.dashboard.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: sectorHeatmap, isLoading: sectorLoading } = trpc.us.sectorHeatmap.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: indices, isLoading: indicesLoading } = trpc.us.indices.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const sectorChartData = useMemo(() => {
    if (!sectorHeatmap) return [];
    return (sectorHeatmap as any[]).map((s: any) => ({
      sector: s.sector.replace("US ", ""),
      change: Math.round(Number(s.change) * 100) / 100,
      score: Math.round(Number(s.score)),
    })).sort((a, b) => b.change - a.change);
  }, [sectorHeatmap]);

  const displayList = tab === "gainers" ? (data?.topGainers ?? []) : (data?.topLosers ?? []);

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flag className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">US Market</span>
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-amber-500/40 text-amber-400">
              Future Ready
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-foreground">US Market Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            S&amp;P 500, NASDAQ, NYSE — US equities only · {new Date().toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-8">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Future-Ready Notice */}
      <div className="pf-card p-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-400">US Market Module — Simulation Mode</div>
            <div className="text-xs text-muted-foreground mt-1">
              This module is architected and future-ready. Currently displaying simulated data for S&amp;P 500, NASDAQ, and NYSE equities.
              Connect a US market data feed (Alpha Vantage, Polygon.io, or IEX Cloud) to enable live data.
              All scanner logic, sector heatmaps, and breadth indicators are fully functional.
            </div>
          </div>
        </div>
      </div>

      {/* US Indices */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">US Indices</h3>
        {indicesLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(indices ?? []).map((idx: any) => (
              <StatCard key={idx.symbol}
                label={idx.name}
                value={fmt(idx.price)}
                sub={fmtPct(idx.changePercent)}
                icon={BarChart3}
                trend={Number(idx.changePercent) >= 0 ? "up" : "down"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Market Sentiment */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Advance/Decline" value={`${data.marketSentiment.advanceCount}/${data.marketSentiment.declineCount}`}
            sub={`Ratio: ${fmt(data.marketSentiment.advanceCount / Math.max(1, data.marketSentiment.declineCount), 2)}`}
            icon={Activity}
            trend={data.marketSentiment.advanceCount > data.marketSentiment.declineCount ? "up" : "down"} />
          <StatCard label="Breadth Score" value={`${fmt(data.marketSentiment.breadthScore, 1)}`}
            sub={Number(data.marketSentiment.breadthScore) > 60 ? "Broad advance" : "Narrow market"}
            icon={TrendingUp}
            trend={Number(data.marketSentiment.breadthScore) > 50 ? "up" : "down"} />
          <StatCard label="Sentiment Score" value={`${data.marketSentiment.sentimentScore > 0 ? "+" : ""}${fmt(data.marketSentiment.sentimentScore, 1)}`}
            sub={data.marketSentiment.marketState}
            icon={DollarSign}
            trend={data.marketSentiment.sentimentScore > 0 ? "up" : "down"} />
          <StatCard label="Market State" value={data.marketSentiment.marketState.toUpperCase()}
            sub="Overall condition" icon={Globe}
            trend={data.marketSentiment.marketState === "bullish" ? "up" : data.marketSentiment.marketState === "bearish" ? "down" : "neutral"} />
        </div>
      )}

      {/* Sector Heatmap */}
      <div className="pf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">US Sector Heatmap</h3>
          <Badge variant="outline" className="text-[10px]">US equities only</Badge>
        </div>
        {sectorLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
              {(sectorHeatmap ?? []).map((s: any) => {
                const change = Number(s.change);
                const intensity = Math.min(1, Math.abs(change) / 5);
                const bg = change >= 0
                  ? `oklch(${0.35 + intensity * 0.2} ${0.12 + intensity * 0.08} 155 / ${0.3 + intensity * 0.5})`
                  : `oklch(${0.35 + intensity * 0.2} ${0.12 + intensity * 0.08} 25 / ${0.3 + intensity * 0.5})`;
                return (
                  <div key={s.sector} className="heatmap-cell p-2 min-h-[72px]"
                    style={{ background: bg, border: `1px solid ${change >= 0 ? "oklch(0.68 0.18 155 / 0.2)" : "oklch(0.58 0.22 25 / 0.2)"}` }}>
                    <div className="text-[10px] font-semibold text-foreground/80 uppercase leading-tight">
                      {s.sector.replace("US ", "")}
                    </div>
                    <div className={cn("text-sm font-bold tabular-nums mt-1", change >= 0 ? "text-bull" : "text-bear")}>
                      {fmtPct(change)}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Score: {Math.round(s.score)}</div>
                  </div>
                );
              })}
            </div>
            {/* Sector Bar Chart */}
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={sectorChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 250)" />
                <XAxis dataKey="sector" tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="change" name="1D Change" radius={[3, 3, 0, 0]}>
                  {sectorChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.change >= 0 ? "var(--color-bull)" : "var(--color-bear)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Top Movers */}
      <div className="pf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">US Stock Movers</h3>
          <div className="flex gap-1">
            {(["gainers", "losers"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-2.5 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                  tab === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {t === "gainers" ? "Top Gainers" : "Top Losers"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
          {isLoading ? [...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />) : (
            displayList.slice(0, 10).map((asset: any) => (
              <MoverRow key={asset.symbol} symbol={asset.symbol} name={asset.name}
                price={Number(asset.price)} changePercent={Number(asset.changePercent)}
                isGainer={tab === "gainers"} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
