import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Zap, AlertTriangle,
  BarChart3, Activity, Volume2, X, ChevronLeft, ChevronRight,
} from "lucide-react";

interface PulseEvent {
  id: string;
  type: "breakout" | "volume_spike" | "trend_change" | "alert" | "momentum";
  symbol: string;
  message: string;
  timestamp: Date;
  severity: "info" | "warning" | "success";
}

const EVENT_TEMPLATES = [
  { type: "breakout" as const, messages: ["{symbol} broke 52-week high", "{symbol} testing resistance at ATH", "{symbol} breaking out of consolidation"], severity: "success" as const },
  { type: "volume_spike" as const, messages: ["{symbol} volume 3x average", "{symbol} unusual volume detected", "{symbol} volume surge with price breakout"], severity: "warning" as const },
  { type: "trend_change" as const, messages: ["{symbol} EMA crossover (bullish)", "{symbol} RSI entering oversold", "{symbol} MACD histogram turning positive"], severity: "info" as const },
  { type: "momentum" as const, messages: ["{symbol} momentum accelerating", "{symbol} relative strength +5", "{symbol} consecutive higher highs"], severity: "success" as const },
];

const INDIA_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "WIPRO", "ITC", "SBIN", "BAJFINANCE", "LT", "TATAMOTORS", "MARUTI"];
const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOT", "AVAX", "MATIC", "LINK"];
const US_SYMBOLS = ["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "JPM"];

const ALL_SYMBOLS = [...INDIA_SYMBOLS, ...CRYPTO_SYMBOLS, ...US_SYMBOLS];

function generateEvent(): PulseEvent {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const symbol = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
  const message = template.messages[Math.floor(Math.random() * template.messages.length)].replace("{symbol}", symbol);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: template.type,
    symbol,
    message,
    timestamp: new Date(),
    severity: template.severity,
  };
}

const typeIcons: Record<string, React.ElementType> = {
  breakout: TrendingUp,
  volume_spike: Volume2,
  trend_change: Activity,
  alert: AlertTriangle,
  momentum: Zap,
};

const severityColors: Record<string, string> = {
  info: "border-l-primary text-primary",
  warning: "border-l-[oklch(0.65_0.12_80)] text-[oklch(0.65_0.12_80)]",
  success: "border-l-bull text-bull",
};

const severityBg: Record<string, string> = {
  info: "bg-primary/5",
  warning: "bg-[oklch(0.65_0.12_80/0.05)]",
  success: "bg-bull/5",
};

/**
 * Full-height right-side panel that continuously shows market events.
 * Events accumulate over time and auto-scroll to the latest.
 */
export function MarketPulsePanel({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Generate initial batch
    const initial = Array.from({ length: 8 }, () => {
      const ev = generateEvent();
      ev.timestamp = new Date(Date.now() - Math.random() * 300000); // spread over last 5 min
      return ev;
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    setEvents(initial);

    // Continuously add new events
    intervalRef.current = setInterval(() => {
      setEvents(prev => [...prev, generateEvent()]);
    }, 5000 + Math.random() * 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40 w-6 h-16 rounded-l-md border border-r-0 border-border bg-card flex items-center justify-center hover:bg-accent transition-colors",
          isOpen && "hidden"
        )}
        title="Open Market Pulse"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-40 w-72 border-l border-border bg-sidebar flex flex-col shadow-2xl"
            initial={{ x: 288 }}
            animate={{ x: 0 }}
            exit={{ x: 288 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-bull pulse-live" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Market Pulse</h3>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground tabular-nums">{events.length} events</span>
                <button
                  onClick={onToggle}
                  className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Events stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {events.map((event) => {
                const Icon = typeIcons[event.type] || Activity;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "rounded-md border-l-2 px-2.5 py-2",
                      severityColors[event.severity],
                      severityBg[event.severity],
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-3 h-3 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-foreground leading-tight">{event.message}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {event.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-3 py-2 shrink-0">
              <p className="text-[9px] text-muted-foreground text-center">
                Live market signals · Auto-updating
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
