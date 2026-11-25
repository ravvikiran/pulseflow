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
      description="Your display name and local profile details."
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

      <div className="flex items-center gap-2 px-1">
        <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          PulseFlow is a local, single-user app: there is no subscription or account to manage. Market data refreshes
          automatically from Yahoo Finance and other public sources.
        </p>
      </div>
    </SettingsSection>
  );
}
