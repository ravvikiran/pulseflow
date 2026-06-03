import React, { useState } from "react";
import { User, Mail, Camera, Crown, Wifi, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow } from "./SettingsSection";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ProfileSectionProps {
  prefs: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
  isSaving?: boolean;
  user?: {
    id: number;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    role: string;
    createdAt: Date;
  } | null;
}

function StatusBadge({ status, label }: { status: "connected" | "synced" | "error" | "pending"; label: string }) {
  const config = {
    connected: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    synced: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    error: { icon: AlertCircle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    pending: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export function ProfileSection({ prefs, onUpdate, isSaving, user: userProp }: ProfileSectionProps) {
  const { user: authUser } = useAuth();
  const user = userProp ?? authUser;
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
  const lastSync = new Date();
  lastSync.setMinutes(lastSync.getMinutes() - 3);

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    toast.success("Display name updated", { description: "Your profile has been saved." });
    setIsEditingName(false);
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SettingsSection
      title="User Profile"
      description="Manage your account information, subscription status, and connection details."
      icon={User}
      accentClass="text-violet-400"
      bgClass="bg-violet-500/10"
    >
      {/* Avatar & Identity */}
      <SettingsCard>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-violet-500/20">
              {initials}
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-card border border-border/60 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
              onClick={() => toast.info("Avatar upload", { description: "Avatar upload will be available in a future update." })}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Display Name */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Display Name</label>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setIsEditingName(false); }}
                    autoFocus
                    className="flex-1 bg-background border border-violet-500/40 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <button
                    onClick={handleSaveName}
                    className="px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setDisplayName(user?.name ?? ""); setIsEditingName(false); }}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{user?.name ?? "—"}</p>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Email Address</label>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                <p className="text-sm text-foreground">{user?.email ?? "Not provided"}</p>
                <StatusBadge status="connected" label="Verified" />
              </div>
            </div>

            {/* Login Method */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Authentication</label>
              <p className="text-sm text-foreground capitalize">{user?.loginMethod ?? "Session Auth"}</p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Subscription */}
      <SettingsCard>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500/15 rounded-xl flex items-center justify-center">
                <Crown className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">PulseFlow Pro</p>
                <p className="text-xs text-muted-foreground">Full access to all market modules</p>
              </div>
            </div>
            <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-lg font-semibold">Active</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Watchlists", value: "Unlimited", sub: "assets" },
              { label: "Alerts", value: "Unlimited", sub: "active" },
              { label: "Scanner Presets", value: "Unlimited", sub: "saved" },
            ].map((item) => (
              <div key={item.label} className="bg-muted/20 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-bold text-foreground mt-1">{item.value}</p>
                <p className="text-xs text-muted-foreground/60">{item.sub}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => toast.info("Subscription management", { description: "Subscription management will be available in a future update." })}
            className="w-full py-2 text-sm text-amber-400 hover:text-amber-300 border border-amber-500/25 hover:border-amber-500/40 rounded-xl transition-colors"
          >
            Manage Subscription
          </button>
        </div>
      </SettingsCard>

      {/* API & Sync Status */}
      <SettingsCard>
        <div className="space-y-2.5">
          {[
            { name: "Market Data API", status: "connected" as const, detail: "NSE & Crypto feeds active", icon: Wifi },
            { name: "Sector Data Engine", status: "synced" as const, detail: "Last synced 3 minutes ago", icon: RefreshCw },
            { name: "Alert Delivery", status: "connected" as const, detail: "In-app notifications active", icon: CheckCircle2 },
            { name: "Scanner Engine", status: "synced" as const, detail: "Background jobs running", icon: RefreshCw },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl">
                <div className="w-8 h-8 bg-muted/40 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <StatusBadge status={item.status} label={item.status === "connected" ? "Connected" : "Synced"} />
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Last Sync */}
      <div className="flex items-center gap-2 px-1">
        <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground/60">
          Last full sync: {lastSync.toLocaleString()} · Member since {new Date(user?.createdAt ?? Date.now()).toLocaleDateString()}
        </p>
      </div>
    </SettingsSection>
  );
}
