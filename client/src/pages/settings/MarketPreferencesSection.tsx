import React from "react";
import { TrendingUp } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, SelectField, NumberInput, Toggle } from "./SettingsSection";
import { cn } from "@/lib/utils";

interface MarketPrefsSectionProps {
  prefs: {
    preferredModules: string[];
    preferredTimeframe: string;
    scannerRefreshInterval: number;
    heatmapRefreshInterval: number;
    defaultChartInterval: string;
  };
  onUpdate: (updates: Partial<MarketPrefsSectionProps["prefs"]>) => void;
  isSaving: boolean;
}

const TIMEFRAME_OPTIONS = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
  { value: "1M", label: "Monthly" },
];

const CHART_INTERVAL_OPTIONS = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "30m", label: "30 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
];

const MODULES = [
  { id: "india", label: "India Market", desc: "NSE stocks, sectors, FII/DII", accent: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40" },
  { id: "crypto", label: "Crypto Market", desc: "BTC, altcoins, DeFi", accent: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" },
  { id: "us", label: "US Market", desc: "S&P 500, NASDAQ, DOW", accent: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/40" },
];

export function MarketPreferencesSection({ prefs, onUpdate, isSaving }: MarketPrefsSectionProps) {
  const toggleModule = (moduleId: string) => {
    const current = prefs.preferredModules ?? [];
    const updated = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId];
    onUpdate({ preferredModules: updated });
  };

  return (
    <SettingsSection
      title="Market Preferences"
      description="Configure your default market modules, timeframes, and data refresh intervals."
      icon={TrendingUp}
      accentClass="text-emerald-400"
      bgClass="bg-emerald-500/10"
    >
      {/* Preferred Modules */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preferred Market Modules</p>
        <div className="grid grid-cols-3 gap-3">
          {MODULES.map((mod) => {
            const isEnabled = (prefs.preferredModules ?? []).includes(mod.id);
            return (
              <button
                key={mod.id}
                disabled={isSaving}
                onClick={() => toggleModule(mod.id)}
                className={cn(
                  "flex flex-col gap-2 p-4 rounded-xl border transition-all duration-150 text-left",
                  isEnabled
                    ? `${mod.border} ${mod.bg} shadow-sm`
                    : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isEnabled ? mod.bg : "bg-muted/50")}>
                    <div className={cn("w-2.5 h-2.5 rounded-full", isEnabled ? mod.accent.replace("text-", "bg-") : "bg-muted-foreground/40")} />
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                    isEnabled ? `border-current ${mod.accent}` : "border-border/60"
                  )}>
                    {isEnabled && <div className={cn("w-2 h-2 rounded-sm", mod.accent.replace("text-", "bg-"))} />}
                  </div>
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isEnabled ? "text-foreground" : "text-muted-foreground")}>{mod.label}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{mod.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeframe & Chart Settings */}
      <div className="mt-6 space-y-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Default Timeframes</p>
        <SettingsCard>
          <SettingsRow label="Preferred Timeframe" description="Default timeframe for scanner and analysis">
            <SelectField
              value={prefs.preferredTimeframe}
              onChange={(v) => onUpdate({ preferredTimeframe: v })}
              options={TIMEFRAME_OPTIONS}
              disabled={isSaving}
            />
          </SettingsRow>
          <SettingsRow label="Default Chart Interval" description="Default interval for candlestick charts">
            <SelectField
              value={prefs.defaultChartInterval}
              onChange={(v) => onUpdate({ defaultChartInterval: v })}
              options={CHART_INTERVAL_OPTIONS}
              disabled={isSaving}
            />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Refresh Intervals */}
      <div className="mt-6 space-y-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Refresh Intervals</p>
        <SettingsCard>
          <SettingsRow label="Scanner Refresh" description="How often the scanner auto-refreshes results">
            <NumberInput
              value={prefs.scannerRefreshInterval}
              onChange={(v) => onUpdate({ scannerRefreshInterval: v })}
              min={10}
              max={3600}
              step={10}
              suffix="seconds"
              disabled={isSaving}
            />
          </SettingsRow>
          <SettingsRow label="Heatmap Refresh" description="How often sector and crypto heatmaps refresh">
            <NumberInput
              value={prefs.heatmapRefreshInterval}
              onChange={(v) => onUpdate({ heatmapRefreshInterval: v })}
              min={10}
              max={3600}
              step={5}
              suffix="seconds"
              disabled={isSaving}
            />
          </SettingsRow>
        </SettingsCard>
        <p className="text-xs text-muted-foreground/60 mt-2 px-1">
          Lower values provide more up-to-date data but may increase server load. Minimum: 10 seconds.
        </p>
      </div>
    </SettingsSection>
  );
}
