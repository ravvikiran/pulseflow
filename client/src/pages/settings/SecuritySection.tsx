import React, { useState } from "react";
import {
  Shield, Lock, Smartphone, Monitor, Laptop, Globe, LogOut,
  Eye, EyeOff, CheckCircle2, AlertTriangle, Clock, Key
} from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, Toggle } from "./SettingsSection";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SecuritySectionProps {
  prefs: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
  isSaving?: boolean;
}

interface Session {
  id: string;
  device: string;
  deviceType: "desktop" | "mobile" | "tablet" | "browser";
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

const MOCK_SESSIONS: Session[] = [
  {
    id: "s1",
    device: "Chrome on Windows",
    deviceType: "desktop",
    location: "Mumbai, IN",
    ip: "103.xx.xx.xx",
    lastActive: "Active now",
    isCurrent: true,
  },
  {
    id: "s2",
    device: "Safari on iPhone",
    deviceType: "mobile",
    location: "Mumbai, IN",
    ip: "103.xx.xx.xx",
    lastActive: "2 hours ago",
    isCurrent: false,
  },
  {
    id: "s3",
    device: "Chrome on MacBook",
    deviceType: "desktop",
    location: "Bangalore, IN",
    ip: "49.xx.xx.xx",
    lastActive: "Yesterday",
    isCurrent: false,
  },
];

function DeviceIcon({ type }: { type: Session["deviceType"] }) {
  const Icon = type === "mobile" ? Smartphone : type === "tablet" ? Laptop : Monitor;
  return <Icon className="w-4 h-4" />;
}

export function SecuritySection({ prefs, onUpdate, isSaving }: SecuritySectionProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  const passwordStrength = (() => {
    if (!newPassword) return null;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    if (score <= 1) return { label: "Weak", color: "bg-rose-500", width: "w-1/5" };
    if (score <= 2) return { label: "Fair", color: "bg-amber-500", width: "w-2/5" };
    if (score <= 3) return { label: "Good", color: "bg-yellow-400", width: "w-3/5" };
    if (score <= 4) return { label: "Strong", color: "bg-emerald-500", width: "w-4/5" };
    return { label: "Very Strong", color: "bg-emerald-400", width: "w-full" };
  })();

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields required", { description: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match", { description: "New password and confirmation must match." });
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password too short", { description: "Password must be at least 8 characters." });
      return;
    }
    toast.success("Password updated", { description: "Your password has been changed successfully." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success("Session revoked", { description: "The device has been signed out." });
  };

  const handleRevokeAll = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    toast.success("All other sessions revoked", { description: "All other devices have been signed out." });
  };

  return (
    <SettingsSection
      title="Security"
      description="Manage your password, active sessions, and account security settings."
      icon={Shield}
      accentClass="text-rose-400"
      bgClass="bg-rose-500/10"
    >
      {/* Change Password */}
      <SettingsCard>
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-rose-400" />
            <p className="text-sm font-semibold text-foreground">Change Password</p>
          </div>

          {/* Current Password */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength meter */}
            {passwordStrength && (
              <div className="mt-2 space-y-1">
                <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-300", passwordStrength.color, passwordStrength.width)} />
                </div>
                <p className={cn("text-xs font-medium", {
                  "text-rose-400": passwordStrength.label === "Weak",
                  "text-amber-400": passwordStrength.label === "Fair",
                  "text-yellow-400": passwordStrength.label === "Good",
                  "text-emerald-400": passwordStrength.label === "Strong" || passwordStrength.label === "Very Strong",
                })}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={cn(
                  "w-full bg-background border rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 placeholder:text-muted-foreground/40",
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-rose-500/50 focus:ring-rose-500/40"
                    : "border-border/60 focus:ring-rose-500/40"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-sm font-semibold rounded-lg border border-rose-500/25 transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            Update Password
          </button>

          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground/70">Password requirements:</strong> Minimum 8 characters, with at least one uppercase letter, one number, and one special character recommended.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Two-Factor Authentication */}
      <SettingsCard>
        <SettingsRow
          label="Two-Factor Authentication"
          description="Add an extra layer of security to your account (coming soon)"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Coming Soon</span>
            <Toggle
              checked={twoFaEnabled}
              onChange={() => toast.info("2FA coming soon", { description: "Two-factor authentication will be available in a future update." })}
            />
          </div>
        </SettingsRow>
      </SettingsCard>

      {/* Active Sessions */}
      <SettingsCard>
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-rose-400" />
              <p className="text-sm font-semibold text-foreground">Active Sessions</p>
              <span className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-md">{sessions.length} devices</span>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAll}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Revoke all others
              </button>
            )}
          </div>

          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                  session.isCurrent
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-muted/20 border-border/40"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  session.isCurrent ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"
                )}>
                  <DeviceIcon type={session.deviceType} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{session.device}</p>
                    {session.isCurrent && (
                      <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md shrink-0">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{session.location}</p>
                    <span className="text-muted-foreground/30">·</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {session.lastActive}
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-colors shrink-0"
                  >
                    <LogOut className="w-3 h-3" />
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>

      {/* Security Tips */}
      <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-rose-400 mb-1">Security Recommendations</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Use a strong, unique password not used on other platforms</li>
              <li>• Enable 2FA when available for maximum account protection</li>
              <li>• Review active sessions regularly and revoke unrecognized devices</li>
              <li>• Never share your API keys or session tokens with third parties</li>
            </ul>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
