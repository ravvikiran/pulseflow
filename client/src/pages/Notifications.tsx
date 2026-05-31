import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Bell, BellRing, CheckCheck, Trash2, Filter, RefreshCw,
  TrendingUp, BarChart3, Activity, Zap, AlertTriangle, Settings, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  NotificationCard, getCategoryIcon, getDomainBadge, timeAgo,
  type NotificationItem, type NotificationCategory, type MarketDomain,
} from "@/components/NotificationCenter";
import { getLoginUrl } from "@/const";

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORIES: { value: NotificationCategory | "all"; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Bell className="w-3.5 h-3.5" /> },
  { value: "breakout", label: "Breakouts", icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> },
  { value: "volume_spike", label: "Volume Spikes", icon: <BarChart3 className="w-3.5 h-3.5 text-amber-400" /> },
  { value: "ema_crossover", label: "EMA Crossovers", icon: <Activity className="w-3.5 h-3.5 text-blue-400" /> },
  { value: "sector_momentum", label: "Sector Momentum", icon: <Zap className="w-3.5 h-3.5 text-purple-400" /> },
  { value: "pattern_detected", label: "Patterns", icon: <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> },
  { value: "alert_triggered", label: "Alert Triggered", icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> },
  { value: "system", label: "System", icon: <Settings className="w-3.5 h-3.5 text-slate-400" /> },
];

const SEVERITY_COLORS = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function NotificationStats({ notifications }: { notifications: NotificationItem[] }) {
  const unread = notifications.filter(n => !n.isRead).length;
  const critical = notifications.filter(n => n.severity === "critical").length;
  const byDomain = {
    india: notifications.filter(n => n.marketDomain === "india").length,
    crypto: notifications.filter(n => n.marketDomain === "crypto").length,
    us: notifications.filter(n => n.marketDomain === "us").length,
    global: notifications.filter(n => n.marketDomain === "global").length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Unread", value: unread, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
        { label: "Critical", value: critical, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
        { label: "India", value: byDomain.india, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        { label: "Crypto", value: byDomain.crypto, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
      ].map(stat => (
        <div key={stat.label} className={cn("rounded-lg border p-3", stat.bg)}>
          <div className={cn("text-2xl font-bold font-mono", stat.color)}>{stat.value}</div>
          <div className="text-xs text-slate-400 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory | "all">("all");
  const [activeDomain, setActiveDomain] = useState<MarketDomain | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = trpc.notifications.list.useQuery(
    {
      limit: 100,
      unreadOnly: showUnreadOnly,
      category: activeCategory !== "all" ? activeCategory : undefined,
      marketDomain: activeDomain !== "all" ? activeDomain : undefined,
    },
    { enabled: !!user }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const deleteNotif = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("Notification deleted");
    },
  });

  const clearRead = trpc.notifications.clearRead.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("Read notifications cleared");
    },
  });

  const seedDemo = trpc.notifications.seedDemo.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("Demo notifications loaded");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Bell className="w-12 h-12 text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
        <p className="text-slate-400 mb-6 max-w-sm">
          Sign in to view your personalized market notifications and alerts.
        </p>
        <a href={getLoginUrl()}>
          <Button>Sign In to Continue</Button>
        </a>
      </div>
    );
  }

  const notifications = (data?.notifications ?? []) as NotificationItem[];

  // Client-side search filter
  const filtered = search.trim()
    ? notifications.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.message.toLowerCase().includes(search.toLowerCase()) ||
        (n.symbol?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (n.sector?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Market alerts, breakouts, pattern detections, and system updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 text-xs border-slate-700 text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              className="h-8 text-xs border-slate-700 text-slate-400 hover:text-white"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark All Read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearRead.mutate()}
            className="h-8 text-xs border-slate-700 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear Read
          </Button>
        </div>
      </div>

      {/* Stats */}
      {notifications.length > 0 && <NotificationStats notifications={notifications} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="pl-8 h-8 text-xs bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Domain filter */}
        <Select value={activeDomain} onValueChange={v => setActiveDomain(v as any)}>
          <SelectTrigger className="h-8 text-xs w-36 bg-slate-800/50 border-slate-700 text-slate-300">
            <SelectValue placeholder="All Markets" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all" className="text-xs text-slate-300">All Markets</SelectItem>
            <SelectItem value="india" className="text-xs text-emerald-400">🇮🇳 India (NSE)</SelectItem>
            <SelectItem value="crypto" className="text-xs text-amber-400">₿ Crypto</SelectItem>
            <SelectItem value="us" className="text-xs text-blue-400">🇺🇸 US Market</SelectItem>
            <SelectItem value="global" className="text-xs text-slate-400">🌐 Global</SelectItem>
          </SelectContent>
        </Select>

        {/* Unread toggle */}
        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={cn(
            "h-8 px-3 text-xs rounded-md border transition-colors",
            showUnreadOnly
              ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
              : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white"
          )}
        >
          Unread Only
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 flex-wrap mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeCategory === cat.value
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No notifications found</p>
          <p className="text-slate-500 text-sm mt-1">
            {search ? "Try adjusting your search or filters" : "You're all caught up!"}
          </p>
          {notifications.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs border-slate-700 text-slate-400 hover:text-white"
              onClick={() => seedDemo.mutate()}
            >
              Load Demo Notifications
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Unread section */}
          {filtered.filter(n => !n.isRead).length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-1 pt-2 pb-1">
                Unread ({filtered.filter(n => !n.isRead).length})
              </div>
              {filtered.filter(n => !n.isRead).map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={id => markRead.mutate({ id })}
                  onDelete={id => deleteNotif.mutate({ id })}
                />
              ))}
            </>
          )}

          {/* Read section */}
          {!showUnreadOnly && filtered.filter(n => n.isRead).length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-1 pt-4 pb-1">
                Read ({filtered.filter(n => n.isRead).length})
              </div>
              {filtered.filter(n => n.isRead).map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={id => markRead.mutate({ id })}
                  onDelete={id => deleteNotif.mutate({ id })}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
