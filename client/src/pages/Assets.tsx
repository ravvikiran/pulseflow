import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useRoute, useLocation } from "wouter";
import {
  Search, TrendingUp, TrendingDown, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, ChevronLeft, Star, Bell,
  Filter, RefreshCw, Grid3X3, List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  LineChart,
} from "recharts";

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${fmt(v)}%`;
}
function fmtVol(v: number) {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}

// Sector filter options grouped by market domain
const SECTOR_GROUPS = [
  {
    group: "All Markets",
    options: [{ value: "All", label: "All Assets" }],
  },
  {
    group: "Indian Stock Market (NSE)",
    options: [
      "Information Technology", "Banking & Finance", "Energy & Oil",
      "Healthcare & Pharma", "Consumer Goods", "Metals & Mining", "Automobile",
      "Real Estate", "Telecom", "FMCG", "Infrastructure",
    ].map(s => ({ value: s, label: s })),
  },
  {
    group: "Crypto Market",
    options: [{ value: "Cryptocurrency", label: "Cryptocurrency" }],
  },
];
// Flat list for backward compat
const SECTORS = ["All", "Information Technology", "Banking & Finance", "Energy & Oil",
  "Healthcare & Pharma", "Consumer Goods", "Metals & Mining", "Automobile",
  "Real Estate", "Telecom", "FMCG", "Cryptocurrency", "Infrastructure",
];

import TradingViewChart from "@/components/shared/TradingViewChart";

// ─── Asset Detail View ────────────────────────────────────────────────────────
function AssetDetail({ symbol }: { symbol: string }) {
  const [, setLocation] = useLocation();
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const { data: asset, isLoading } = trpc.assets.detail.useQuery({ symbol }, { refetchInterval: 30000 });
  const { data: compareData } = trpc.assets.compare.useQuery(
    { symbols: [symbol, ...compareSymbols] },
    { enabled: compareSymbols.length > 0 }
  );

  if (isLoading) return (
    <div className="p-4 lg:p-6 space-y-4">
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-64 w-full rounded" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded" />)}
      </div>
    </div>
  );

  if (!asset) return (
    <div className="p-6 text-center text-muted-foreground">Asset not found</div>
  );

  const change = Number(asset.changePercent ?? 0);
  const isPositive = change >= 0;
  const ind = asset.indicators;

  const emaAlignment = ind && ind.ema20 && ind.ema50 && ind.ema200
    ? (asset.price > ind.ema20 && ind.ema20 > ind.ema50 && ind.ema50 > ind.ema200 ? "bullish"
      : asset.price < ind.ema20 && ind.ema20 < ind.ema50 && ind.ema50 < ind.ema200 ? "bearish" : "mixed")
    : "mixed";

  const compareChartData = compareData ? compareData[0]?.data.map((d: any, i: number) => {
    const point: any = {
      date: new Date(d.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
    };
    compareData.forEach((series: any) => {
      point[series.symbol] = series.data[i]?.normalizedReturn ?? 0;
    });
    return point;
  }) : [];

  const COMPARE_COLORS = ["var(--color-primary)", "#f59e0b", "#3b82f6", "#a855f7", "#ec4899"];

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Back + Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setLocation("/assets")}>
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{asset.symbol}</h1>
              <Badge className={cn("text-[10px]", isPositive ? "badge-bull" : "badge-bear")}>
                {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {fmtPct(change)}
              </Badge>
              <Badge className={cn("text-[10px]", emaAlignment === "bullish" ? "badge-bull" : emaAlignment === "bearish" ? "badge-bear" : "badge-neutral")}>
                EMA {emaAlignment.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm text-muted-foreground">{asset.name} · {asset.exchange} · {asset.sector}</span>
              {asset.exchange === "CRYPTO" ? (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wide">Crypto Market</span>
              ) : asset.exchange === "NSE" || asset.exchange === "BSE" ? (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">Indian Stock Market</span>
              ) : asset.exchange === "INDEX" ? (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wide">Index</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowCompare(!showCompare)}>
            <BarChart3 className="w-3 h-3" /> Compare
          </Button>
        </div>
      </div>

      {/* Price Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Price", value: fmt(Number(asset.price)), highlight: true },
          { label: "Open", value: fmt(Number(asset.open)) },
          { label: "High", value: fmt(Number(asset.high)) },
          { label: "Low", value: fmt(Number(asset.low)) },
          { label: "Volume", value: fmtVol(Number(asset.volume)) },
          { label: "52W High", value: fmt(ind?.high52w) },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="pf-card p-3">
            <div className="stat-label">{label}</div>
            <div className={cn("text-sm font-bold tabular-nums mt-1", highlight ? (isPositive ? "text-bull" : "text-bear") : "text-foreground")}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="pf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Price Chart — 1 Year (Daily)</h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-amber-400" /> EMA 20</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500" /> EMA 50</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-violet-500" /> EMA 200</span>
          </div>
        </div>
        <TradingViewChart
          candles={asset.candles ?? []}
          ema20={(asset as any).emaData?.ema20}
          ema50={(asset as any).emaData?.ema50}
          ema200={(asset as any).emaData?.ema200}
          height={420}
          showVolume={true}
        />
      </div>

      {/* Technical Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="pf-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">EMA Levels</h3>
          <div className="space-y-3">
            {[
              { label: "EMA 20", value: ind?.ema20, color: "#f59e0b" },
              { label: "EMA 50", value: ind?.ema50, color: "#3b82f6" },
              { label: "EMA 200", value: ind?.ema200, color: "#a855f7" },
            ].map(({ label, value, color }) => {
              const price = Number(asset.price);
              const ema = Number(value ?? 0);
              const diff = ((price - ema) / ema) * 100;
              return (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold tabular-nums text-foreground">{fmt(ema)}</div>
                    <div className={cn("text-[10px] tabular-nums", diff >= 0 ? "text-bull" : "text-bear")}>
                      {diff >= 0 ? "+" : ""}{fmt(diff, 2)}% from price
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pf-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Technical Indicators</h3>
          <div className="space-y-3">
            {/* RSI */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">RSI (14)</span>
                <span className={cn("font-medium tabular-nums", Number(ind?.rsi ?? 50) > 70 ? "text-bear" : Number(ind?.rsi ?? 50) < 30 ? "text-bull" : "text-foreground")}>
                  {fmt(ind?.rsi, 1)} {Number(ind?.rsi ?? 50) > 70 ? "(Overbought)" : Number(ind?.rsi ?? 50) < 30 ? "(Oversold)" : ""}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                <div className="absolute left-[30%] right-[30%] h-full bg-bull/10" />
                <div className="absolute left-[70%] right-0 h-full bg-bear/10" />
                <div className="h-full w-0.5 bg-muted-foreground/30 absolute" style={{ left: "30%" }} />
                <div className="h-full w-0.5 bg-muted-foreground/30 absolute" style={{ left: "70%" }} />
                <div
                  className="h-full w-1 rounded-full bg-primary transition-all duration-500 absolute"
                  style={{ left: `${Math.min(99, Math.max(0, Number(ind?.rsi ?? 50)))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>0 (Oversold)</span><span>50</span><span>100 (Overbought)</span>
              </div>
            </div>

            {/* Volume Ratio */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Volume Ratio (20d avg)</span>
              <Badge className={cn("text-[10px]", Number(ind?.volumeRatio ?? 1) > 2 ? "badge-bull" : "badge-neutral")}>
                {fmt(ind?.volumeRatio, 2)}x
              </Badge>
            </div>

            {/* 52W Range */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">52-Week Range</span>
                <span className="text-foreground text-[10px] tabular-nums">{fmt(ind?.low52w)} – {fmt(ind?.high52w)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, ((Number(asset.price) - Number(ind?.low52w ?? 0)) / (Number(ind?.high52w ?? 1) - Number(ind?.low52w ?? 0))) * 100)}%`
                  }}
                />
              </div>
            </div>

            {/* ATH */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">All-Time High (ATH)</span>
              <div className="text-right">
                <div className="text-xs font-semibold tabular-nums text-foreground">{fmt(ind?.ath)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {fmt(((Number(asset.price) - Number(ind?.ath ?? 0)) / Number(ind?.ath ?? 1)) * 100, 1)}% from ATH
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relative Strength Comparison */}
      {showCompare && (
        <div className="pf-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Relative Strength Comparison</h3>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add symbol (e.g. TCS)"
                className="h-7 text-xs w-32 bg-muted border-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.toUpperCase().trim();
                    if (val && !compareSymbols.includes(val) && compareSymbols.length < 4) {
                      setCompareSymbols(prev => [...prev, val]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
              {compareSymbols.map(s => (
                <Badge key={s} className="text-[10px] gap-1 cursor-pointer" onClick={() => setCompareSymbols(prev => prev.filter(x => x !== s))}>
                  {s} ×
                </Badge>
              ))}
            </div>
          </div>
          {compareData && compareData.length > 1 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }}
                    formatter={(val: any) => [`${fmt(val)}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: "9px" }} />
                  {compareData.map((series: any, i: number) => (
                    <Line key={series.symbol} type="monotone" dataKey={series.symbol} stroke={COMPARE_COLORS[i]} strokeWidth={1.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
              Enter symbols above to compare relative strength (press Enter)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Asset List View ──────────────────────────────────────────────────────────
function AssetList() {
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState("All");
  const [sector, setSector] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Use search query when user is typing, otherwise use the list endpoint
  const { data: searchResults, isLoading: searchLoading } = trpc.assets.search.useQuery(
    { query: search },
    { enabled: search.length >= 2, refetchInterval: 30000 }
  );

  const marketFilter = assetType === "All" ? "all" : assetType === "Crypto" ? "crypto" : assetType === "US" ? "us" : "india";
  const { data: listResults, isLoading: listLoading } = trpc.assets.list.useQuery(
    { market: marketFilter as any, sector: sector !== "All" ? sector : undefined },
    { enabled: search.length < 2, refetchInterval: 30000 }
  );

  const isLoading = search.length >= 2 ? searchLoading : listLoading;
  const displayAssets = search.length >= 2 ? searchResults : listResults;

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Multi-Asset Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">NSE Stocks · Cryptocurrency · Indices · Sector Indices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => setViewMode("list")}>
            <List className="w-3.5 h-3.5" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => setViewMode("grid")}>
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search symbol or name..."
            className="pl-8 h-8 text-xs bg-muted border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {["All", "stock", "crypto", "index"].map(t => (
            <button
              key={t}
              onClick={() => setAssetType(t)}
              className={cn("px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize", assetType === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {t === "All" ? "All Types" : t === "stock" ? "NSE Stocks" : t === "crypto" ? "Crypto" : "Indices"}
            </button>
          ))}
        </div>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="h-8 text-xs w-40 bg-muted border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Asset Grid/List */}
      {isLoading ? (
        <div className={cn("gap-3", viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "space-y-2")}>
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {(displayAssets ?? []).map((asset: any) => {
            const change = Number(asset.changePercent ?? 0);
            return (
              <Link key={asset.symbol} href={`/assets/${asset.symbol}`}>
                <div className="pf-card-hover p-3 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{asset.symbol.slice(0, 2)}</span>
                    </div>
                    <Badge className={cn("text-[9px]", change >= 0 ? "badge-bull" : "badge-bear")}>
                      {fmtPct(change)}
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-foreground">{asset.symbol}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{asset.name}</div>
                  <div className="text-sm font-bold tabular-nums text-foreground mt-1">{fmt(Number(asset.price))}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">Vol: {fmtVol(Number(asset.volume))}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="pf-card overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div className="col-span-3">Asset</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Change</div>
            <div className="col-span-2">Volume</div>
            <div className="col-span-2">High / Low</div>
            <div className="col-span-1">Type</div>
          </div>
          {(displayAssets ?? []).map((asset: any) => {
            const change = Number(asset.changePercent ?? 0);
            return (
              <Link key={asset.symbol} href={`/assets/${asset.symbol}`}>
                <div className="grid grid-cols-12 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/30 cursor-pointer transition-colors items-center">
                  <div className="col-span-3 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-primary">{asset.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{asset.symbol}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{asset.name}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-xs font-semibold tabular-nums text-foreground">{fmt(Number(asset.price))}</div>
                  <div className={cn("col-span-2 text-xs font-bold tabular-nums", change >= 0 ? "text-bull" : "text-bear")}>
                    {fmtPct(change)}
                  </div>
                  <div className="col-span-2 text-xs tabular-nums text-muted-foreground">{fmtVol(Number(asset.volume))}</div>
                  <div className="col-span-2 text-[10px] tabular-nums text-muted-foreground">
                    {fmt(Number(asset.high))} / {fmt(Number(asset.low))}
                  </div>
                  <div className="col-span-1">
                    <Badge className="text-[9px] bg-muted text-muted-foreground border-0">{asset.assetType ?? asset.exchange}</Badge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function Assets() {
  const [match, params] = useRoute("/assets/:symbol");
  if (match && params?.symbol) return <AssetDetail symbol={params.symbol} />;
  return <AssetList />;
}
