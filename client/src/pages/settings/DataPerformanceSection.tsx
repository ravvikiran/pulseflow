import React from "react";
import { Database, Zap, RefreshCw, Clock, HardDrive, Activity } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, Toggle, NumberInput, SelectField } from "./SettingsSection";
import { cn } from "@/lib/utils";

interface DataPerfSectionProps {
  prefs: {
    autoRefresh: boolean;
    realTimeUpdates: boolean;
    performanceMode: boolean;
    dataRetentionDays: number;
  };
  onUpdate: (updates: Partial<DataPerfSectionProps["prefs"]>) => void;
  isSaving: boolean;
}

const RETENTION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days (Recommended)" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
];

export function DataPerformanceSection({ prefs, onUpdate, isSaving }: DataPerfSectionProps) {
  return (
    <SettingsSection
      title="Data & Performance"
      description="Control data refresh behavior, caching, and performance optimization settings."
      icon={Database}
      accentClass="text-violet-400"
      bgClass="bg-violet-500/10"
    >
      {/* Live Data Controls */}
      <div className="space-y-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Data Controls</p>
        <SettingsCard>
          <SettingsRow
            label="Auto Refresh"
            description="Automatically refresh market data at the configured intervals"
          >
            <Toggle
              checked={prefs.autoRefresh}
              onChange={(v) => onUpdate({ autoRefresh: v })}
              disabled={isSaving}
              accentClass="bg-violet-500"
            />
          </SettingsRow>
          <SettingsRow
            label="Real-Time Updates"
            description="Enable real-time price and indicator updates (higher bandwidth usage)"
          >
            <Toggle
              checked={prefs.realTimeUpdates}
              onChange={(v) => onUpdate({ realTimeUpdates: v })}
              disabled={isSaving || !prefs.autoRefresh}
              accentClass="bg-violet-500"
            />
          </SettingsRow>
        </SettingsCard>
        {!prefs.autoRefresh && (
          <p className="text-xs text-amber-400/80 mt-2 px-1 flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            Auto refresh is disabled. Data will only update when you manually refresh.
          </p>
        )}
      </div>

      {/* Performance */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance</p>
        <SettingsCard>
          <SettingsRow
            label="Performance Mode"
            description="Reduce animations and visual effects for faster rendering on slower devices"
          >
            <Toggle
              checked={prefs.performanceMode}
              onChange={(v) => onUpdate({ performanceMode: v })}
              disabled={isSaving}
              accentClass="bg-violet-500"
            />
          </SettingsRow>
        </SettingsCard>
        {prefs.performanceMode && (
          <p className="text-xs text-violet-400/80 mt-2 px-1 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Performance mode is active. Animations and transitions are minimized.
          </p>
        )}
      </div>

      {/* Data Retention */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Data Retention</p>
        <SettingsCard>
          <SettingsRow
            label="Historical Data Retention"
            description="How long to retain historical scanner results and sentiment snapshots"
          >
            <SelectField
              value={String(prefs.dataRetentionDays)}
              onChange={(v) => onUpdate({ dataRetentionDays: Number(v) })}
              options={RETENTION_OPTIONS}
              disabled={isSaving}
            />
          </SettingsRow>
        </SettingsCard>
        <p className="text-xs text-muted-foreground/60 mt-2 px-1">
          Older data beyond this window will be automatically pruned during the nightly cleanup job.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { label: "Auto Refresh", value: prefs.autoRefresh ? "Active" : "Paused", icon: RefreshCw, color: prefs.autoRefresh ? "text-emerald-400" : "text-muted-foreground", bg: prefs.autoRefresh ? "bg-emerald-500/10" : "bg-muted/30" },
          { label: "Real-Time", value: prefs.realTimeUpdates && prefs.autoRefresh ? "Active" : "Inactive", icon: Activity, color: prefs.realTimeUpdates && prefs.autoRefresh ? "text-violet-400" : "text-muted-foreground", bg: prefs.realTimeUpdates && prefs.autoRefresh ? "bg-violet-500/10" : "bg-muted/30" },
          { label: "Retention", value: `${prefs.dataRetentionDays}d`, icon: HardDrive, color: "text-blue-400", bg: "bg-blue-500/10" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-xl p-3.5 border border-border/40", stat.bg)}>
              <Icon className={cn("w-4 h-4 mb-2", stat.color)} />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={cn("text-sm font-semibold mt-0.5", stat.color)}>{stat.value}</p>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
