import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Activity, Bitcoin, BarChart3,
  Globe, ArrowRight, Zap, RefreshCw, AlertCircle, Flag, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetTable } from "@/components/shared/AssetTable";

// ─── Market Domain Card ───────────────────────────────────────────────────────
interface MarketDomainCardProps {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  accentClass: string;
  borderClass: string;
  sentiment?: { sentimentScore?: number; marketState?: string; fearGreedIndex?: number; spxChange?: number };
  topGainers?: Array<{ symbol: string; changePercent: number; price: number; currency?: string }>;
  topLosers?: Array<{ symbol: string; changePercent: number; price: number; currency?: string }>;
  isLoading?: boolean;
  badge?: string;
  badgeClass?: string;
}

function MarketDomainCard({
  title, subtitle, href, icon, accentClass, borderClass,
  sentiment, topGainers, topLosers, isLoading, badge, badgeClass,
}: MarketDomainCardProps) {
  const score = sentiment?.sentimentScore ?? 0;
  const state = sentiment?.marketState ?? "neutral";

  return (
    <div className={cn("pf-card overflow-hidden border-t-2 flex flex-col", borderClass)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accentClass)}>
              {icon}
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{title}</div>
              <div className="text-[10px] text-muted-foreground">{subtitle}</div>
            </div>
          </div>
          {badge && (
            <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", badgeClass)}>
              {badge}
            </span>
          )}
        </div>

        {/* Sentiment bar */}
        {isLoading ? (
          <Skeleton className="h-6 w-full mt-2" />
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">
                {title === "Crypto Market" ? "Fear & Greed" : "Market Sentiment"}
              </span>
              <span className={cn("text-[10px] font-semibold uppercase",
                state === "bullish" ? "text-bull" : state === "bearish" ? "text-bear" : "text-[oklch(0.65_0.12_80)]"
              )}>
                {state}
              </span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500",
                  state === "bullish" ? "bg-bull" : state === "bearish" ? "bg-bear" : "bg-[oklch(0.65_0.12_80)]"
                )}
                style={{ width: `${Math.min(100, Math.max(0, 50 + (score / 2)))}%` }}
              />
            </div>
            {title === "Crypto Market" && sentiment?.fearGreedIndex !== undefined && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Fear & Greed: <span className="text-foreground font-medium">{sentiment.fearGreedIndex.toFixed(0)}/100</span>
              </div>
            )}
            {title === "US Market" && sentiment?.spxChange !== undefined && (
              <div className={cn("text-[10px] mt-1 font-medium", sentiment.spxChange >= 0 ? "text-bull" : "text-bear")}>
                S&P 500: {sentiment.spxChange >= 0 ? "+" : ""}{sentiment.spxChange.toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top movers */}
      <div className="flex-1 p-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 text-bull" /> Top Gainers
          </div>
          {isLoading ? (
            <div className="space-y-1">{[0,1,2].map(i => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : (
            <div className="space-y-1">
              {(topGainers ?? []).slice(0, 3).map(a => (
                <div key={a.symbol} className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-foreground">{a.symbol}</span>
                  <span className="text-[10px] font-semibold text-bull tabular-nums">+{a.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <TrendingDown className="w-2.5 h-2.5 text-bear" /> Top Losers
          </div>
          {isLoading ? (
            <div className="space-y-1">{[0,1,2].map(i => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : (
            <div className="space-y-1">
              {(topLosers ?? []).slice(0, 3).map(a => (
                <div key={a.symbol} className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-foreground">{a.symbol}</span>
                  <span className="text-[10px] font-semibold text-bear tabular-nums">{a.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <Link href={href}>
          <Button variant="outline" size="sm" className="w-full text-xs h-8 group">
            Open {title}
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Quick Nav Tile ───────────────────────────────────────────────────────────
function QuickNavTile({ href, icon, label, description, accentClass }: {
  href: string; icon: React.ReactNode; label: string; description: string; accentClass: string;
}) {
  return (
    <Link href={href}>
      <div className="pf-card-hover p-3 flex items-center gap-3 cursor-pointer group">
        <div className={cn("w-8 h-8 rounded flex items-center justify-center shrink-0", accentClass)}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{description}</div>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

// ─── Home Dashboard ───────────────────────────────────────────────────────────
export default function HomeDashboard() {
  const { data: overview, isLoading, refetch, isFetching } = trpc.global.overview.useQuery(undefined, {
    refetchInterval: 60000,
  });

  return (
    <div className="p-4 md:p-6 space-y-6 animate-[fade-up_0.3s_ease-out]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Global Market Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time intelligence across Indian equities, crypto markets, and US equities
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Market Domain Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MarketDomainCard
          title="Indian Stock Market"
          subtitle="NSE · BSE · Nifty · Sector Rotation"
          href="/india"
          icon={<Flag className="w-4 h-4 text-white" />}
          accentClass="bg-gradient-to-br from-[oklch(0.65_0.20_40)] to-[oklch(0.55_0.22_30)]"
          borderClass="border-t-[oklch(0.65_0.20_40)]"
          sentiment={overview?.india.sentiment}
          topGainers={overview?.india.topGainers}
          topLosers={overview?.india.topLosers}
          isLoading={isLoading}
          badge="NSE Live"
          badgeClass="bg-[oklch(0.65_0.20_40/0.15)] text-[oklch(0.65_0.20_40)]"
        />
        <MarketDomainCard
          title="Crypto Market"
          subtitle="BTC · ETH · Altcoins · DeFi"
          href="/crypto"
          icon={<Bitcoin className="w-4 h-4 text-white" />}
          accentClass="bg-gradient-to-br from-[oklch(0.60_0.22_290)] to-[oklch(0.50_0.24_280)]"
          borderClass="border-t-[oklch(0.60_0.22_290)]"
          sentiment={overview?.crypto.sentiment}
          topGainers={overview?.crypto.topGainers}
          topLosers={overview?.crypto.topLosers}
          isLoading={isLoading}
          badge="24/7 Live"
          badgeClass="bg-[oklch(0.60_0.22_290/0.15)] text-[oklch(0.60_0.22_290)]"
        />
        <MarketDomainCard
          title="US Market"
          subtitle="S&P 500 · NASDAQ · Dow Jones"
          href="/us"
          icon={<DollarSign className="w-4 h-4 text-white" />}
          accentClass="bg-gradient-to-br from-[oklch(0.60_0.20_250)] to-[oklch(0.50_0.22_260)]"
          borderClass="border-t-[oklch(0.60_0.20_250)]"
          sentiment={overview?.us.sentiment}
          topGainers={overview?.us.topGainers}
          topLosers={overview?.us.topLosers}
          isLoading={isLoading}
          badge="Preview"
          badgeClass="bg-primary/10 text-primary"
        />
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Navigation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          <QuickNavTile href="/india" icon={<BarChart3 className="w-4 h-4 text-[oklch(0.65_0.20_40)]" />}
            label="India Dashboard" description="NSE overview & breadth"
            accentClass="bg-[oklch(0.65_0.20_40/0.12)]" />
          <QuickNavTile href="/india/sectors" icon={<Activity className="w-4 h-4 text-[oklch(0.65_0.20_40)]" />}
            label="Sector Rotation" description="NSE sector rankings"
            accentClass="bg-[oklch(0.65_0.20_40/0.12)]" />
          <QuickNavTile href="/india/scanner" icon={<Zap className="w-4 h-4 text-[oklch(0.65_0.20_40)]" />}
            label="NSE Scanner" description="EMA, breakout, volume"
            accentClass="bg-[oklch(0.65_0.20_40/0.12)]" />
          <QuickNavTile href="/crypto" icon={<Bitcoin className="w-4 h-4 text-[oklch(0.60_0.22_290)]" />}
            label="Crypto Dashboard" description="BTC dominance & Fear/Greed"
            accentClass="bg-[oklch(0.60_0.22_290/0.12)]" />
          <QuickNavTile href="/crypto/scanner" icon={<Zap className="w-4 h-4 text-[oklch(0.60_0.22_290)]" />}
            label="Crypto Scanner" description="Volume spikes & breakouts"
            accentClass="bg-[oklch(0.60_0.22_290/0.12)]" />
          <QuickNavTile href="/us" icon={<Globe className="w-4 h-4 text-primary" />}
            label="US Market" description="S&P 500 & NASDAQ"
            accentClass="bg-primary/10" />
        </div>
      </div>

      {/* Global Movers — side by side India and Crypto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Flag className="w-4 h-4 text-[oklch(0.65_0.20_40)]" />
            India Top Gainers
            <span className="text-[10px] text-muted-foreground font-normal">(NSE only)</span>
          </h2>
          {isLoading ? (
            <div className="pf-card p-4 space-y-2">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <AssetTable
              assets={(overview?.india.topGainers ?? []).map(a => ({
                ...a, currency: "INR",
              }))}
              showRank
              compact
            />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bitcoin className="w-4 h-4 text-[oklch(0.60_0.22_290)]" />
            Crypto Top Gainers
            <span className="text-[10px] text-muted-foreground font-normal">(Crypto only)</span>
          </h2>
          {isLoading ? (
            <div className="pf-card p-4 space-y-2">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <AssetTable
              assets={(overview?.crypto.topGainers ?? []).map(a => ({
                ...a, currency: "USD",
              }))}
              showRank
              compact
            />
          )}
        </div>
      </div>

      {/* Market Alerts Banner */}
      <div className="pf-card p-4 flex items-center gap-3 border-l-2 border-l-primary">
        <AlertCircle className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground">Data is rule-based simulation</div>
          <div className="text-[10px] text-muted-foreground">
            All prices, sector scores, and indicators are generated using deterministic market logic for demonstration purposes.
          </div>
        </div>
        <Link href="/alerts">
          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
            View Alerts
          </Button>
        </Link>
      </div>
    </div>
  );
}
