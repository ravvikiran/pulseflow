import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Plus, Trash2, Star, BarChart3, TrendingUp, TrendingDown,
  List, Search, ChevronRight, Bookmark, Edit2, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${fmt(v)}%`;
}

function WatchlistCard({ watchlist, onSelect, isSelected }: {
  watchlist: any; onSelect: () => void; isSelected: boolean;
}) {
  const deleteMutation = trpc.watchlists.delete.useMutation({
    onSuccess: () => toast.success("Watchlist deleted"),
  });

  return (
    <div
      className={cn(
        "pf-card p-4 cursor-pointer transition-all",
        isSelected ? "border-primary/50 bg-primary/5" : "hover:border-border/80"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isSelected ? "bg-primary/20" : "bg-muted")}>
            <Bookmark className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{watchlist.name}</div>
            {watchlist.description && (
              <div className="text-[10px] text-muted-foreground">{watchlist.description}</div>
            )}
          </div>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 hover:text-bear transition-all"
          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: watchlist.id }); }}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-bear transition-colors" />
        </button>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        {new Date(watchlist.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function WatchlistDetail({ watchlistId }: { watchlistId: number }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.watchlists.detail.useQuery({ id: watchlistId });
  const { data: searchResults } = trpc.assets.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );
  const addMutation = trpc.watchlists.addItem.useMutation({
    onSuccess: () => { utils.watchlists.detail.invalidate(); toast.success("Asset added to watchlist"); setSearchQuery(""); },
  });
  const removeMutation = trpc.watchlists.removeItem.useMutation({
    onSuccess: () => { utils.watchlists.detail.invalidate(); toast.success("Asset removed"); },
  });

  if (isLoading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">{data.name}</h2>
          <div className="text-xs text-muted-foreground">{data.items?.length ?? 0} assets</div>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowSearch(!showSearch)}>
          <Plus className="w-3 h-3" /> Add Asset
        </Button>
      </div>

      {/* Search to add */}
      {showSearch && (
        <div className="pf-card p-3 space-y-2 animate-[fade-up_0.15s_ease-out]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search symbol or name..."
              className="pl-8 h-8 text-xs bg-muted border-border"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((asset: any) => (
                <div
                  key={asset.symbol}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer"
                  onClick={() => addMutation.mutate({ watchlistId, symbol: asset.symbol })}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-primary">{asset.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">{asset.symbol}</div>
                      <div className="text-[10px] text-muted-foreground">{asset.name}</div>
                    </div>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-primary" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {!data.items || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bookmark className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm text-muted-foreground">No assets in this watchlist</div>
          <div className="text-xs text-muted-foreground/60 mt-1">Click "Add Asset" to get started</div>
        </div>
      ) : (
        <div className="pf-card overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div className="col-span-4">Asset</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Change</div>
            <div className="col-span-2">Volume</div>
            <div className="col-span-1">Sector</div>
            <div className="col-span-1"></div>
          </div>
          {data.items.map((item: any) => {
            const price = item.price;
            const change = Number(price?.changePercent ?? 0);
            return (
              <div key={item.item.id} className="grid grid-cols-12 px-4 py-3 border-b border-border/50 last:border-0 items-center hover:bg-accent/20 transition-colors">
                <div className="col-span-4 flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary">{item.asset.symbol.slice(0, 2)}</span>
                  </div>
                  <div>
                    <Link href={`/assets/${item.asset.symbol}`}>
                      <div className="text-xs font-semibold text-foreground hover:text-primary cursor-pointer transition-colors">{item.asset.symbol}</div>
                    </Link>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{item.asset.name}</div>
                  </div>
                </div>
                <div className="col-span-2 text-xs font-semibold tabular-nums text-foreground">{fmt(Number(price?.price ?? 0))}</div>
                <div className={cn("col-span-2 text-xs font-bold tabular-nums", change >= 0 ? "text-bull" : "text-bear")}>
                  {fmtPct(change)}
                </div>
                <div className="col-span-2 text-xs tabular-nums text-muted-foreground">
                  {price?.volume ? (Number(price.volume) / 1e5).toFixed(1) + "L" : "—"}
                </div>
                <div className="col-span-1 text-[10px] text-muted-foreground truncate">{item.asset.sector?.split(" ")[0] ?? "—"}</div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Link href={`/assets/${item.asset.symbol}`}>
                    <button className="p-1 hover:text-primary transition-colors"><BarChart3 className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                  </Link>
                  <button className="p-1" onClick={() => removeMutation.mutate({ watchlistId, assetId: item.item.assetId })}>
                    <X className="w-3 h-3 text-muted-foreground hover:text-bear transition-colors" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Watchlists() {
  const { isAuthenticated } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const utils = trpc.useUtils();

  const { data: watchlists, isLoading } = trpc.watchlists.list.useQuery(undefined, { enabled: isAuthenticated });
  const createMutation = trpc.watchlists.create.useMutation({
    onSuccess: () => {
      utils.watchlists.list.invalidate();
      toast.success("Watchlist created");
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="p-4 lg:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Bookmark className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Sign in to manage watchlists</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Create custom watchlists, track your favorite assets, and get personalized market insights.
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2">Sign In to PulseFlow</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-[fade-up_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            Custom Watchlists
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your asset lists and track favorites</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5" /> New Watchlist
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="pf-card p-4 space-y-3 animate-[fade-up_0.15s_ease-out]">
          <h3 className="text-sm font-semibold text-foreground">Create New Watchlist</h3>
          <Input
            placeholder="Watchlist name..."
            className="h-8 text-xs bg-muted border-border"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Description (optional)..."
            className="h-8 text-xs bg-muted border-border"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => {
              if (newName.trim()) createMutation.mutate({ name: newName, description: newDesc || undefined });
            }}>
              <Check className="w-3 h-3" /> Create
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Watchlist Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          ) : !watchlists || watchlists.length === 0 ? (
            <div className="pf-card p-6 text-center">
              <List className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">No watchlists yet</div>
            </div>
          ) : (
            watchlists.map((wl: any) => (
              <div key={wl.id} className="group">
                <WatchlistCard
                  watchlist={wl}
                  isSelected={selectedId === wl.id}
                  onSelect={() => setSelectedId(wl.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* Watchlist Content */}
        <div className="lg:col-span-3">
          {selectedId ? (
            <WatchlistDetail watchlistId={selectedId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <List className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <div className="text-sm text-muted-foreground">Select a watchlist to view assets</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
