import { cn } from "@/lib/utils";

interface HeatmapItem {
  sector: string;
  change: number;
  score?: number;
  inflowOutflow?: number;
}

interface SectorHeatmapProps {
  data: HeatmapItem[];
  onSelect?: (sector: string) => void;
  selected?: string;
  className?: string;
}

function getHeatColor(change: number): string {
  if (change > 3) return "bg-[oklch(0.68_0.18_155/0.5)] text-[oklch(0.90_0.10_155)]";
  if (change > 1.5) return "bg-[oklch(0.68_0.18_155/0.3)] text-[oklch(0.85_0.12_155)]";
  if (change > 0.5) return "bg-[oklch(0.68_0.18_155/0.15)] text-[oklch(0.80_0.10_155)]";
  if (change > -0.5) return "bg-[oklch(0.60_0.04_250/0.15)] text-[oklch(0.65_0.12_80)]";
  if (change > -1.5) return "bg-[oklch(0.58_0.22_25/0.15)] text-[oklch(0.80_0.10_25)]";
  if (change > -3) return "bg-[oklch(0.58_0.22_25/0.3)] text-[oklch(0.85_0.12_25)]";
  return "bg-[oklch(0.58_0.22_25/0.5)] text-[oklch(0.90_0.10_25)]";
}

function getSectorShortName(sector: string): string {
  const map: Record<string, string> = {
    "Information Technology": "IT",
    "Banking & Finance": "Banking",
    "Energy & Oil": "Energy",
    "Healthcare & Pharma": "Pharma",
    "Consumer Goods": "Consumer",
    "Metals & Mining": "Metals",
    "Automobile": "Auto",
    "Real Estate": "Realty",
    "Telecom": "Telecom",
    "FMCG": "FMCG",
    "Infrastructure": "Infra",
    "US Technology": "Tech",
    "US Financials": "Financials",
    "US Healthcare": "Healthcare",
    "US Energy": "Energy",
    "US Consumer Discretionary": "Consumer",
    "US Industrials": "Industrials",
  };
  return map[sector] ?? sector.split(" ")[0];
}

export function SectorHeatmap({ data, onSelect, selected, className }: SectorHeatmapProps) {
  return (
    <div className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}
    >
      {data.map((item) => (
        <div
          key={item.sector}
          onClick={() => onSelect?.(item.sector)}
          className={cn(
            "heatmap-cell p-2 min-h-[64px] select-none",
            getHeatColor(item.change),
            selected === item.sector && "ring-2 ring-primary scale-105",
            onSelect && "cursor-pointer"
          )}
        >
          <div className="text-[10px] font-semibold leading-tight text-center">{getSectorShortName(item.sector)}</div>
          <div className="text-[11px] font-bold tabular-nums text-center mt-1">
            {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
          </div>
          {item.inflowOutflow !== undefined && (
            <div className="text-[9px] text-center mt-0.5 opacity-70">
              {item.inflowOutflow >= 0 ? "↑" : "↓"} {Math.abs(item.inflowOutflow / 1000).toFixed(1)}B
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
