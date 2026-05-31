import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
  suffix?: string;
  mono?: boolean;
}

export function StatCard({ label, value, change, changeLabel, icon, accent, className, suffix, mono = true }: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={cn("pf-card p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && (
          <div className={cn("w-7 h-7 rounded flex items-center justify-center", accent ?? "bg-primary/10")}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("stat-value", mono && "font-mono tabular-nums")}>
          {value}{suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
        </span>
      </div>
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs font-medium tabular-nums",
          isPositive ? "text-bull" : isNegative ? "text-bear" : "text-muted-foreground"
        )}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          <span>{isPositive ? "+" : ""}{change.toFixed(2)}%</span>
          {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}

interface MarketBadgeProps {
  state: "bullish" | "bearish" | "neutral";
  className?: string;
}

export function MarketBadge({ state, className }: MarketBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
      state === "bullish" ? "badge-bull" : state === "bearish" ? "badge-bear" : "badge-neutral",
      className
    )}>
      {state === "bullish" ? "▲" : state === "bearish" ? "▼" : "●"} {state}
    </span>
  );
}
