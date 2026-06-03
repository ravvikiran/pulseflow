import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { User, Settings, Bell, Bookmark, Shield, LogOut, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, logout } = useAuth();
  const [saved, setSaved] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [defaultTimeframe, setDefaultTimeframe] = useState("1d");
  const [theme, setTheme] = useState("dark");

  const savePrefs = () => {
    setSaved(true);
    toast.success("Preferences saved");
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 lg:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <User className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Sign in to view your profile</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Manage your preferences, alert settings, and personalized watchlists.
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2">Sign In to PulseFlow</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile & Preferences
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and personalize PulseFlow</p>
      </div>

      {/* Profile Card */}
      <div className="pf-card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-primary">{user?.name?.charAt(0) ?? "U"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-foreground">{user?.name ?? "User"}</div>
          <div className="text-sm text-muted-foreground">{user?.email ?? "—"}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="text-[10px] bg-primary/15 text-primary border-primary/20">{user?.role ?? "user"}</Badge>
            <span className="text-[10px] text-muted-foreground">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0" onClick={() => logout()}>
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </Button>
      </div>

      <Tabs defaultValue="preferences">
        <TabsList className="bg-card border border-border h-8">
          <TabsTrigger value="preferences" className="text-xs h-6 px-3">Preferences</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs h-6 px-3">Alert Settings</TabsTrigger>
          <TabsTrigger value="security" className="text-xs h-6 px-3">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="mt-4 space-y-4">
          <div className="pf-card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Display Preferences
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-foreground">Default Timeframe</div>
                  <div className="text-[10px] text-muted-foreground">Used in charts and scanner</div>
                </div>
                <div className="flex gap-1.5">
                  {["1h", "4h", "1d", "1w"].map(tf => (
                    <button key={tf} onClick={() => setDefaultTimeframe(tf)}
                      className={cn("px-2 py-0.5 rounded text-xs font-medium transition-colors",
                        defaultTimeframe === tf ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-foreground">Theme</div>
                  <div className="text-[10px] text-muted-foreground">Interface appearance</div>
                </div>
                <div className="flex gap-1.5">
                  {["dark", "light"].map(t => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={cn("px-2.5 py-0.5 rounded text-xs font-medium capitalize transition-colors",
                        theme === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={savePrefs}>
              {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved!" : "Save Preferences"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 space-y-4">
          <div className="pf-card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Alert Delivery Settings
            </h3>
            <div className="space-y-3">
              {[
                { label: "In-App Notifications", desc: "Show alerts inside PulseFlow dashboard", value: inAppAlerts, set: setInAppAlerts },
                { label: "Email Alerts", desc: "Receive triggered alerts via email", value: emailAlerts, set: setEmailAlerts },
              ].map(({ label, desc, value, set }) => (
                <div key={label} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-foreground">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{desc}</div>
                  </div>
                  <Switch checked={value} onCheckedChange={set} />
                </div>
              ))}
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={savePrefs}>
              {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved!" : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="pf-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Security
            </h3>
            <div className="text-xs text-muted-foreground">
              PulseFlow uses secure JWT-based session authentication.
            </div>
            <div className="flex items-center gap-2 p-3 bg-bull/10 rounded-lg border border-bull/20">
              <Check className="w-4 h-4 text-bull" />
              <span className="text-xs text-bull font-medium">Account secured via session authentication</span>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-bear border-bear/30 hover:bg-bear/10" onClick={() => logout()}>
              <LogOut className="w-3.5 h-3.5" /> Sign Out of All Sessions
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
