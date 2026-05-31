import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  accentClass?: string;
  bgClass?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  accentClass = "text-indigo-400",
  bgClass = "bg-indigo-500/10",
  children,
}: SettingsSectionProps) {
  return (
    <section className="space-y-5">
      {/* Section header */}
      <div className="flex items-start gap-3 pb-4 border-b border-border/50">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", bgClass)}>
          <Icon className={cn("w-5 h-5", accentClass)} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsRow({ label, description, children, className }: SettingsRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-6 py-3.5 border-b border-border/30 last:border-0", className)}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn("bg-card/50 border border-border/50 rounded-xl px-4 divide-y divide-border/30", className)}>
      {children}
    </div>
  );
}

// Toggle switch component
interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  accentClass?: string;
}

export function Toggle({ checked, onChange, disabled, accentClass = "bg-indigo-500" }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        checked ? accentClass : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// Select dropdown
interface SelectFieldProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

export function SelectField({ value, onChange, options, disabled, className }: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50",
        "transition-colors cursor-pointer min-w-[140px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// Number input
interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, min, max, step = 1, suffix, disabled }: NumberInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className={cn(
          "bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground w-24",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

// Text input
interface TextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TextInput({ value, onChange, placeholder, disabled, className }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-muted-foreground/50",
        "transition-colors w-56",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    />
  );
}

// Sensitivity slider
interface SensitivitySliderProps {
  value: "low" | "medium" | "high";
  onChange: (val: "low" | "medium" | "high") => void;
}

export function SensitivitySlider({ value, onChange }: SensitivitySliderProps) {
  const levels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
  const levelColors = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-rose-500" };
  const levelIdx = levels.indexOf(value);

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {levels.map((level, i) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all border",
              value === level
                ? `${levelColors[level]} text-white border-transparent`
                : "bg-muted/50 text-muted-foreground border-border/40 hover:border-border"
            )}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
