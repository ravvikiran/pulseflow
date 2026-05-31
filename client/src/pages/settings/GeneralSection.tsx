import React from "react";
import { Palette, Sun, Moon, Monitor, Home, TrendingUp, Bitcoin, Globe2 } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, SelectField } from "./SettingsSection";
import { cn } from "@/lib/utils";

interface GeneralSectionProps {
  prefs: {
    theme: "dark" | "light" | "system";
    defaultLandingPage: "home" | "india" | "crypto" | "us";
    timezone: string;
    currency: string;
    language: string;
  };
  onUpdate: (updates: Partial<GeneralSectionProps["prefs"]>) => void;
  isSaving: boolean;
}

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon, desc: "Dark institutional theme" },
  { value: "light", label: "Light", icon: Sun, desc: "Light clean theme" },
  { value: "system", label: "System", icon: Monitor, desc: "Follow OS setting" },
] as const;

const LANDING_OPTIONS = [
  { value: "home", label: "Home Dashboard", icon: Home, accent: "text-indigo-400", bg: "bg-indigo-500/10" },
  { value: "india", label: "India Market", icon: TrendingUp, accent: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: "crypto", label: "Crypto Market", icon: Bitcoin, accent: "text-amber-400", bg: "bg-amber-500/10" },
  { value: "us", label: "US Market", icon: Globe2, accent: "text-blue-400", bg: "bg-blue-500/10" },
] as const;

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "IST — Asia/Kolkata (UTC+5:30)" },
  { value: "America/New_York", label: "EST — New York (UTC-5)" },
  { value: "America/Chicago", label: "CST — Chicago (UTC-6)" },
  { value: "America/Los_Angeles", label: "PST — Los Angeles (UTC-8)" },
  { value: "Europe/London", label: "GMT — London (UTC+0)" },
  { value: "Europe/Berlin", label: "CET — Berlin (UTC+1)" },
  { value: "Asia/Tokyo", label: "JST — Tokyo (UTC+9)" },
  { value: "Asia/Singapore", label: "SGT — Singapore (UTC+8)" },
  { value: "Asia/Dubai", label: "GST — Dubai (UTC+4)" },
  { value: "UTC", label: "UTC — Universal Time" },
];

const CURRENCIES = [
  { value: "INR", label: "₹ INR — Indian Rupee" },
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "GBP", label: "£ GBP — British Pound" },
  { value: "JPY", label: "¥ JPY — Japanese Yen" },
  { value: "SGD", label: "S$ SGD — Singapore Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "BTC", label: "₿ BTC — Bitcoin" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिन्दी) — Coming Soon" },
  { value: "ta", label: "Tamil (தமிழ்) — Coming Soon" },
  { value: "te", label: "Telugu (తెలుగు) — Coming Soon" },
];

export function GeneralSection({ prefs, onUpdate, isSaving }: GeneralSectionProps) {
  return (
    <SettingsSection
      title="General Settings"
      description="Customize the application appearance, default views, and regional preferences."
      icon={Palette}
      accentClass="text-indigo-400"
      bgClass="bg-indigo-500/10"
    >
      {/* Theme */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Application Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = prefs.theme === opt.value;
            return (
              <button
                key={opt.value}
                disabled={isSaving}
                onClick={() => onUpdate({ theme: opt.value })}
                className={cn(
                  "flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-150",
                  isSelected
                    ? "border-indigo-500/60 bg-indigo-500/10 shadow-sm shadow-indigo-500/10"
                    : "border-border/50 bg-card/30 hover:border-border hover:bg-card/60"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isSelected ? "bg-indigo-500/20" : "bg-muted/50"
                )}>
                  <Icon className={cn("w-5 h-5", isSelected ? "text-indigo-400" : "text-muted-foreground")} />
                </div>
                <div className="text-center">
                  <p className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{opt.desc}</p>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Default Landing Page */}
      <div className="space-y-3 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Landing Page</p>
        <div className="grid grid-cols-2 gap-2.5">
          {LANDING_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = prefs.defaultLandingPage === opt.value;
            return (
              <button
                key={opt.value}
                disabled={isSaving}
                onClick={() => onUpdate({ defaultLandingPage: opt.value })}
                className={cn(
                  "flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-150 text-left",
                  isSelected
                    ? "border-indigo-500/50 bg-indigo-500/8 shadow-sm"
                    : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", opt.bg)}>
                  <Icon className={cn("w-4 h-4", opt.accent)} />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>{opt.label}</p>
                </div>
                {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Regional Settings */}
      <div className="space-y-0 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Regional Settings</p>
        <SettingsCard>
          <SettingsRow label="Timezone" description="Used for timestamps and market session times">
            <SelectField
              value={prefs.timezone}
              onChange={(v) => onUpdate({ timezone: v })}
              options={TIMEZONES}
              disabled={isSaving}
              className="min-w-[220px]"
            />
          </SettingsRow>
          <SettingsRow label="Currency" description="Primary currency for price display">
            <SelectField
              value={prefs.currency}
              onChange={(v) => onUpdate({ currency: v })}
              options={CURRENCIES}
              disabled={isSaving}
            />
          </SettingsRow>
          <SettingsRow label="Language" description="Interface language (more coming soon)">
            <SelectField
              value={prefs.language}
              onChange={(v) => onUpdate({ language: v })}
              options={LANGUAGES}
              disabled={isSaving}
            />
          </SettingsRow>
        </SettingsCard>
      </div>
    </SettingsSection>
  );
}
