import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Bell, BellOff, Plus, Trash2, Check, X, Activity,
  TrendingUp, TrendingDown, Zap, BarChart3, RefreshCw,
  Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ALERT_TYPES = [
  { value: "ema_crossover", label: "EMA Crossover", icon: TrendingUp, desc: "Trigger when two EMAs cross" },
  { value: "volume_spike", label: "Volume Spike", icon: BarChart3, desc: "Unusual volume detected" },
  { value: "breakout_52w", label: "52-Week High Breakout", icon: Zap, desc: "Price near 52-week high" },
  { value: "breakout_ath", label: "ATH Breakout", icon: Zap, desc: "Price near All-Time High" },
  { value: "sector_momentum_shift", label: "Sector Momentum Shift", icon: Activity, desc: "Sector momentum changes direction" },
  { value: "trend_reversal", label: "Trend Reversal", icon: RefreshCw, desc: "Trend direction changes" },
  { value: "relative_strength_change", label: "Relative Strength Change", icon: TrendingUp, desc: "RS vs benchmark changes significantly" },
  { value: "price_target", label: "Price Target", icon: AlertTriangle, desc: "Price reaches a specific level" },
];

// India sectors — NSE stocks only
const INDIA_SECTORS = [
  "Information Technology", "Banking & Finance", "Energy & Oil",
  "Healthcare & Pharma", "Consumer Goods", "Metals & Mining", "Automobile",
  "Real Estate", "Telecom", "FMCG", "Infrastructure",
];
// Crypto sectors — crypto assets only
const CRYPTO_SECTORS = ["Cryptocurrency"];
// Combined for backward compat (labeled by market)
const SECTORS_BY_MARKET = [
  { group: "Indian Stock Market (NSE)", sectors: INDIA_SECTORS },
  { group: "Crypto Market", sectors: CRYPTO_SECTORS },
];

function AlertTypeIcon({ type }: { type: string }) {
  const found = ALERT_TYPES.find(a => a.value === type);
  const Icon = found?.icon ?? Bell;
  return <Icon className="w-4 h-4" />;
}

