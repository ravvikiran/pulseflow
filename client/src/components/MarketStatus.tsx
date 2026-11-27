import { cn } from "@/lib/utils";
import { MARKET_LABEL, SESSION_TEXT, useMarketStatus, type MarketKey, type SessionState } from "@/hooks/useMarketStatus";

const ORDER: MarketKey[] = ["india", "us", "crypto"];

function dotClass(state: SessionState | null) {
  if (state === "open") return "bg-bull pulse-live";
  if (state === "pre" || state === "post") return "bg-warning";
  if (state === "closed") return "bg-muted-foreground/60";
  return "border border-muted-foreground/50";
}

function lastTradeTitle(market: string, text: string, lastTradeAt: string | null) {
  if (!lastTradeAt) return `${market}: ${text}`;
  const when = new Date(lastTradeAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${market}: ${text}. Last trade ${when}`;
}

/** One market's real state: coloured dot plus a text label (colour is never the only signal). */
export function MarketStatusPill({ market, className }: { market: MarketKey; className?: string }) {
  const { status, isLoading } = useMarketStatus();
  const session = status?.[market] ?? null;
  const text = session ? SESSION_TEXT[session.state] : isLoading ? "Checking" : "Unavailable";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider", className)}
      title={lastTradeTitle(MARKET_LABEL[market], text, session?.lastTradeAt ?? null)}
    >
      <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass(session?.state ?? null))} />
      {MARKET_LABEL[market]} {text}
    </span>
  );
}

/**
 * Open/closed state for all three markets.
 *  - "bar": compact chips for the top bar
 *  - "list": stacked rows for the navigation drawer
 */
export function MarketStatus({ variant = "bar", className }: { variant?: "bar" | "list"; className?: string }) {
  const { status, isLoading } = useMarketStatus();

  return (
    <div
      role="group"
      aria-label="Market status"
      className={cn(variant === "bar" ? "flex items-center gap-3" : "flex flex-col gap-1.5", className)}
    >
      {ORDER.map(market => {
        const session = status?.[market] ?? null;
        const text = session ? SESSION_TEXT[session.state] : isLoading ? "Checking" : "Unavailable";
        return (
          <span
            key={market}
            title={lastTradeTitle(MARKET_LABEL[market], text, session?.lastTradeAt ?? null)}
            className={cn(
              "inline-flex items-center gap-1.5 text-2xs font-medium tracking-wide",
              session?.state === "open" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass(session?.state ?? null))} />
            <span className="uppercase">{MARKET_LABEL[market]}</span>
            <span className="text-muted-foreground">{text}</span>
          </span>
        );
      })}
    </div>
  );
}
