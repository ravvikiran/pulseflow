import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Zap, AlertTriangle,
  BarChart3, Activity, Volume2,
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
  { type: "breakout" as const, messages: ["{symbol} broke 52-week high", "{symbol} testing resistance at ATH"], severity: "success" as const },
  { type: "volume_spike" as const, messages: ["{symbol} volume 3x average", "{symbol} unusual volume detected"], severity: "warning" as const },
  { type: "trend_change" as const, messages: ["{symbol} EMA crossover (bullish)", "{symbol} RSI entering oversold"], severity: "info" as const },
  { type: "momentum" as const, messages: ["{symbol} momentum accelerating", "{symbol} relative strength +5"], severity: "success" as const },
];

const SYMBOLS = ["RELIANCE", "TCS", "INFY", "BTC", "ETH", "SOL", "AAPL", "NVDA", "HDFCBANK", "ICICIBANK"];

function generateEvent(): PulseEvent {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
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
  info: "text-primary bg-primary/10 border-primary/20",
  warning: "text-neutral bg-neutral/10 border-neutral/20",
  success: "text-bull bg-bull/10 border-bull/20",
};

export function MarketPulse({ maxEvents = 5 }: { maxEvents?: number }) {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Generate initial events
    const initial = Array.from({ length: 3 }, () => generateEvent());
    setEvents(initial);

    // Add new events periodically
    intervalRef.current = setInterval(() => {
      setEvents(prev => {
        const newEvent = generateEvent();
        return [newEvent, ...prev].slice(0, maxEvents);
      });
    }, 8000 + Math.random() * 7000); // Random interval 8-15s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [maxEvents]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-live" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Market Pulse</h3>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {events.map((event) => {
            const Icon = typeIcons[event.type] || Activity;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, height: 0, x: -20 }}
                animate={{ opacity: 1, height: "auto", x: 0 }}
                exit={{ opacity: 0, height: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[10px]",
                  severityColors[event.severity]
                )}>
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1 font-medium">{event.message}</span>
                  <span className="text-muted-foreground shrink-0">
                    {event.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
