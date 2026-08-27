import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pulseflow_preferences";

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  defaultLandingPage: "home" | "india" | "crypto" | "us";
  timezone: string;
  currency: string;
  language: string;
  preferredModules: string[];
  preferredTimeframe: string;
  scannerRefreshInterval: number;
  heatmapRefreshInterval: number;
  defaultChartInterval: string;
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
  autoRefresh: boolean;
  realTimeUpdates: boolean;
  performanceMode: boolean;
  dataRetentionDays: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  defaultLandingPage: "home",
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
  alertSensitivity: "medium",
  autoRefresh: true,
  realTimeUpdates: true,
  performanceMode: false,
  dataRetentionDays: 90,
};

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore write errors
  }
}

/**
 * Hook that manages user preferences with localStorage persistence.
 * Works without a database — settings are always persisted locally.
 * Can be enhanced later to sync with server when DB is available.
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const [isSaving, setIsSaving] = useState(false);

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setIsSaving(true);
    setPreferences(prev => {
      const next = { ...prev, ...updates };
      savePreferences(next);
      return next;
    });
    // Brief delay to show saving state for UX feedback
    setTimeout(() => setIsSaving(false), 300);
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isSaving,
    isLoading: false,
  };
}
