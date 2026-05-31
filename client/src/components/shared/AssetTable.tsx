import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export interface AssetRow {
  symbol: string;
  name?: string;
  price?: number;
  changePercent?: number;
  change?: number;
  volume?: number;
  sector?: string;
  exchange?: string;
  currency?: string;
  score?: number;
  extra?: Record<string, string | number>;
}

interface AssetTableProps {
  assets: AssetRow[];
  title?: string;
  showRank?: boolean;
  showSector?: boolean;
  showScore?: boolean;
  showVolume?: boolean;
  linkPrefix?: string;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
}

function formatPrice(price: number, currency?: string): string {
  if (currency === "INR") return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  if (currency === "USD") return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toString();
}

export function AssetTable({
  assets, title, showRank = false, showSector = false, showScore = false,
  showVolume = false, linkPrefix = "/assets", emptyMessage = "No assets found",
  compact = false, className
}: AssetTableProps) {
  if (assets.length === 0) {
    return (
      <div className={cn("pf-card p-6 text-center text-muted-foreground text-sm", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("pf-card overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full pf-table">
          <thead>
            <tr className="border-b border-border">
              {showRank && <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>}
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Symbol</th>
              {showSector && <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Sector</th>}
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
              {showVolume && <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Volume</th>}
              {showScore && <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score</th>}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, idx) => {
              const isPositive = (asset.changePercent ?? 0) >= 0;
              return (
                <tr key={asset.symbol} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  {showRank && (
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{idx + 1}</td>
                  )}
                  <td className={cn("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <Link href={`${linkPrefix}/${asset.symbol}`}>
                      <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-primary">{asset.symbol.slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{asset.symbol}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {asset.name && !compact && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{asset.name}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </td>
                  {showSector && (
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px] block">{asset.sector ?? "—"}</span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <span className="text-xs font-mono tabular-nums text-foreground">
                      {asset.price != null ? formatPrice(asset.price, asset.currency) : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className={cn("flex items-center justify-end gap-0.5 text-xs font-medium tabular-nums",
                      isPositive ? "text-bull" : "text-bear"
                    )}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{isPositive ? "+" : ""}{(asset.changePercent ?? 0).toFixed(2)}%</span>
                    </div>
                  </td>
                  {showVolume && (
                    <td className="px-3 py-2 text-right hidden lg:table-cell">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{asset.volume != null ? formatVolume(asset.volume) : "—"}</span>
                    </td>
                  )}
                  {showScore && (
                    <td className="px-3 py-2 text-right">
                      {asset.score != null ? (
                        <span className={cn("score-badge text-[10px]",
                          asset.score >= 70 ? "bg-bull/15 text-bull" : asset.score >= 40 ? "bg-neutral/15 text-neutral" : "bg-bear/15 text-bear"
                        )}>{asset.score}</span>
                      ) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
