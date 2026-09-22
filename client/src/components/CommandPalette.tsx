import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, RotateCcw, ScanSearch, LineChart,
  Star, Bell, History, Bitcoin, Flag, Globe,
  BarChart3, Settings2, BookOpen, Activity, Zap,
  Search, TrendingUp, TrendingDown, Coins,
} from "lucide-react";

interface NavCommand {
  label: string;
  href: string;
  icon: React.ElementType;
  category: string;
  keywords?: string[];
}

// Popular assets for quick search
const POPULAR_ASSETS = [
  { symbol: "RELIANCE", name: "Reliance Industries", type: "stock", market: "india" },
  { symbol: "TCS", name: "Tata Consultancy Services", type: "stock", market: "india" },
  { symbol: "HDFCBANK", name: "HDFC Bank", type: "stock", market: "india" },
  { symbol: "INFY", name: "Infosys", type: "stock", market: "india" },
  { symbol: "ICICIBANK", name: "ICICI Bank", type: "stock", market: "india" },
  { symbol: "WIPRO", name: "Wipro", type: "stock", market: "india" },
  { symbol: "ITC", name: "ITC Ltd", type: "stock", market: "india" },
  { symbol: "SBIN", name: "State Bank of India", type: "stock", market: "india" },
  { symbol: "BTC", name: "Bitcoin", type: "crypto", market: "crypto" },
  { symbol: "ETH", name: "Ethereum", type: "crypto", market: "crypto" },
  { symbol: "SOL", name: "Solana", type: "crypto", market: "crypto" },
  { symbol: "BNB", name: "Binance Coin", type: "crypto", market: "crypto" },
  { symbol: "ADA", name: "Cardano", type: "crypto", market: "crypto" },
  { symbol: "XRP", name: "Ripple", type: "crypto", market: "crypto" },
  { symbol: "AAPL", name: "Apple Inc.", type: "stock", market: "us" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "stock", market: "us" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock", market: "us" },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "stock", market: "us" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "stock", market: "us" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "stock", market: "us" },
  { symbol: "META", name: "Meta Platforms", type: "stock", market: "us" },
];

const COMMANDS: NavCommand[] = [
  // Navigation
  { label: "Home Dashboard", href: "/", icon: LayoutDashboard, category: "Navigation", keywords: ["home", "overview", "global"] },
  { label: "Indian Stock Market", href: "/india", icon: Flag, category: "Navigation", keywords: ["nse", "bse", "nifty", "india"] },
  { label: "Sector Rotation Engine", href: "/india/sectors", icon: RotateCcw, category: "Navigation", keywords: ["sector", "rotation", "heatmap"] },
  { label: "NSE Scanner", href: "/india/scanner", icon: ScanSearch, category: "Navigation", keywords: ["scanner", "ema", "breakout"] },
  { label: "Crypto Dashboard", href: "/crypto", icon: Bitcoin, category: "Navigation", keywords: ["crypto", "btc", "eth", "bitcoin"] },
  { label: "Crypto Scanner", href: "/crypto/scanner", icon: ScanSearch, category: "Navigation", keywords: ["crypto scanner", "volume"] },
  { label: "US Market", href: "/us", icon: Globe, category: "Navigation", keywords: ["us", "sp500", "nasdaq"] },
  { label: "Commodities", href: "/commodities", icon: BarChart3, category: "Navigation", keywords: ["gold", "oil", "commodity"] },

  // Tools
  { label: "Pattern Scanner", href: "/patterns", icon: Activity, category: "Tools", keywords: ["pattern", "triangle", "head shoulders"] },
  { label: "Asset Tracker", href: "/assets", icon: LineChart, category: "Tools", keywords: ["assets", "portfolio", "track"] },
  { label: "Watchlists", href: "/watchlists", icon: Star, category: "Tools", keywords: ["watchlist", "favorites"] },
  { label: "Trade Journal", href: "/journal", icon: BookOpen, category: "Tools", keywords: ["journal", "trade", "log"] },
  { label: "Historical Analysis", href: "/historical", icon: History, category: "Tools", keywords: ["history", "backtest"] },

  // Actions
  { label: "Alerts", href: "/alerts", icon: Bell, category: "Actions", keywords: ["alert", "notification", "trigger"] },
  { label: "Notifications", href: "/notifications", icon: Bell, category: "Actions", keywords: ["notification", "message"] },
  { label: "Settings", href: "/settings", icon: Settings2, category: "Actions", keywords: ["settings", "config", "preferences"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setLocation(href);
  }, [setLocation]);

  const groupedCommands = COMMANDS.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, NavCommand[]>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, assets, or actions..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="text-xs text-muted-foreground">Try searching for a stock symbol, page name, or feature</p>
          </div>
        </CommandEmpty>

        {/* Assets / Symbols */}
        <CommandGroup heading="Assets & Symbols">
          {POPULAR_ASSETS.map((asset) => (
            <CommandItem
              key={asset.symbol}
              value={`${asset.symbol} ${asset.name} ${asset.market}`}
              onSelect={() => handleSelect(`/assets/${asset.symbol}`)}
              className="flex items-center gap-3 cursor-pointer"
            >
              {asset.type === "crypto" ? (
                <Coins className="w-4 h-4 text-amber-400" />
              ) : asset.market === "india" ? (
                <Flag className="w-4 h-4 text-emerald-400" />
              ) : (
                <Globe className="w-4 h-4 text-blue-400" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{asset.symbol}</span>
                <span className="text-xs text-muted-foreground">{asset.name}</span>
              </div>
              <span className="ml-auto text-2xs text-muted-foreground uppercase">{asset.market}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation & Tools */}
        {Object.entries(groupedCommands).map(([category, items], idx) => (
          <div key={category}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={category}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Keyboard Shortcuts">
          <CommandItem disabled className="text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-2xs font-mono border border-border">g h</kbd>
              Go Home
            </span>
          </CommandItem>
          <CommandItem disabled className="text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-2xs font-mono border border-border">g i</kbd>
              India Market
            </span>
          </CommandItem>
          <CommandItem disabled className="text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-2xs font-mono border border-border">g c</kbd>
              Crypto Market
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
