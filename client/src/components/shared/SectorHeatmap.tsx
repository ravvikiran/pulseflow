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
  /** Unit of `inflowOutflow`: INR crore (India, default) or USD million (US). */
  flowUnit?: "cr" | "musd";
}

function formatFlow(value: number, unit: "cr" | "musd"): string {
  const amount = Math.abs(value).toLocaleString(unit === "cr" ? "en-IN" : "en-US", { maximumFractionDigits: 0 });
  return unit === "cr" ? `₹${amount} Cr` : `$${amount}M`;
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
    "Oil & Gas": "Oil & Gas",
    "Healthcare & Pharma": "Pharma",
    "Consumer Goods": "Consumer",
    "Metals & Mining": "Metals",
    "Automobile": "Auto",
    "Automobiles": "Auto",
    "Consumer Discretionary": "Discretionary",
    "Consumer Staples": "Staples",
    "Communication Services": "Comm.",
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

export function SectorHeatmap({ data, onSelect, selected, className, flowUnit = "cr" }: SectorHeatmapProps) {
  return (
    <div className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}
    >
      {data.map((item) => {
        const sign = item.change >= 0 ? "+" : "";
        const classes = cn(
          "heatmap-cell p-2 min-h-[64px] select-none w-full",
          getHeatColor(item.change),
          selected === item.sector && "ring-2 ring-primary scale-105",
          onSelect && "cursor-pointer focus-ring"
        );
        const content = (
          <>
            <div className="text-2xs font-semibold leading-tight text-center">
              {getSectorShortName(item.sector)}
              {getSectorShortName(item.sector) !== item.sector && <span className="sr-only"> ({item.sector})</span>}
            </div>
            <div className="text-xs font-bold tabular-nums text-center mt-1">
              {sign}{item.change.toFixed(2)}%
            </div>
            {item.inflowOutflow !== undefined && (
              <div className="text-3xs text-center mt-0.5">
                {item.inflowOutflow >= 0 ? "↑" : "↓"} {formatFlow(item.inflowOutflow, flowUnit)}
              </div>
            )}
          </>
        );
        // Selectable cells are real buttons so keyboard and screen-reader users can use them.
        return onSelect ? (
          <button
            key={item.sector}
            type="button"
            title={item.sector}
            aria-pressed={selected === item.sector}
            onClick={() => onSelect(item.sector)}
            className={classes}
          >
            {content}
          </button>
        ) : (
          <div key={item.sector} title={item.sector} className={classes}>
            {content}
          </div>
        );
      })}
    </div>
  );
}