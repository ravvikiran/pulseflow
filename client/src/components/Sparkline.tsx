import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: "bull" | "bear" | "primary" | "auto";
  strokeWidth?: number;
  showArea?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  className,
  color = "auto",
  strokeWidth = 1.5,
  showArea = true,
}: SparklineProps) {
  const { path, areaPath, resolvedColor } = useMemo(() => {
    if (!data || data.length < 2) return { path: "", areaPath: "", resolvedColor: "primary" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    const points = data.map((value, index) => ({
      x: padding + (index / (data.length - 1)) * effectiveWidth,
      y: padding + effectiveHeight - ((value - min) / range) * effectiveHeight,
    }));

    // Build SVG path with smooth curves
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      linePath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Area path (close to bottom)
    const area = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    // Determine color
    let resolvedColor: string;
    if (color === "auto") {
      resolvedColor = data[data.length - 1] >= data[0] ? "bull" : "bear";
    } else {
      resolvedColor = color;
    }

    return { path: linePath, areaPath: area, resolvedColor };
  }, [data, width, height, color]);

  if (!data || data.length < 2) return null;

  const colorMap: Record<string, { stroke: string; fill: string }> = {
    bull: { stroke: "var(--color-bull)", fill: "oklch(0.68 0.18 155 / 0.1)" },
    bear: { stroke: "var(--color-bear)", fill: "oklch(0.58 0.22 25 / 0.1)" },
    primary: { stroke: "var(--color-primary)", fill: "oklch(0.60 0.20 250 / 0.1)" },
  };

  const colors = colorMap[resolvedColor] || colorMap.primary;

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && (
        <path
          d={areaPath}
          fill={colors.fill}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Generate mock sparkline data (for demo/loading states)
 */
export function generateSparklineData(length: number = 20, trend: "up" | "down" | "neutral" = "neutral"): number[] {
  const data: number[] = [];
  let value = 50 + Math.random() * 50;

  for (let i = 0; i < length; i++) {
    const trendBias = trend === "up" ? 0.3 : trend === "down" ? -0.3 : 0;
    value += (Math.random() - 0.5 + trendBias) * 5;
    value = Math.max(10, Math.min(100, value));
    data.push(value);
  }

  return data;
}
