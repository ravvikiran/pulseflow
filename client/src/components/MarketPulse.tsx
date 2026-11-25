import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Zap, AlertTriangle,
  BarChart3, Activity, Volume2, X, ChevronLeft, ChevronRight,
} from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  breakout: TrendingUp,
  volume_spike: Volume2,
  trend_change: Activity,
  alert: AlertTriangle,
  momentum: Zap,
};

const severityColors: Record<string, string> = {
  info: "border-l-info text-info",
  warning: "border-l-warning text-warning",
  success: "border-l-success text-success",
};

const severityBg: Record<string, string> = {
  info: "bg-primary/5",
  warning: "bg-warning-subtle",
  success: "bg-success-subtle",
};

/**
 * Full-height right-side panel that continuously shows market events.
 * Events accumulate over time and auto-scroll to the latest.
 */
export function MarketPulsePanel({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  // Real signals from the server: big movers plus live volume-spike and 52-week-high scans.
  const { data, isLoading, isError } = trpc.global.pulse.useQuery(undefined, {
    enabled: isOpen,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const events = data ?? [];

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40 w-6 h-16 rounded-l-md border border-r-0 border-border bg-card flex items-center justify-center hover:bg-accent transition-colors focus-ring",
          isOpen && "hidden"
        )}
        title="Open Market Pulse"
        aria-label="Open Market Pulse panel"
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
                <span className="text-3xs text-muted-foreground tabular-nums">{events.length} signals</span>
                <button
                  onClick={onToggle}
                  aria-label="Close Market Pulse panel"
                  className="p-2 -m-0.5 rounded hover:bg-accent text-muted-foreground transition-colors focus-ring"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Events stream */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {isLoading && <p className="text-2xs text-muted-foreground text-center py-6">Scanning markets...</p>}
              {isError && <p className="text-2xs text-muted-foreground text-center py-6">Signals are unavailable right now.</p>}
              {!isLoading && !isError && events.length === 0 && (
                <p className="text-2xs text-muted-foreground text-center py-6">No notable signals at the moment.</p>
              )}
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
                        <p className="text-2xs font-medium text-foreground leading-tight">{event.message}</p>
                        <p className="text-3xs text-muted-foreground mt-0.5">
                          {event.domain.toUpperCase()} · {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-3 py-2 shrink-0">
              <p className="text-3xs text-muted-foreground text-center">
                Calculated from live Yahoo Finance data · refreshes every minute
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
