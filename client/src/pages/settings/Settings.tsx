import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Settings2, User, Bell, ScanSearch, Database, Shield, Palette,
  ChevronRight, TrendingUp, Zap, Globe, Check, Loader2
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Section imports
import { GeneralSection } from "./GeneralSection";
import { MarketPreferencesSection } from "./MarketPreferencesSection";
import { AlertsSection } from "./AlertsSection";
import { ScannerConfigSection } from "./ScannerConfigSection";
import { DataPerformanceSection } from "./DataPerformanceSection";
import { ProfileSection } from "./ProfileSection";
import { SecuritySection } from "./SecuritySection";

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "general",
    label: "General",
    icon: Palette,
    description: "Theme, language, timezone",
    accent: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    id: "market",
    label: "Market Preferences",
    icon: TrendingUp,
    description: "Modules, timeframes, refresh",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "alerts",
    label: "Alerts & Notifications",
    icon: Bell,
    description: "Email, Telegram, in-app",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "scanner",
    label: "Scanner Configuration",
    icon: ScanSearch,
    description: "EMA values, presets, filters",
    accent: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    id: "data",
    label: "Data & Performance",
    icon: Database,
    description: "Cache, refresh, retention",
    accent: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    id: "profile",
    label: "User Profile",
    icon: User,
    description: "Account, avatar, subscription",
    accent: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Password, sessions, 2FA",
    accent: "text-orange-400",
    bg: "bg-orange-500/10",
  },
] as const;

type SectionId = typeof NAV_ITEMS[number]["id"];

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch preferences
  const { data: preferences, isLoading: prefsLoading, refetch: refetchPrefs } =
    trpc.settings.getPreferences.useQuery(undefined, { enabled: isAuthenticated });

  // Fetch scanner presets
  const { data: presets, refetch: refetchPresets } =
    trpc.settings.getScannerPresets.useQuery(undefined, { enabled: isAuthenticated });

  const updatePrefsMutation = trpc.settings.updatePreferences.useMutation({
    onSuccess: () => {
      refetchPrefs();
      toast.success("Settings saved", { description: "Your preferences have been updated." });
    },
    onError: (err) => toast.error("Failed to save", { description: err.message }),
  });

  // Scroll to section when nav item clicked
  const handleNavClick = (id: SectionId) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Update active section based on scroll position
  useEffect(() => {
    const container = document.getElementById("settings-scroll-container");
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      let current: SectionId = "general";

      for (const item of NAV_ITEMS) {
        const el = sectionRefs.current[item.id];
        if (el) {
          const top = el.offsetTop - 100;
          if (scrollTop >= top) current = item.id;
        }
      }
      setActiveSection(current);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading || prefsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold">Authentication Required</p>
          <p className="text-sm text-muted-foreground">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  const prefs = preferences ?? {
    theme: "dark" as const,
    defaultLandingPage: "home" as const,
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en",
    preferredModules: ["india", "crypto"],
    preferredTimeframe: "1d",
    scannerRefreshInterval: 60,
    heatmapRefreshInterval: 30,
    defaultChartInterval: "1d",
    alertEmail: false,
    alertEmailAddress: null,
    alertTelegram: false,
    alertTelegramHandle: null,
    alertInApp: true,
    alertVolumeSpike: true,
    alertEmaCrossover: true,
    alertBreakout: true,
    alertSectorMomentum: true,
    alertSensitivity: "medium" as const,
    autoRefresh: true,
    realTimeUpdates: true,
    performanceMode: false,
    dataRetentionDays: 90,
  };

  const isSaving = updatePrefsMutation.isPending;

  const updatePrefs = (updates: Parameters<typeof updatePrefsMutation.mutate>[0]) => {
    updatePrefsMutation.mutate(updates);
  };

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* ── Left Navigation Panel ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 h-screen overflow-y-auto shrink-0">
        {/* Header */}
        <div className="px-5 py-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">Configuration Center</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                  isActive
                    ? "bg-card border border-border/60 shadow-sm"
                    : "hover:bg-card/60 border border-transparent"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors", item.bg)}>
                  <Icon className={cn("w-4 h-4", item.accent)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground/70 truncate">{item.description}</p>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Save status indicator */}
        <div className="px-5 py-4 border-t border-border/50">
          <div className={cn(
            "flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all",
            isSaving ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
          )}>
            {isSaving ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Saving changes…</>
            ) : (
              <><Check className="w-3 h-3" /> All changes saved</>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Nav ────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main
        id="settings-scroll-container"
        className="flex-1 overflow-y-auto lg:h-screen pt-16 lg:pt-0"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-12">
          {/* Page header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your PulseFlow configuration, preferences, and account settings.
            </p>
          </div>

          {/* ── General ── */}
          <div ref={(el) => { sectionRefs.current["general"] = el; }} id="section-general">
            <GeneralSection prefs={prefs} onUpdate={updatePrefs} isSaving={isSaving} />
          </div>

          {/* ── Market Preferences ── */}
          <div ref={(el) => { sectionRefs.current["market"] = el; }} id="section-market">
            <MarketPreferencesSection prefs={prefs} onUpdate={updatePrefs} isSaving={isSaving} />
          </div>

          {/* ── Alerts & Notifications ── */}
          <div ref={(el) => { sectionRefs.current["alerts"] = el; }} id="section-alerts">
            <AlertsSection prefs={prefs} onUpdate={updatePrefs} isSaving={isSaving} />
          </div>

          {/* ── Scanner Configuration ── */}
          <div ref={(el) => { sectionRefs.current["scanner"] = el; }} id="section-scanner">
            <ScannerConfigSection
              prefs={prefs}
              presets={presets ?? []}
              onUpdate={updatePrefs}
              onPresetsChange={refetchPresets}
              isSaving={isSaving}
            />
          </div>

          {/* ── Data & Performance ── */}
          <div ref={(el) => { sectionRefs.current["data"] = el; }} id="section-data">
            <DataPerformanceSection prefs={prefs} onUpdate={updatePrefs} isSaving={isSaving} />
          </div>

          {/* ── Profile ── */}
          <div ref={(el) => { sectionRefs.current["profile"] = el; }} id="section-profile">
            <ProfileSection user={user} prefs={prefs} onUpdate={updatePrefs} />
          </div>

          {/* ── Security ── */}
          <div ref={(el) => { sectionRefs.current["security"] = el; }} id="section-security">
            <SecuritySection prefs={prefs} onUpdate={updatePrefs} />
          </div>

          {/* Bottom padding */}
          <div className="h-16" />
        </div>
      </main>
    </div>
  );
}
