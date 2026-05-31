import React, { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, CheckCheck, Trash2, X, TrendingUp, TrendingDown, Zap, BarChart3, Activity, Settings, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationCategory =
  | "breakout"
  | "volume_spike"
  | "ema_crossover"
  | "sector_momentum"
  | "pattern_detected"
  | "system"
  | "alert_triggered";

type NotificationSeverity = "info" | "warning" | "critical";
type MarketDomain = "india" | "crypto" | "us" | "global";

interface NotificationItem {
  id: number;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  symbol?: string | null;
  sector?: string | null;
  marketDomain: MarketDomain;
  isRead: boolean;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(category: NotificationCategory, className = "w-4 h-4") {
  switch (category) {
    case "breakout": return <TrendingUp className={cn(className, "text-emerald-400")} />;
    case "volume_spike": return <BarChart3 className={cn(className, "text-amber-400")} />;
    case "ema_crossover": return <Activity className={cn(className, "text-blue-400")} />;
    case "sector_momentum": return <Zap className={cn(className, "text-purple-400")} />;
    case "pattern_detected": return <TrendingUp className={cn(className, "text-cyan-400")} />;
    case "alert_triggered": return <AlertTriangle className={cn(className, "text-orange-400")} />;
    case "system": return <Settings className={cn(className, "text-slate-400")} />;
    default: return <Bell className={cn(className, "text-slate-400")} />;
  }
}

function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical": return "border-l-red-500";
    case "warning": return "border-l-amber-500";
    case "info": return "border-l-blue-500";
    default: return "border-l-slate-600";
  }
}

function getDomainBadge(domain: MarketDomain) {
  const styles: Record<MarketDomain, string> = {
    india: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    crypto: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    us: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    global: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const labels: Record<MarketDomain, string> = {
    india: "NSE", crypto: "CRYPTO", us: "US", global: "GLOBAL",
  };
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", styles[domain])}>
      {labels[domain]}
    </span>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Notification Card (compact) ─────────────────────────────────────────────

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  compact = false,
}: {
  notification: NotificationItem;
  onMarkRead: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative border-l-2 pl-3 pr-2 py-2.5 rounded-r transition-all duration-150",
        getSeverityColor(notification.severity),
        notification.isRead
          ? "bg-slate-900/40 opacity-70"
          : "bg-slate-800/60 hover:bg-slate-800/80",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {getCategoryIcon(notification.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn(
              "text-sm font-semibold leading-tight",
              notification.isRead ? "text-slate-400" : "text-white"
            )}>
              {notification.title}
            </span>
            {!notification.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            )}
          </div>
          {!compact && (
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-1.5">
              {notification.message}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {getDomainBadge(notification.marketDomain)}
            {notification.symbol && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
                {notification.symbol}
              </span>
            )}
            <span className="text-[10px] text-slate-500">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.isRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Mark as read"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(notification.id)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dropdown Panel ───────────────────────────────────────────────────────────

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: recent = [] } = trpc.notifications.recent.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Notifications</span>
        </div>
        <div className="flex items-center gap-2">
          {recent.length > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-80 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {recent.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n as NotificationItem}
                onMarkRead={(id) => markRead.mutate({ id })}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700/60 px-4 py-2.5 bg-slate-800/30">
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

// ─── Bell Icon with Badge ─────────────────────────────────────────────────────

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Seed demo notifications on first load
  const seedDemo = trpc.notifications.seedDemo.useMutation({
    onSuccess: (data) => {
      if ((data.seeded ?? 0) > 0) utils.notifications.invalidate();
    },
  });

  useEffect(() => {
    if (user && !seedDemo.isPending) {
      seedDemo.mutate();
    }
  }, [user?.id]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = countData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-lg transition-all duration-150",
          open
            ? "bg-slate-700 text-white"
            : "text-slate-400 hover:text-white hover:bg-slate-800"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 animate-[wiggle_1s_ease-in-out]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full",
            "bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1",
            "ring-2 ring-slate-900"
          )}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

export { NotificationCard, getCategoryIcon, getSeverityColor, getDomainBadge, timeAgo };
export type { NotificationItem, NotificationCategory, NotificationSeverity, MarketDomain };
