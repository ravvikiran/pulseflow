import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useRef } from "react";

interface TickerItem {
  symbol: string;
  price: number;
  changePercent: number;
  currency?: string;
}

function TickerItemDisplay({ item }: { item: TickerItem }) {
  const isPositive = item.changePercent >= 0;

  return (
    <div className="flex items-center gap-2 px-4 whitespace-nowrap">
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

/**
 * Determines the market context based on current route
 */
function useMarketContext(): "india" | "crypto" | "us" | "all" {
  const [location] = useLocation();
  if (location.startsWith("/india")) return "india";
  if (location.startsWith("/crypto")) return "crypto";
  if (location.startsWith("/us")) return "us";
  return "all";
}

export function MarketTicker() {
  const marketContext = useMarketContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  const { data: overview } = trpc.global.overview.useQuery(undefined, {
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Build ticker items based on current market context
  const tickerItems: TickerItem[] = (() => {
    if (!overview) return [];

    switch (marketContext) {
      case "india":
        return [
          ...(overview.india.topGainers ?? []).map(a => ({ ...a, currency: "INR" })),
          ...(overview.india.topLosers ?? []).map(a => ({ ...a, currency: "INR" })),
        ];
      case "crypto":
        return [
          ...(overview.crypto.topGainers ?? []).map(a => ({ ...a, currency: "USD" })),
          ...(overview.crypto.topLosers ?? []).map(a => ({ ...a, currency: "USD" })),
        ];
      case "us":
        return [
          ...(overview.us.topGainers ?? []).map(a => ({ ...a, currency: "USD" })),
          ...(overview.us.topLosers ?? []).map(a => ({ ...a, currency: "USD" })),
        ];
      default:
        // Home/all — show a mix
        return [
          ...(overview.india.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "INR" })),
          ...(overview.india.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "INR" })),
          ...(overview.crypto.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "USD" })),
          ...(overview.crypto.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "USD" })),
          ...(overview.us.topGainers ?? []).slice(0, 2).map(a => ({ ...a, currency: "USD" })),
          ...(overview.us.topLosers ?? []).slice(0, 1).map(a => ({ ...a, currency: "USD" })),
        ];
    }
  })();

  // CSS-based scrolling animation using requestAnimationFrame for smooth performance
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tickerItems.length === 0) return;

    let pos = 0;
    const speed = 0.5; // pixels per frame

    const animate = () => {
      pos += speed;
      const halfWidth = el.scrollWidth / 2;
      if (pos >= halfWidth) pos = 0;
      el.style.transform = `translateX(-${pos}px)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [tickerItems.length]);

  if (!overview || tickerItems.length === 0) return null;

  // Double the items for seamless loop
  const doubledItems = [...tickerItems, ...tickerItems];

  // Label for current market context
  const contextLabel = marketContext === "india" ? "NSE"
    : marketContext === "crypto" ? "CRYPTO"
    : marketContext === "us" ? "US"
    : "GLOBAL";

  return (
    <div className="w-full border-b border-border bg-card/50 h-7 flex items-center shrink-0 relative z-0" style={{ overflow: "clip" }}>
      {/* Market context badge */}
      <div className="flex items-center gap-1.5 px-3 border-r border-border h-full shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-bull pulse-live" />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{contextLabel}</span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 h-full flex items-center" style={{ overflow: "clip" }}>
        <div ref={scrollRef} className="flex items-center whitespace-nowrap">
          {doubledItems.map((item, idx) => (
            <TickerItemDisplay key={`${item.symbol}-${idx}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
