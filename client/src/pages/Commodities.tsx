import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Gem, Flame, CircleDot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function fmt(n: number | undefined | null, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const CATEGORY_ICONS: Record<string, any> = {
  PRECIOUS_METAL: Gem,
  ENERGY: Flame,
  BASE_METAL: CircleDot,
};

const CATEGORY_COLORS: Record<string, string> = {
  PRECIOUS_METAL: "text-amber-400",
  ENERGY: "text-orange-400",
  BASE_METAL: "text-slate-400",
};

export default function Commodities() {
  const { data: commodities, isLoading, refetch, isFetching } = trpc.commodities.list.useQuery(undefined, {
    refetchInterval: 60000,
  });

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-400" />
            Commodities
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gold · Silver · Crude Oil · Natural Gas · Copper</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="pf-card p-4 h-28 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {commodities?.map((item: any) => {
            const Icon = CATEGORY_ICONS[item.category] ?? CircleDot;
            const color = CATEGORY_COLORS[item.category] ?? "text-muted-foreground";
            const isPositive = (item.changePercent ?? 0) >= 0;

            return (
              <Link key={item.symbol} href={`/assets/${item.symbol}`}>
                <div className="pf-card p-4 hover:border-primary/30 transition-all cursor-pointer space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-5 h-5", color)} />
                      <div>
                        <div className="text-sm font-bold text-foreground">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.sector} · per {item.unit}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-lg font-bold tabular-nums text-foreground">${fmt(item.price)}</div>
                    <div className={cn("text-sm font-semibold tabular-nums", isPositive ? "text-bull" : "text-bear")}>
                      {isPositive ? "+" : ""}{fmt(item.changePercent)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>H: ${fmt(item.high)}</span>
                    <span>L: ${fmt(item.low)}</span>
                    <span>O: ${fmt(item.open)}</span>
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
