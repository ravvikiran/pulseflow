import React, { useState } from "react";
import { ScanSearch, Plus, Pencil, Copy, Trash2, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { SettingsSection, SettingsCard, SettingsRow, NumberInput } from "./SettingsSection";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PresetConfig {
  ema1: number;
  ema2: number;
  ema3: number;
  volumeMultiplier: number;
  breakoutThreshold: number;
  rsMin: number;
  rsMax: number;
  trendStrengthMin: number;
  scanType: string;
  timeframe: string;
  sector?: string;
  assetType?: string;
}

interface ScannerPreset {
  id: number;
  name: string;
  config: PresetConfig;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ScannerConfigSectionProps {
  prefs: Record<string, unknown>;
  presets: ScannerPreset[];
  onUpdate: (updates: Record<string, unknown>) => void;
  onPresetsChange: () => void;
  isSaving: boolean;
}

const DEFAULT_PRESET_FORM = {
  name: "",
  ema1: 20,
  ema2: 50,
  ema3: 200,
  volumeMultiplier: 2.0,
  breakoutThreshold: 2.0,
  rsMin: 0,
  rsMax: 100,
  trendStrengthMin: 50,
  scanType: "ema_alignment",
  timeframe: "1D",
};

type PresetForm = typeof DEFAULT_PRESET_FORM;

function PresetFormCard({
  initial,
  onSave,
  onCancel,
  isSaving,
  title,
}: {
  initial: PresetForm;
  onSave: (data: PresetForm) => void;
  onCancel: () => void;
  isSaving: boolean;
  title: string;
}) {
  const [form, setForm] = useState<PresetForm>(initial);
  const set = (key: keyof PresetForm, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="bg-card/80 border border-cyan-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-cyan-400">{title}</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Preset Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Swing Trade Setup"
          className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* EMA Values */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">EMA Configuration</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "ema1" as const, label: "EMA Short" },
            { key: "ema2" as const, label: "EMA Mid" },
            { key: "ema3" as const, label: "EMA Long" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
              <input
                type="number"
                value={form[key]}
                min={1}
                max={500}
                onChange={(e) => set(key, Number(e.target.value))}
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thresholds</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "volumeMultiplier" as const, label: "Volume Multiplier", step: 0.1, min: 1, max: 20 },
            { key: "breakoutThreshold" as const, label: "Breakout Threshold %", step: 0.1, min: 0.1, max: 20 },
            { key: "trendStrengthMin" as const, label: "Min Trend Strength", step: 1, min: 0, max: 100 },
          ].map(({ key, label, step, min, max }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
              <input
                type="number"
                value={form[key]}
                min={min}
                max={max}
                step={step}
                onChange={(e) => set(key, Number(e.target.value))}
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* RS Filter */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Relative Strength Filter</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">RS Min</label>
            <input
              type="number"
              value={form.rsMin}
              min={0}
              max={100}
              onChange={(e) => set("rsMin", Number(e.target.value))}
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">RS Max</label>
            <input
              type="number"
              value={form.rsMax}
              min={0}
              max={100}
              onChange={(e) => set("rsMax", Number(e.target.value))}
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Preset
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ScannerConfigSection({ prefs, presets, onUpdate, onPresetsChange, isSaving }: ScannerConfigSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMutation = trpc.settings.createScannerPreset.useMutation({
    onSuccess: () => {
      onPresetsChange();
      setShowCreateForm(false);
      toast.success("Preset created", { description: "Your scanner preset has been saved." });
    },
    onError: (e) => toast.error("Failed to create preset", { description: e.message }),
  });

  const updateMutation = trpc.settings.updateScannerPreset.useMutation({
    onSuccess: () => {
      onPresetsChange();
      setEditingId(null);
      toast.success("Preset updated");
    },
    onError: (e) => toast.error("Failed to update preset", { description: e.message }),
  });

  const deleteMutation = trpc.settings.deleteScannerPreset.useMutation({
    onSuccess: () => {
      onPresetsChange();
      toast.success("Preset deleted");
    },
    onError: (e) => toast.error("Failed to delete preset", { description: e.message }),
  });

  const setDefaultMutation = trpc.settings.duplicateScannerPreset.useMutation({
    onSuccess: () => {
      onPresetsChange();
      toast.success("Default preset updated");
    },
    onError: (e: { message: string }) => toast.error("Failed to set default", { description: e.message }),
  });

  const handleDuplicate = (preset: ScannerPreset) => {
    createMutation.mutate({
      name: `${preset.name} (Copy)`,
      config: preset.config,
    });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <SettingsSection
      title="Scanner Configuration"
      description="Customize scanner rules, EMA values, and save reusable scan presets."
      icon={ScanSearch}
      accentClass="text-cyan-400"
      bgClass="bg-cyan-500/10"
    >
      {/* Presets list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scanner Presets</p>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={showCreateForm || isMutating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-medium rounded-lg border border-cyan-500/30 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            New Preset
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <PresetFormCard
            initial={DEFAULT_PRESET_FORM}
            onSave={(data) => createMutation.mutate({ name: data.name, config: { ema1: data.ema1, ema2: data.ema2, ema3: data.ema3, volumeMultiplier: data.volumeMultiplier, breakoutThreshold: data.breakoutThreshold, rsMin: data.rsMin, rsMax: data.rsMax, trendStrengthMin: data.trendStrengthMin, scanType: data.scanType, timeframe: data.timeframe } })}
            onCancel={() => setShowCreateForm(false)}
            isSaving={createMutation.isPending}
            title="Create New Preset"
          />
        )}

        {/* Preset cards */}
        {presets.length === 0 && !showCreateForm && (
          <div className="bg-card/30 border border-border/40 rounded-xl p-8 text-center">
            <ScanSearch className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scanner presets yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create your first preset to save custom scanner configurations.</p>
          </div>
        )}

        {presets.map((preset) => {
          const isExpanded = expandedId === preset.id;
          const isEditing = editingId === preset.id;

          if (isEditing) {
            return (
              <PresetFormCard
                key={preset.id}
                initial={{
                  name: preset.name,
                  ema1: preset.config.ema1,
                  ema2: preset.config.ema2,
                  ema3: preset.config.ema3,
                  volumeMultiplier: preset.config.volumeMultiplier,
                  breakoutThreshold: preset.config.breakoutThreshold,
                  rsMin: preset.config.rsMin,
                  rsMax: preset.config.rsMax,
                  trendStrengthMin: preset.config.trendStrengthMin,
                  scanType: preset.config.scanType,
                  timeframe: preset.config.timeframe,
                }}
                onSave={(data) => updateMutation.mutate({ id: preset.id, name: data.name, config: { ema1: data.ema1, ema2: data.ema2, ema3: data.ema3, volumeMultiplier: data.volumeMultiplier, breakoutThreshold: data.breakoutThreshold, rsMin: data.rsMin, rsMax: data.rsMax, trendStrengthMin: data.trendStrengthMin, scanType: data.scanType, timeframe: data.timeframe } })}
                onCancel={() => setEditingId(null)}
                isSaving={updateMutation.isPending}
                title="Edit Preset"
              />
            );
          }

          return (
            <div
              key={preset.id}
              className={cn(
                "bg-card/50 border rounded-xl overflow-hidden transition-all",
                preset.isDefault ? "border-cyan-500/40" : "border-border/50"
              )}
            >
              {/* Preset header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={cn("w-2 h-2 rounded-full shrink-0", preset.isDefault ? "bg-cyan-400" : "bg-muted-foreground/30")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{preset.name}</p>
                    {preset.isDefault && (
                      <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-1.5 py-0.5 rounded-md font-medium shrink-0">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    EMA {preset.config.ema1}/{preset.config.ema2}/{preset.config.ema3} · Vol ×{preset.config.volumeMultiplier} · RS {preset.config.rsMin}–{preset.config.rsMax}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!preset.isDefault && (
                    <button
                      onClick={() => setDefaultMutation.mutate({ id: preset.id })}
                      disabled={isMutating}
                      title="Set as default"
                      className="p-1.5 text-muted-foreground hover:text-cyan-400 transition-colors rounded-md hover:bg-cyan-500/10"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(preset.id)}
                    disabled={isMutating}
                    title="Edit"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(preset)}
                    disabled={isMutating}
                    title="Duplicate"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: preset.id })}
                    disabled={isMutating}
                    title="Delete"
                    className="p-1.5 text-muted-foreground hover:text-rose-400 transition-colors rounded-md hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "EMA Short", value: preset.config.ema1 },
                      { label: "EMA Mid", value: preset.config.ema2 },
                      { label: "EMA Long", value: preset.config.ema3 },
                      { label: "Volume ×", value: preset.config.volumeMultiplier },
                      { label: "Breakout %", value: `${preset.config.breakoutThreshold}%` },
                      { label: "Trend Min", value: preset.config.trendStrengthMin },
                      { label: "RS Min", value: preset.config.rsMin },
                      { label: "RS Max", value: preset.config.rsMax },
                    ].map((item) => (
                      <div key={item.label} className="bg-muted/30 rounded-lg p-2">
                        <p className="text-muted-foreground/70">{item.label}</p>
                        <p className="font-semibold text-foreground mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-xl p-3.5 mt-2">
        <p className="text-xs text-cyan-400/80">
          <strong className="text-cyan-400">Tip:</strong> The default preset is automatically applied when you open the Scanner. You can override it per-scan session without changing the saved default.
        </p>
      </div>
    </SettingsSection>
  );
}