function AlertCard({ alert }: { alert: any }) {
  const utils = trpc.useUtils();
  const toggleMutation = trpc.alerts.toggle.useMutation({
    onSuccess: () => utils.alerts.list.invalidate(),
  });
  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => { utils.alerts.list.invalidate(); toast.success("Alert deleted"); },
  });

  const alertInfo = ALERT_TYPES.find(a => a.value === alert.alert.alertType);
  const isActive = alert.alert.isActive;

  return (
    <div className={cn("pf-card p-4 transition-all", !isActive && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            isActive ? "bg-primary/15" : "bg-muted"
          )}>
            <AlertTypeIcon type={alert.alert.alertType} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{alertInfo?.label ?? alert.alert.alertType}</span>
              {alert.asset && (
                <Badge className="text-[10px] bg-muted text-muted-foreground border-0">{alert.asset.symbol}</Badge>
              )}
              <Badge className={cn("text-[10px]", isActive ? "badge-bull" : "bg-muted text-muted-foreground border-0")}>
                {isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{alertInfo?.desc}</div>
            {alert.alert.condition && (
              <div className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-0.5 rounded inline-block">
                {JSON.stringify(alert.alert.condition)}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Created {new Date(alert.alert.createdAt).toLocaleDateString()}
              </span>
              {alert.alert.triggerCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-bull" />
                  Triggered {alert.alert.triggerCount}x
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => toggleMutation.mutate({ id: alert.alert.id, isActive: checked })}
            className="scale-75"
          />
          <button onClick={() => deleteMutation.mutate({ id: alert.alert.id })}>
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-bear transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAlertForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [alertType, setAlertType] = useState("ema_crossover");
  const [symbol, setSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<{ id: number; symbol: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState("above");
  const [sector, setSector] = useState("");
  const [timeframe, setTimeframe] = useState("1d");

  const { data: searchResults } = trpc.assets.search.useQuery(
    { query: symbol },
    { enabled: symbol.length >= 2 && !selectedAsset }
  );

  const createMutation = trpc.alerts.create.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      toast.success("Alert created successfully");
      onClose();
    },
  });

  const handleCreate = () => {
    const condition: any = { timeframe };
    if (threshold) condition.threshold = Number(threshold);
    if (direction) condition.direction = direction;
    if (sector) condition.sector = sector;

    createMutation.mutate({
      alertType: alertType as any,
      assetId: selectedAsset?.id,
      condition,
    });
  };

  const needsSector = ["sector_momentum_shift"].includes(alertType);
  const needsThreshold = ["price_target", "relative_strength_change"].includes(alertType);
  const needsAsset = !["sector_momentum_shift"].includes(alertType);
  const needsEMA = ["ema_crossover"].includes(alertType);

  return (
    <div className="pf-card p-5 space-y-4 animate-[fade-up_0.2s_ease-out]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Create New Alert</h3>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
      </div>

      {/* Alert Type */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Alert Type</label>
        <div className="grid grid-cols-2 gap-2">
          {ALERT_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setAlertType(value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left transition-all",
                alertType === value
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Asset Search */}
      {needsAsset && (
        <div className="space-y-1.5 relative">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Asset (Optional)</label>
          {selectedAsset ? (
            <div className="flex items-center gap-2 h-8 px-3 bg-primary/10 border border-primary/30 rounded-md">
              <span className="text-xs font-semibold text-primary">{selectedAsset.symbol}</span>
              <button onClick={() => { setSelectedAsset(null); setSymbol(""); }} className="ml-auto">
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search symbol (e.g. TCS, BTC)..."
                className="h-8 text-xs bg-muted border-border"
                value={symbol}
                onChange={e => { setSymbol(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              />
              {showDropdown && searchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                  {searchResults.slice(0, 6).map((a: any) => (
                    <button
                      key={a.symbol}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                      onMouseDown={() => { setSelectedAsset({ id: a.id ?? 0, symbol: a.symbol }); setSymbol(a.symbol); setShowDropdown(false); }}
                    >
                      <span className="font-semibold text-foreground">{a.symbol}</span>
                      <span className="text-muted-foreground truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeframe */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Timeframe</label>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-8 text-xs bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["1d", "1w", "4h", "1h"].map(tf => <SelectItem key={tf} value={tf} className="text-xs">{tf.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {needsThreshold && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Threshold</label>
            <Input
              placeholder="e.g. 1500"
              className="h-8 text-xs bg-muted border-border"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
          </div>
        )}
      </div>

      {needsSector && (
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sector</label>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="h-8 text-xs bg-muted border-border">
              <SelectValue placeholder="Select sector..." />
            </SelectTrigger>
            <SelectContent>
              {SECTORS_BY_MARKET.map(group => (
                <React.Fragment key={group.group}>
                  <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground border-t border-border first:border-0">{group.group}</div>
                  {group.sectors.map((s: string) => <SelectItem key={s} value={s} className="text-xs pl-4">{s}</SelectItem>)}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button className="flex-1 h-8 text-xs gap-1.5" onClick={handleCreate} disabled={createMutation.isPending}>
          <Bell className="w-3.5 h-3.5" />
          {createMutation.isPending ? "Creating..." : "Create Alert"}
        </Button>
        <Button variant="ghost" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { isAuthenticated } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: alerts, isLoading } = trpc.alerts.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, isLoading: historyLoading } = trpc.alerts.history.useQuery({ limit: 50 }, { enabled: isAuthenticated });
  const markReadMutation = trpc.alerts.markRead.useMutation({
    onSuccess: () => { utils.alerts.unreadCount.invalidate(); utils.alerts.history.invalidate(); },
  });

  const activeAlerts = (alerts ?? []).filter((a: any) => a.alert.isActive);
  const pausedAlerts = (alerts ?? []).filter((a: any) => !a.alert.isActive);

  if (!isAuthenticated) {
    return (
      <div className="p-4 lg:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Bell className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Sign in to manage alerts</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Set up smart alerts for EMA crossovers, volume spikes, breakouts, and sector momentum shifts.
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2">Sign In to PulseFlow</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alerts System
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Smart alerts for EMA crossovers, volume spikes, breakouts, and sector momentum shifts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => markReadMutation.mutate()}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Read
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-3.5 h-3.5" /> New Alert
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Alerts", value: activeAlerts.length, color: "text-bull" },
          { label: "Paused", value: pausedAlerts.length, color: "text-muted-foreground" },
          { label: "Total Alerts", value: (alerts ?? []).length, color: "text-foreground" },
          { label: "Recent Triggers", value: (history ?? []).length, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="pf-card p-3">
            <div className="stat-label">{label}</div>
            <div className={cn("stat-value", color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && <CreateAlertForm onClose={() => setShowCreate(false)} />}

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="bg-card border border-border h-8">
          <TabsTrigger value="active" className="text-xs h-6 px-3">Active ({activeAlerts.length})</TabsTrigger>
          <TabsTrigger value="paused" className="text-xs h-6 px-3">Paused ({pausedAlerts.length})</TabsTrigger>
          <TabsTrigger value="history" className="text-xs h-6 px-3">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
          ) : activeAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellOff className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <div className="text-sm text-muted-foreground">No active alerts</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Create an alert to get notified of market events</div>
            </div>
          ) : (
            activeAlerts.map((alert: any) => <AlertCard key={alert.alert.id} alert={alert} />)
          )}
        </TabsContent>

        <TabsContent value="paused" className="mt-4 space-y-3">
          {pausedAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <div className="text-sm text-muted-foreground">No paused alerts</div>
            </div>
          ) : (
            pausedAlerts.map((alert: any) => <AlertCard key={alert.alert.id} alert={alert} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyLoading ? (
            <Skeleton className="h-48 rounded" />
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <div className="text-sm text-muted-foreground">No alert history yet</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Triggered alerts will appear here</div>
            </div>
          ) : (
            <div className="pf-card overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-2">Time</div>
                <div className="col-span-3">Alert Type</div>
                <div className="col-span-3">Asset</div>
                <div className="col-span-3">Message</div>
                <div className="col-span-1">Status</div>
              </div>
              {history.map((h: any) => (
                <div key={h.history.id} className="grid grid-cols-12 px-4 py-3 border-b border-border/50 last:border-0 items-center">
                  <div className="col-span-2 text-[10px] text-muted-foreground">
                    {new Date(h.history.triggeredAt).toLocaleDateString()}
                  </div>
                  <div className="col-span-3 text-xs text-foreground">
                    {ALERT_TYPES.find(a => a.value === h.history.alertType)?.label ?? h.history.alertType}
                  </div>
                  <div className="col-span-3 text-xs text-muted-foreground">{h.asset?.symbol ?? "—"}</div>
                  <div className="col-span-3 text-xs text-muted-foreground truncate">{h.history.message}</div>
                  <div className="col-span-1">
                    <div className={cn("w-2 h-2 rounded-full", h.history.isRead ? "bg-muted-foreground" : "bg-primary pulse-live")} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
