import React from "react";
import { Bell, Mail, MessageSquare, Smartphone, Volume2, TrendingUp, BarChart2, Layers, AlertTriangle } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, Toggle, TextInput, SensitivitySlider } from "./SettingsSection";
import { cn } from "@/lib/utils";

interface AlertsSectionProps {
  prefs: {
    alertEmail: boolean;
    alertEmailAddress: string | null;
    alertTelegram: boolean;
    alertTelegramHandle: string | null;
    alertInApp: boolean;
    alertVolumeSpike: boolean;
    alertEmaCrossover: boolean;
    alertBreakout: boolean;
    alertSectorMomentum: boolean;
    alertSensitivity: "low" | "medium" | "high";
  };
  onUpdate: (updates: Partial<AlertsSectionProps["prefs"]>) => void;
  isSaving: boolean;
}

export function AlertsSection({ prefs, onUpdate, isSaving }: AlertsSectionProps) {
  const activeChannels = [prefs.alertEmail, prefs.alertTelegram, prefs.alertInApp].filter(Boolean).length;
  const activeAlertTypes = [prefs.alertVolumeSpike, prefs.alertEmaCrossover, prefs.alertBreakout, prefs.alertSectorMomentum].filter(Boolean).length;

  return (
    <SettingsSection
      title="Alerts & Notifications"
      description="Configure how and when PulseFlow notifies you about market events and signal triggers."
      icon={Bell}
      accentClass="text-amber-400"
      bgClass="bg-amber-500/10"
    >
      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5">
          <p className="text-xs text-muted-foreground">Active Channels</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{activeChannels}<span className="text-sm font-normal text-muted-foreground">/3</span></p>
        </div>
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5">
          <p className="text-xs text-muted-foreground">Alert Types Enabled</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{activeAlertTypes}<span className="text-sm font-normal text-muted-foreground">/4</span></p>
        </div>
      </div>

      {/* Delivery Channels */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Delivery Channels</p>
        <SettingsCard>
          {/* In-App */}
          <SettingsRow
            label="In-App Notifications"
            description="Show alerts in the PulseFlow notification panel"
          >
            <Toggle
              checked={prefs.alertInApp}
              onChange={(v) => onUpdate({ alertInApp: v })}
              disabled={isSaving}
              accentClass="bg-amber-500"
            />
          </SettingsRow>

          {/* Email */}
          <div className="py-3.5 border-b border-border/30">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Email Alerts</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Receive alerts via email</p>
              </div>
              <Toggle
                checked={prefs.alertEmail}
                onChange={(v) => onUpdate({ alertEmail: v })}
                disabled={isSaving}
                accentClass="bg-amber-500"
              />
            </div>
            {prefs.alertEmail && (
              <div className="mt-3 ml-5">
                <TextInput
                  value={prefs.alertEmailAddress ?? ""}
                  onChange={(v) => onUpdate({ alertEmailAddress: v || null })}
                  placeholder="your@email.com"
                  disabled={isSaving}
                  className="w-full max-w-xs"
                />
                <p className="text-xs text-muted-foreground/60 mt-1.5">Alert emails will be sent to this address.</p>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="py-3.5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Telegram Alerts</p>
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded-md font-medium">Beta</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Receive alerts via Telegram bot</p>
              </div>
              <Toggle
                checked={prefs.alertTelegram}
                onChange={(v) => onUpdate({ alertTelegram: v })}
                disabled={isSaving}
                accentClass="bg-amber-500"
              />
            </div>
            {prefs.alertTelegram && (
              <div className="mt-3 ml-5 space-y-2">
                <TextInput
                  value={prefs.alertTelegramHandle ?? ""}
                  onChange={(v) => onUpdate({ alertTelegramHandle: v || null })}
                  placeholder="@yourusername"
                  disabled={isSaving}
                  className="w-full max-w-xs"
                />
                <p className="text-xs text-muted-foreground/60">
                  Start a chat with <span className="text-blue-400 font-mono">@PulseFlowBot</span> and enter your handle above to receive alerts.
                </p>
              </div>
            )}
          </div>
        </SettingsCard>
      </div>

      {/* Alert Types */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alert Types</p>
        <SettingsCard>
          <SettingsRow
            label="Volume Spike Alerts"
            description="Alert when trading volume exceeds the configured multiplier"
          >
            <Toggle
              checked={prefs.alertVolumeSpike}
              onChange={(v) => onUpdate({ alertVolumeSpike: v })}
              disabled={isSaving}
              accentClass="bg-amber-500"
            />
          </SettingsRow>
          <SettingsRow
            label="EMA Crossover Alerts"
            description="Alert on EMA crossover signals (bullish/bearish)"
          >
            <Toggle
              checked={prefs.alertEmaCrossover}
              onChange={(v) => onUpdate({ alertEmaCrossover: v })}
              disabled={isSaving}
              accentClass="bg-amber-500"
            />
          </SettingsRow>
          <SettingsRow
            label="Breakout Alerts"
            description="Alert on 52-Week High, ATH, and consolidation breakouts"
          >
            <Toggle
              checked={prefs.alertBreakout}
              onChange={(v) => onUpdate({ alertBreakout: v })}
              disabled={isSaving}
              accentClass="bg-amber-500"
            />
          </SettingsRow>
          <SettingsRow
            label="Sector Momentum Alerts"
            description="Alert when sector momentum shifts significantly"
          >
            <Toggle
              checked={prefs.alertSectorMomentum}
              onChange={(v) => onUpdate({ alertSectorMomentum: v })}
              disabled={isSaving}
              accentClass="bg-amber-500"
            />
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Alert Sensitivity */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alert Sensitivity</p>
        <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Signal Sensitivity</p>
              <p className="text-xs text-muted-foreground mt-0.5">Controls how aggressively PulseFlow triggers alerts</p>
            </div>
            <SensitivitySlider
              value={prefs.alertSensitivity}
              onChange={(v) => onUpdate({ alertSensitivity: v })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { level: "low", label: "Low", desc: "Only strong, confirmed signals", color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/20" },
              { level: "medium", label: "Medium", desc: "Balanced signal detection", color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/20" },
              { level: "high", label: "High", desc: "Early signals, more noise", color: "text-rose-400", bg: "bg-rose-500/8 border-rose-500/20" },
            ].map((opt) => (
              <div key={opt.level} className={cn("rounded-lg p-2.5 border", opt.bg, prefs.alertSensitivity === opt.level ? "opacity-100" : "opacity-40")}>
                <p className={cn("font-semibold", opt.color)}>{opt.label}</p>
                <p className="text-muted-foreground/70 mt-0.5">{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
