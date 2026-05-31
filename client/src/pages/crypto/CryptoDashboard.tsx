import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Zap, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, Bitcoin,
  DollarSign, Globe, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
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
function fmtLarge(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${fmt(v)}`;
}

// ─── Fear & Greed Gauge ───────────────────────────────────────────────────────
function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  const color = value < 25 ? "var(--color-bear)" : value < 45 ? "oklch(0.75 0.15 40)" : value < 55 ? "var(--color-neutral)" : value < 75 ? "oklch(0.75 0.15 120)" : "var(--color-bull)";
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative w-36 h-20 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke="oklch(0.22 0.012 250)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${normalized * 1.57} 157`} style={{ transition: "stroke-dasharray 1s ease-in-out" }} />
          <line x1="60" y1="55"
            x2={60 + 40 * Math.cos(Math.PI * (1 - normalized / 100))}
            y2={55 - 40 * Math.sin(Math.PI * (1 - normalized / 100))}
            stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="60" cy="55" r="3" fill={color} />
        </svg>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{Math.round(value)}</div>
      <Badge className="text-xs font-semibold px-3" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
        {label}
      </Badge>
    </div>
  );
}

// ─── BTC Dominance Ring ───────────────────────────────────────────────────────
function DominanceRing({ btc, eth }: { btc: number; eth: number }) {
  const alt = 100 - btc - eth;
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const btcDash = (btc / 100) * circ;
  const ethDash = (eth / 100) * circ;
  const altDash = (alt / 100) * circ;
  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="oklch(0.22 0.012 250)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-bull)" strokeWidth="3"
          strokeDasharray={`${btcDash} ${circ - btcDash}`} strokeDashoffset="0" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-primary)" strokeWidth="3"
          strokeDasharray={`${ethDash} ${circ - ethDash}`} strokeDashoffset={-btcDash} />
        <circle cx="18" cy="18" r={r} fill="none" stroke="oklch(0.55 0.12 280)" strokeWidth="3"
          strokeDasharray={`${altDash} ${circ - altDash}`} strokeDashoffset={-(btcDash + ethDash)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Bitcoin className="w-4 h-4 text-bull" />
        <span className="text-xs font-bold text-bull tabular-nums">{fmt(btc, 1)}%</span>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, accent }: {
  label: string; value: string; sub?: string; icon?: React.ElementType;
  trend?: "up" | "down" | "neutral"; accent?: string;
}) {
  return (
    <div className="pf-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
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

// ─── Crypto Heatmap Cell ──────────────────────────────────────────────────────
function CryptoHeatCell({ symbol, name, change, price }: { symbol: string; name: string; change: number; price: number }) {
  const intensity = Math.min(1, Math.abs(change) / 8);
  const bg = change >= 0
    ? `oklch(${0.35 + intensity * 0.2} ${0.12 + intensity * 0.08} 155 / ${0.3 + intensity * 0.5})`
    : `oklch(${0.35 + intensity * 0.2} ${0.12 + intensity * 0.08} 25 / ${0.3 + intensity * 0.5})`;
  return (
    <Link href={`/assets/${symbol}`}>
      <div className="heatmap-cell p-2 min-h-[72px] cursor-pointer"
        style={{ background: bg, border: `1px solid ${change >= 0 ? "oklch(0.68 0.18 155 / 0.2)" : "oklch(0.58 0.22 25 / 0.2)"}` }}>
        <div className="text-[10px] font-bold text-foreground/80 uppercase">{symbol}</div>
        <div className={cn("text-sm font-bold tabular-nums mt-0.5", change >= 0 ? "text-bull" : "text-bear")}>
          {fmtPct(change)}
        </div>
        <div className="text-[9px] text-muted-foreground truncate">{name.split(" ")[0]}</div>
      </div>
    </Link>
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
            {symbol.slice(0, 3)}
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
          <span className="text-foreground font-medium">{p.name}: {fmt(p.value, 1)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Crypto Dashboard ─────────────────────────────────────────────────────────
export default function CryptoDashboard() {
  const [tab, setTab] = useState<"gainers" | "losers" | "altcoin">("gainers");

  const { data, isLoading, refetch } = trpc.crypto.dashboard.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: heatmapData, isLoading: heatLoading } = trpc.crypto.heatmap.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: fearGreedHistory } = trpc.crypto.fearGreedHistory.useQuery({ days: 30 });
  const { data: btcDomHistory } = trpc.crypto.btcDominanceHistory.useQuery({ days: 30 });

  const fearGreedChartData = useMemo(() => {
    if (!fearGreedHistory) return [];
    return (fearGreedHistory as any[]).slice(-30).map((d: any) => ({
      date: new Date(d.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
      value: Math.round(Number(d.value)),
    }));
  }, [fearGreedHistory]);

  const btcDomChartData = useMemo(() => {
    if (!btcDomHistory) return [];
    return (btcDomHistory as any[]).slice(-30).map((d: any) => ({
      date: new Date(d.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
      btc: Math.round(Number(d.btcDominance) * 10) / 10,
      eth: Math.round(Number(d.ethDominance) * 10) / 10,
      alt: Math.round(Number(d.altcoinDominance) * 10) / 10,
    }));
  }, [btcDomHistory]);

  const displayList = tab === "gainers" ? (data?.topGainers ?? [])
    : tab === "losers" ? (data?.topLosers ?? [])
    : (data?.altcoinMomentum ?? []);

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-[fade-up_0.3s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-bull pulse-live" />
            <span className="text-[10px] uppercase tracking-widest text-bull font-semibold">Crypto Market</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Crypto Market Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bitcoin, Altcoins, DeFi — Crypto assets only · {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/crypto/scanner">
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Crypto Scanner
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Top Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="BTC Dominance" value={`${fmt(data?.btcDominance, 1)}%`}
            sub="Bitcoin market share" icon={Percent} trend="neutral" accent="var(--color-bull)" />
          <StatCard label="Total Market Cap" value={fmtLarge(data?.totalMarketCap)}
            sub="All crypto assets" icon={Globe} trend="neutral" />
          <StatCard label="24h Volume" value={fmtLarge(data?.totalVolume24h)}
            sub="Across all exchanges" icon={Activity} trend="neutral" />
          <StatCard label="Fear & Greed Index" value={`${Math.round(Number(data?.fearGreedIndex ?? 50))}`}
            sub={data?.fearGreedLabel ?? "Neutral"} icon={Zap}
            trend={Number(data?.fearGreedIndex ?? 50) > 70 ? "down" : Number(data?.fearGreedIndex ?? 50) < 30 ? "up" : "neutral"} />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fear & Greed Gauge */}
        <div className="pf-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Fear & Greed Index</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-bull pulse-live" />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Skeleton className="w-36 h-24 rounded" /></div>
          ) : (
            <FearGreedGauge value={Number(data?.fearGreedIndex ?? 50)} label={data?.fearGreedLabel ?? "Neutral"} />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded bg-bull/10 py-1.5">
              <div className="text-[10px] text-muted-foreground">BTC Price</div>
              <div className="text-sm font-bold text-bull tabular-nums">${fmt(data?.btcPrice?.price)}</div>
            </div>
            <div className="rounded bg-primary/10 py-1.5">
              <div className="text-[10px] text-muted-foreground">ETH Price</div>
              <div className="text-sm font-bold text-primary tabular-nums">${fmt(data?.ethPrice?.price)}</div>
            </div>
          </div>
        </div>

        {/* BTC Dominance */}
        <div className="pf-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">BTC Dominance</h3>
          {isLoading ? (
            <Skeleton className="w-28 h-28 rounded-full mx-auto" />
          ) : (
            <DominanceRing btc={Number(data?.btcDominance ?? 44)} eth={18} />
          )}
          <div className="mt-4 space-y-2">
            {[
              { label: "Bitcoin (BTC)", pct: data?.btcDominance ?? 44, color: "var(--color-bull)" },
              { label: "Ethereum (ETH)", pct: 18, color: "var(--color-primary)" },
              { label: "Altcoins", pct: 100 - Number(data?.btcDominance ?? 44) - 18, color: "oklch(0.55 0.12 280)" },
            ].map(({ label, pct, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
                <span className="font-semibold tabular-nums" style={{ color }}>{fmt(pct, 1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exchange Activity */}
        <div className="pf-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Exchange Activity</h3>
          <div className="space-y-2">
            {(data?.exchangeActivity ?? []).map((ex: any) => (
              <div key={ex.exchange} className="flex items-center gap-2">
                <div className="w-16 text-xs font-medium text-foreground truncate">{ex.exchange}</div>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${ex.dominance * 3}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums w-14 text-right">{fmtLarge(ex.volume24h)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-[10px] text-muted-foreground">Total 24h Exchange Volume</div>
            <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">{fmtLarge(data?.totalVolume24h)}</div>
          </div>
        </div>
      </div>

      {/* Crypto Heatmap */}
      <div className="pf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Crypto Heatmap</h3>
          <Badge variant="outline" className="text-[10px]">Crypto assets only</Badge>
        </div>
        {heatLoading ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
            {[...Array(16)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded" />)}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
            {(heatmapData ?? []).map((cell: any) => (
              <CryptoHeatCell key={cell.symbol} symbol={cell.symbol} name={cell.name}
                change={Number(cell.change)} price={Number(cell.price)} />
            ))}
          </div>
        )}
      </div>

      {/* Gainers / Losers / Altcoin Momentum */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Movers */}
        <div className="pf-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Crypto Movers</h3>
            <div className="flex gap-1">
              {(["gainers", "losers", "altcoin"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-2.5 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                    tab === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {t === "altcoin" ? "Altcoin RS" : t === "gainers" ? "Top Gainers" : "Top Losers"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-0.5">
            {isLoading ? [...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />) : (
              displayList.slice(0, 8).map((asset: any) => (
                <MoverRow key={asset.symbol} symbol={asset.symbol} name={asset.name}
                  price={Number(asset.price)} changePercent={Number(asset.changePercent)}
                  isGainer={tab === "gainers" || (tab === "altcoin" && Number(asset.relativeStrengthVsBTC ?? 0) >= 0)} />
              ))
            )}
          </div>
        </div>

        {/* Fear & Greed History */}
        <div className="pf-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Fear & Greed — 30 Day History</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fearGreedChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 250)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} interval={6} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" name="Fear & Greed" stroke="var(--color-primary)" fill="url(#fgGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BTC Dominance History */}
      <div className="pf-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">BTC Dominance — 30 Day History</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={btcDomChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-bull)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-bull)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 250)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} interval={6} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "oklch(0.55 0.02 250)" }} tickLine={false} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="btc" name="BTC" stroke="var(--color-bull)" fill="url(#btcGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="eth" name="ETH" stroke="var(--color-primary)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="alt" name="Alts" stroke="oklch(0.55 0.12 280)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
