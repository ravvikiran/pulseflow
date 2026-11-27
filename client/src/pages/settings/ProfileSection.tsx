import { User } from "lucide-react";
import { SettingsSection, SettingsCard } from "./SettingsSection";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProfileSectionProps {
  prefs: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
  isSaving?: boolean;
  user?: {
    id: number;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    role: string;
    createdAt: Date;
  } | null;
}

/**
 * PulseFlow has no accounts: it runs as one local user. This section shows that
 * profile read-only. Nothing here can be edited because nothing would store it.
 */
export function ProfileSection({ user: userProp }: ProfileSectionProps) {
  const { user: authUser } = useAuth();
  const user = userProp ?? authUser;
  const name = user?.name ?? "Local User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SettingsSection
      title="User Profile"
      description="The local profile this copy of PulseFlow runs as."
      icon={User}
      accentClass="text-violet-400"
      bgClass="bg-violet-500/10"
    >
      <SettingsCard>
        <div className="flex items-center gap-5 py-4">
          <div
            aria-hidden
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-500/20 shrink-0"
          >
            {initials}
          </div>
          <dl className="space-y-2.5 min-w-0">
            <div>
              <dt className="text-xs text-muted-foreground font-medium">Name</dt>
              <dd className="text-sm font-semibold text-foreground">{name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-medium">Sign-in</dt>
              <dd className="text-sm text-foreground">None. This is a local, single-user app.</dd>
            </div>
          </dl>
        </div>
      </SettingsCard>

      <p className="px-1 text-xs text-muted-foreground">
        There is no subscription or online account. Market data refreshes automatically from Yahoo Finance and other public sources.
      </p>
    </SettingsSection>
  );
}
