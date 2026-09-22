import { useEffect, useRef, useState } from "react";
import type { ReactNode, ElementType } from "react";

/**
 * A simpler animated counter using requestAnimationFrame for smooth counting
 */
export function CountUp({
  end,
  start = 0,
  duration = 1000,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  separator = ",",
}: {
  end: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  separator?: string;
}) {
  const [displayValue, setDisplayValue] = useState(start);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const prevEndRef = useRef(start);

  useEffect(() => {
    const fromValue = prevEndRef.current;
    prevEndRef.current = end;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromValue + (end - fromValue) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  const formatNumber = (num: number) => {
    const fixed = num.toFixed(decimals);
    if (!separator) return `${prefix}${fixed}${suffix}`;

    const [intPart, decPart] = fixed.split(".");
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${formatted}${decPart ? "." + decPart : ""}${suffix}`;
  };

  return <span className={className}>{formatNumber(displayValue)}</span>;
}

/**
 * AnimatedNumber using requestAnimationFrame for smooth transitions
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const rafRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / 800, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (value - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <span className={className}>{prefix}{displayValue.toFixed(decimals)}{suffix}</span>;
}

/**
 * useFlashChange — returns a CSS class that briefly flashes when `value`
 * changes, tinted green if it rose and red if it fell. The class clears
 * itself after the 300ms animation so it re-triggers on the next change.
 * Honors prefers-reduced-motion (the CSS animation is neutralized globally).
 */
export function useFlashChange(value: number | undefined | null): string {
  const prevRef = useRef<number | undefined | null>(value);
  const [flash, setFlash] = useState<"" | "animate-flash-up" | "animate-flash-down">("");

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev == null || value == null || prev === value) return;
    setFlash(value > prev ? "animate-flash-up" : "animate-flash-down");
    const t = setTimeout(() => setFlash(""), 320);
    return () => clearTimeout(t);
  }, [value]);

  return flash;
}

/**
 * FlashOnChange — wraps content and flashes its background when `value`
 * changes. Use for live table rows / numbers that update on refetch.
 */
export function FlashOnChange({
  value,
  children,
  className = "",
  as: Tag = "div",
}: {
  value: number | undefined | null;
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  const flash = useFlashChange(value);
  return <Tag className={`${className} ${flash} rounded-sm`.trim()}>{children}</Tag>;
}
