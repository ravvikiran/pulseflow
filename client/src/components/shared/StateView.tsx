import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StateViewProps {
  /** Icon element (defaults per variant). Pass a lucide icon element. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary action, e.g. a retry button for error states. */
  action?: ReactNode;
  variant?: "empty" | "error";
  className?: string;
  /** Vertical padding preset — match the surrounding container. */
  size?: "sm" | "md" | "lg";
}

const PAD = { sm: "py-8", md: "py-12", lg: "py-16" } as const;

/**
 * StateView — the one place empty / error states are rendered, so every
 * data view is deliberate instead of blank. Error variant tints the icon
 * with the danger color and is meant to carry a retry action.
 */
export function StateView({
  icon, title, description, action, variant = "empty", className, size = "md",
}: StateViewProps) {
  const defaultIcon = variant === "error"
    ? <AlertTriangle className="w-10 h-10 text-danger/60" />
    : <Inbox className="w-10 h-10 text-muted-foreground/30" />;

  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-4", PAD[size], className)} role={variant === "error" ? "alert" : undefined}>
      <div className="mb-3">{icon ?? defaultIcon}</div>
      <div className={cn("text-sm font-medium", variant === "error" ? "text-foreground" : "text-muted-foreground")}>{title}</div>
      {description && <div className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * QueryErrorState — convenience wrapper for a failed react-query with a
 * retry button. Pass the query's refetch and isRefetching.
 */
export function QueryErrorState({
  onRetry, isRetrying, title = "Couldn't load data", description = "Something went wrong fetching this data. Check your connection and try again.", size,
}: {
  onRetry: () => void;
  isRetrying?: boolean;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <StateView
      variant="error"
      size={size}
      title={title}
      description={description}
      action={
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
          Retry
        </Button>
      }
    />
  );
}
