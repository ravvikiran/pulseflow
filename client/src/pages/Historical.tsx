import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { History, TrendingUp, TrendingDown, BarChart3, Activity, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  Legend, Cell, ReferenceLine,
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

const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#6366f1",
  "Banking & Finance": "#3b82f6",
  "Energy & Oil": "#f59e0b",
  "Healthcare & Pharma": "#10b981",
  "Consumer Goods": "#ec4899",
  "Metals & Mining": "#8b5cf6",
  "Automobile": "#f97316",
  "Real Estate": "#14b8a6",
  "Telecom": "#06b6d4",
  "FMCG": "#84cc16",
  "Cryptocurrency": "#a855f7",
  "Infrastructure": "#64748b",
};

const PERFORMANCE_SYMBOLS = ["NIFTY50", "TCS", "HDFCBANK", "RELIANCE", "BTC"];

export default function Historical() {
  const [sentimentDays, setSentimentDays] = useState("90");
  const [perfDays, setPerfDays] = useState("30");
  const [perfSymbols] = useState(PERFORMANCE_SYMBOLS);

  const [scanType, setScanType] = useState("ema_alignment");
  const { data: sentimentHistory, isLoading: sentLoading } = trpc.historical.indiaSentiment.useQuery({ days: Number(sentimentDays) });
  const { data: sectorRotation, isLoading: sectorLoading } = trpc.historical.indiaSectorRotation.useQuery({ days: 30 });
  const { data: performance, isLoading: perfLoading } = trpc.historical.performance.useQuery({ symbols: perfSymbols, days: Number(perfDays) });
  const { data: scannerHistory, isLoading: scannerLoading } = trpc.historical.scannerResults.useQuery({ scanType, days: 7 });

  const sentimentChartData = useMemo(() => {
    if (!sentimentHistory) return [];
    return (sentimentHistory as any[]).map((s: any) => ({
      date: new Date(s.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
      score: Math.round(Number(s.sentimentScore) * 100) / 100,
      btcDominance: Math.round(Number(s.btcDominance ?? 0) * 100) / 100,
      volatility: Math.round(Number(s.volatilityIndex ?? 0) * 100) / 100,
    }));
  }, [sentimentHistory]);

  const performanceChartData = useMemo(() => {
    if (!performance || performance.length === 0) return [];
    const maxLen = Math.max(...performance.map((s: any) => s.data.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const point: any = { date: performance[0]?.data[i] ? new Date(performance[0].data[i].timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }) : "" };
      performance.forEach((series: any) => {
        point[series.symbol] = series.data[i]?.normalizedReturn ?? 0;
      });
      return point;
    });
  }, [performance]);

  const sectorRankHistory = useMemo(() => {
    if (!sectorRotation || sectorRotation.length === 0) return [];
    // Get last 7 snapshots
    const snapshots = (sectorRotation as any[]).slice(-7);
    return snapshots.map((snap: any) => ({
      date: new Date(snap.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
      ...(snap.data ?? []).reduce((acc: any, s: any) => {
        acc[s.sector?.replace("Information Technology", "IT").replace("Banking & Finance", "Banking").replace("Healthcare & Pharma", "Pharma")] = s.score ?? s.rank;
        return acc;
      }, {}),
    }));
  }, [sectorRotation]);

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Historical Analysis
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sector rotation history · Market sentiment trends · Performance tracking
        </p>
      </div>

      <Tabs defaultValue="sentiment">
        <TabsList className="bg-card border border-border h-8">
          <TabsTrigger value="sentiment" className="text-xs h-6 px-3">Market Sentiment</TabsTrigger>
          <TabsTrigger value="sectors" className="text-xs h-6 px-3">Sector Rotation</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs h-6 px-3">Performance Tracking</TabsTrigger>
          <TabsTrigger value="scanner" className="text-xs h-6 px-3">Scanner Results</TabsTrigger>
        </TabsList>

        {/* ── Sentiment History ── */}
        <TabsContent value="sentiment" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Market Sentiment History</h3>
            <Select value={sentimentDays} onValueChange={setSentimentDays}>
              <SelectTrigger className="h-7 text-xs w-24 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[["30", "30 Days"], ["60", "60 Days"], ["90", "90 Days"], ["180", "180 Days"]].map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sentLoading ? (
            <Skeleton className="h-64 rounded" />
          ) : (
            <>
              {/* Sentiment Score */}
              <div className="pf-card p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sentiment Score</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sentimentChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-bull)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-bull)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-bear)" stopOpacity={0} />
                          <stop offset="95%" stopColor="var(--color-bear)" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={Math.floor(sentimentChartData.length / 8)} />
                      <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} domain={[-100, 100]} />
                      <RechartsTooltip contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }} />
                      <ReferenceLine y={0} stroke="oklch(0.35 0.012 250)" strokeDasharray="4 4" />
                      <ReferenceLine y={20} stroke="var(--color-bull)" strokeDasharray="2 4" strokeOpacity={0.4} />
                      <ReferenceLine y={-20} stroke="var(--color-bear)" strokeDasharray="2 4" strokeOpacity={0.4} />
                      <Area type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} fill="url(#bullGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* BTC Dominance + Volatility */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="pf-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">BTC Dominance (%)</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sentimentChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={Math.floor(sentimentChartData.length / 6)} />
                        <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} domain={[40, 55]} />
                        <RechartsTooltip contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }} />
                        <Line type="monotone" dataKey="btcDominance" stroke="#a855f7" strokeWidth={2} dot={false} name="BTC Dom %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="pf-card p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Volatility Index</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sentimentChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-bear)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-bear)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={Math.floor(sentimentChartData.length / 6)} />
                        <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }} />
                        <Area type="monotone" dataKey="volatility" stroke="var(--color-bear)" strokeWidth={2} fill="url(#volGrad)" dot={false} name="Volatility" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Sector Rotation History ── */}
        <TabsContent value="sectors" className="mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Sector Rotation History (30 Days)</h3>
          {sectorLoading ? (
            <Skeleton className="h-64 rounded" />
          ) : (
            <>
              <div className="pf-card p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sector Score Trends</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sectorRankHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }} />
                      <Legend wrapperStyle={{ fontSize: "9px" }} />
                      {Object.keys(SECTOR_COLORS).slice(0, 6).map(sector => {
                        const shortName = sector.replace("Information Technology", "IT").replace("Banking & Finance", "Banking").replace("Healthcare & Pharma", "Pharma");
                        return (
                          <Line key={sector} type="monotone" dataKey={shortName} stroke={SECTOR_COLORS[sector]} strokeWidth={1.5} dot={false} />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector Rotation Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(SECTOR_COLORS).map(([sector, color]) => {
                  const lastSnapshot = (sectorRotation as any[])?.[sectorRotation!.length - 1];
                  const sectorData = lastSnapshot?.data?.find((s: any) => s.sector === sector);
                  return (
                    <div key={sector} className="pf-card p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] font-semibold text-foreground truncate">{sector.split(" ")[0]}</span>
                      </div>
                      <div className="text-lg font-bold tabular-nums" style={{ color }}>
                        #{sectorData?.rank ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Current Rank</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Performance Tracking ── */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Performance Tracking</h3>
            <Select value={perfDays} onValueChange={setPerfDays}>
              <SelectTrigger className="h-7 text-xs w-24 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[["7", "7 Days"], ["14", "14 Days"], ["30", "30 Days"], ["60", "60 Days"], ["90", "90 Days"]].map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {perfLoading ? (
            <Skeleton className="h-64 rounded" />
          ) : (
            <>
              <div className="pf-card p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Normalized Returns (%) — Base 0
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={Math.floor(performanceChartData.length / 7)} />
                      <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <RechartsTooltip
                        contentStyle={{ background: "oklch(0.16 0.012 250)", border: "1px solid oklch(0.25 0.012 250)", borderRadius: "6px", fontSize: "10px" }}
                        formatter={(val: any) => [`${fmt(val)}%`]}
                      />
                      <ReferenceLine y={0} stroke="oklch(0.35 0.012 250)" strokeDasharray="4 4" />
                      <Legend wrapperStyle={{ fontSize: "9px" }} />
                      {perfSymbols.map((sym, i) => {
                        const colors = ["var(--color-primary)", "#f59e0b", "#3b82f6", "#10b981", "#a855f7"];
                        return <Line key={sym} type="monotone" dataKey={sym} stroke={colors[i]} strokeWidth={1.5} dot={false} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(performance ?? []).map((series: any, i: number) => {
                  const colors = ["var(--color-primary)", "#f59e0b", "#3b82f6", "#10b981", "#a855f7"];
                  const ret = Number(series.totalReturn ?? 0);
                  return (
                    <div key={series.symbol} className="pf-card p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: colors[i] }} />
                        <span className="text-xs font-semibold text-foreground">{series.symbol}</span>
                      </div>
                      <div className={cn("text-lg font-bold tabular-nums", ret >= 0 ? "text-bull" : "text-bear")}>
                        {fmtPct(ret)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{perfDays}D Return</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Scanner Results History ── */}
        <TabsContent value="scanner" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Historical Scanner Results</h3>
            <Select value={scanType} onValueChange={setScanType}>
              <SelectTrigger className="h-7 text-xs w-48 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "ema_alignment", label: "EMA Alignment" },
                  { value: "volume_spike", label: "Volume Spike" },
                  { value: "breakout_52w", label: "52-Week High Breakout" },
                  { value: "breakout_ath", label: "ATH Breakout" },
                  { value: "momentum_continuation", label: "Momentum Continuation" },
                  { value: "relative_strength", label: "Relative Strength" },
                ].map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {scannerLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !scannerHistory || scannerHistory.length === 0 ? (
            <div className="pf-card p-8 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No scanner results in the last 7 days.</p>
              <p className="text-xs text-muted-foreground mt-1">Results are populated by background jobs. Run the Market Scanner Engine to generate results.</p>
            </div>
          ) : (
            <div className="pf-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Symbol</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Asset</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Score</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Matched At</th>
                  </tr>
                </thead>
                <tbody>
                  {(scannerHistory as any[]).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-foreground font-mono">{row.asset?.symbol ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.asset?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn("font-semibold tabular-nums", Number(row.result?.score ?? 0) >= 70 ? "text-bull" : Number(row.result?.score ?? 0) >= 40 ? "text-primary" : "text-bear")}>
                          {fmt(Number(row.result?.score ?? 0), 1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {row.result?.matchedAt ? new Date(row.result.matchedAt).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
