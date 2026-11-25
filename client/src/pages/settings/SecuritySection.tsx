import { Shield } from "lucide-react";
import { SettingsSection, SettingsCard } from "./SettingsSection";

interface SecuritySectionProps {
  prefs: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
  isSaving?: boolean;
}

/**
 * PulseFlow is a single-user local tool: it has no accounts, passwords,
 * sessions or two-factor login. This section says so instead of showing
 * controls that don't do anything.
 */
export function SecuritySection(_props: SecuritySectionProps) {
  return (
    <SettingsSection
      title="Security"
      description="How PulseFlow protects your data."
      icon={Shield}
      accentClass="text-rose-400"
      bgClass="bg-rose-500/10"
    >
      <SettingsCard>
        <div className="py-4 space-y-3 text-sm text-muted-foreground">
          <p>
            PulseFlow runs as a local, single-user application. There are no accounts, passwords, login sessions
            or two-factor settings to manage.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Your watchlists, alerts and trade journal stay on your machine (journal file and optional MySQL database).</li>
            <li>Market data is fetched from public sources; no API keys or credentials are stored.</li>
            <li>If you expose the app beyond localhost, put it behind an authenticating reverse proxy and set <code>CRON_API_KEY</code>.</li>
          </ul>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
