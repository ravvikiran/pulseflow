import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerItem {
  symbol: string;
  price: number;
  changePercent: number;
  currency?: string;
}

function TickerItemDisplay({ item }: { item: TickerItem }) {
  const isPositive = item.changePercent >= 0;

  return (
    <div className="flex items-center gap-2 px-4 py-1 whitespace-nowrap">
      <span className="text-[11px] font-semibold text-foreground">{item.symbol}</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {item.currency === "INR" ? "₹" : "$"}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={cn(
        "text-[10px] font-medium tabular-nums flex items-center gap-0.5",
        isPositive ? "text-bull" : "text-bear"
      )}>
        {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        {isPositive ? "+" : ""}{item.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketTicker() {
  const { data: overview } = trpc.global.overview.useQuery(undefined, {
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (!overview) return null;

  // Combine top movers from all markets
  const tickerItems: TickerItem[] = [
    ...(overview.india.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "INR" })),
    ...(overview.india.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "INR" })),
    ...(overview.crypto.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "USD" })),
    ...(overview.crypto.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "USD" })),
    ...(overview.us.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "USD" })),
    ...(overview.us.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "USD" })),
  ];

  if (tickerItems.length === 0) return null;

  // Double the items for seamless loop
  const doubledItems = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full overflow-hidden border-b border-border bg-card/30 backdrop-blur-sm">
      <motion.div
        className="flex"
        animate={{
          x: [0, -(tickerItems.length * 160)],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: tickerItems.length * 4,
            ease: "linear",
          },
        }}
      >
        {doubledItems.map((item, idx) => (
          <TickerItemDisplay key={`${item.symbol}-${idx}`} item={item} />
        ))}
      </motion.div>
    </div>
  );
}
