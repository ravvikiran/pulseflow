import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, RotateCcw, ScanSearch, LineChart,
  Star, Bell, History, LogOut, LogIn, Menu, X,
  Activity, TrendingUp, ChevronRight, Zap, ChevronDown,
  Bitcoin, Flag, Globe, BarChart3, User, Settings2,
} from "lucide-react"; // ScanSearch already imported above
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationCenter";

// ─── Navigation Structure ─────────────────────────────────────────────────────
const NAV_STRUCTURE = [
  {
    group: "Overview",
    items: [
      { label: "Home Dashboard", href: "/", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    group: "Indian Stock Market",
    accent: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    icon: TrendingUp,
    items: [
      { label: "NSE Dashboard", href: "/india", icon: LayoutDashboard },
      { label: "Sector Rotation Engine", href: "/india/sectors", icon: RotateCcw },
      { label: "NSE Scanner", href: "/india/scanner", icon: ScanSearch },
    ],
  },
  {
    group: "Crypto Market",
    accent: "text-amber-400",
    borderColor: "border-amber-500/30",
    icon: Bitcoin,
    items: [
      { label: "Crypto Dashboard", href: "/crypto", icon: LayoutDashboard },
      { label: "Crypto Scanner", href: "/crypto/scanner", icon: ScanSearch },
    ],
  },
  {
    group: "US Market",
    accent: "text-blue-400",
    borderColor: "border-blue-500/30",
    icon: Flag,
    items: [
      { label: "US Dashboard", href: "/us", icon: LayoutDashboard },
    ],
    badge: "Future Ready",
  },
  {
    group: "Portfolio",
    items: [
      { label: "Asset Tracker", href: "/assets", icon: LineChart },
      { label: "Watchlists", href: "/watchlists", icon: Star },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { label: "Pattern Scanner", href: "/patterns", icon: ScanSearch },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Alerts", href: "/alerts", icon: Bell, alertBadge: true },
      { label: "Historical Analysis", href: "/historical", icon: History },
    ],
  },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({
  href, icon: Icon, label, alertBadge, alertCount, collapsed, onClick, accent,
}: {
  href: string; icon: React.ElementType; label: string;
  alertBadge?: boolean; alertCount?: number; collapsed: boolean;
  onClick?: () => void; accent?: string;
}) {
  const [location] = useLocation();
  const isActive = href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  return (
    <Link href={href} onClick={onClick}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-150 group relative",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent",
        collapsed && "justify-center px-2"
      )}>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
        )}
        <Icon className={cn("shrink-0 w-4 h-4", isActive && accent ? accent : "")} />
        {!collapsed && (
          <>
            <span className={cn("text-xs font-medium truncate flex-1", isActive && accent ? accent : "")}>{label}</span>
            {alertBadge && alertCount && alertCount > 0 ? (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0 h-4">
                {alertCount > 99 ? "99+" : alertCount}
              </Badge>
            ) : null}
          </>
        )}
      </div>
    </Link>
  );
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────
function NavGroup({
  group, items, accent, borderColor, icon: GroupIcon, badge: groupBadge, alertCount, collapsed,
  onItemClick,
}: {
  group: string; items: any[]; accent?: string; borderColor?: string; icon?: React.ElementType;
  badge?: string; alertCount: number; collapsed: boolean; onItemClick?: () => void;
}) {
  const [location] = useLocation();
  const isGroupActive = items.some(item =>
    item.href === "/" ? location === "/" : location === item.href || location.startsWith(item.href + "/")
  );
  const [open, setOpen] = useState(isGroupActive || group === "Overview" || group === "Portfolio" || group === "Intelligence");

  // Auto-expand active group
  useEffect(() => {
    if (isGroupActive) setOpen(true);
  }, [isGroupActive]);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(item => (
          <NavItem key={item.href} {...item} alertCount={alertCount} collapsed={true} onClick={onItemClick} accent={accent} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Group Header */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-colors",
          isGroupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          {GroupIcon && <GroupIcon className={cn("w-3.5 h-3.5 shrink-0", accent ?? "text-muted-foreground")} />}
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest", accent ?? "text-muted-foreground")}>
            {group}
          </span>
          {groupBadge && (
            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
              {groupBadge}
            </span>
          )}
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Group Items */}
      {open && (
        <div className={cn("space-y-0.5 mt-0.5 pl-2", borderColor && `border-l ${borderColor} ml-3`)}>
          {items.map(item => (
            <NavItem key={item.href} {...item} alertCount={alertCount} collapsed={false} onClick={onItemClick} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function PulseFlowLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  const { data: alertData } = trpc.alerts.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const alertCount = alertData?.count ?? 0;

  useEffect(() => { setMobileOpen(false); }, [location]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    const isCollapsed = collapsed && !mobile;
    return (
      <div className="flex flex-col h-full">
        {/* Logo — links to home */}
        <Link href="/">
          <div className={cn(
            "flex items-center gap-2.5 px-4 py-4 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
            isCollapsed && "justify-center px-2"
          )}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-primary shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <div className="text-sm font-bold text-foreground tracking-tight">PulseFlow</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Market Intelligence</div>
              </div>
            )}
          </div>
        </Link>

        {/* Live indicator */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-bull pulse-live" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Markets Live</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV_STRUCTURE.map((group) => (
            <NavGroup
              key={group.group}
              group={group.group}
              items={group.items}
              accent={(group as any).accent}
              borderColor={(group as any).borderColor}
              icon={(group as any).icon}
              badge={(group as any).badge}
              alertCount={alertCount}
              collapsed={isCollapsed}
              onItemClick={() => mobile && setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border px-2 py-3 space-y-1">
          {isAuthenticated ? (
            <>
              <NavItem href="/profile" icon={User} label="Profile" collapsed={isCollapsed} />
              <NavItem href="/settings" icon={Settings2} label="Settings" collapsed={isCollapsed} />
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150",
                  isCollapsed && "justify-center"
                )}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="text-xs font-medium">Logout</span>}
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-md bg-accent/50">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{user?.name ?? "User"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <a href={getLoginUrl()}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-primary hover:bg-primary/10 transition-all duration-150 cursor-pointer",
                isCollapsed && "justify-center"
              )}>
                <LogIn className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="text-xs font-medium">Sign In</span>}
              </div>
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0 relative",
        collapsed ? "w-14" : "w-56"
      )}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors z-10 hidden lg:flex"
        >
          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-border flex flex-col">
            <div className="absolute top-3 right-3">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground hidden sm:block">PulseFlow</span>
              </div>
            </Link>
            {/* Market breadcrumb */}
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
              <span>/</span>
              <span className="capitalize">
                {location === "/" ? "Home Dashboard"
                  : location.startsWith("/india") ? "Indian Stock Market"
                  : location.startsWith("/crypto") ? "Crypto Market"
                  : location.startsWith("/us") ? "US Market"
                  : location.startsWith("/settings") ? "Settings"
                  : location.replace("/", "").replace("-", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live market indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bull/10 border border-bull/20">
              <div className="w-1.5 h-1.5 rounded-full bg-bull pulse-live" />
              <span className="text-[10px] font-medium text-bull uppercase tracking-wider">Live</span>
            </div>

            {/* Notification Center Bell */}
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated && false && (
              <Link href="/alerts">
                <button className="relative p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <Bell className="w-4 h-4" />
                  {alertCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
              </Link>
            )}

            {!isAuthenticated && (
              <a href={getLoginUrl()}>
                <Button size="sm" className="h-7 text-xs">
                  <LogIn className="w-3 h-3 mr-1" />
                  Sign In
                </Button>
              </a>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
