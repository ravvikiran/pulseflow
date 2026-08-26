import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Trophy, Flame, Target, TrendingUp, Star } from "lucide-react";

// ─── Confetti Particle System ─────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  shape: "circle" | "square" | "star";
}

const CONFETTI_COLORS = [
  "oklch(0.68 0.18 155)", // green/bull
  "oklch(0.60 0.20 250)", // blue/primary
  "oklch(0.72 0.18 80)",  // amber
  "oklch(0.62 0.22 300)", // purple
  "oklch(0.65 0.20 30)",  // orange
  "oklch(0.70 0.15 200)", // cyan
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 30,
    y: 40,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 15,
    velocityY: -(5 + Math.random() * 10),
    shape: (["circle", "square", "star"] as const)[Math.floor(Math.random() * 3)],
  }));
}

export function ConfettiExplosion({ onComplete }: { onComplete?: () => void }) {
  const [particles] = useState(() => generateParticles(40));

  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : p.shape === "star" ? "2px" : "1px",
          }}
          initial={{
            scale: 0,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            x: p.velocityX * 30,
            y: [0, p.velocityY * 20, 300],
            scale: [0, 1.2, 0.8],
            rotate: p.rotation + Math.random() * 720,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.5 + Math.random() * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Achievement Toast ────────────────────────────────────────────────────────
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: "trophy" | "flame" | "target" | "trending" | "star";
  tier: "bronze" | "silver" | "gold";
}

const ACHIEVEMENT_ICONS = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  trending: TrendingUp,
  star: Star,
};

const TIER_STYLES = {
  bronze: "from-amber-800/30 to-amber-600/10 border-amber-600/40 text-amber-400",
  silver: "from-slate-400/20 to-slate-300/10 border-slate-400/40 text-slate-300",
  gold: "from-yellow-500/20 to-amber-400/10 border-yellow-400/40 text-yellow-400",
};

export function AchievementToast({
  achievement,
  onDismiss,
}: {
  achievement: Achievement;
  onDismiss: () => void;
}) {
  const Icon = ACHIEVEMENT_ICONS[achievement.icon];

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      className={cn(
        "fixed top-20 right-4 z-[150] w-80 rounded-lg border p-4",
        "bg-gradient-to-br backdrop-blur-lg shadow-2xl",
        TIER_STYLES[achievement.tier]
      )}
      initial={{ x: 400, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 400, opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex items-start gap-3">
        <motion.div
          className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center shrink-0"
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Achievement Unlocked
            </span>
          </div>
          <h4 className="text-sm font-bold mt-0.5">{achievement.title}</h4>
          <p className="text-xs opacity-70 mt-0.5">{achievement.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Achievement Provider Hook ────────────────────────────────────────────────
// Pre-defined achievements for the trading platform
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_watchlist", title: "Watchful Eye", description: "Created your first watchlist", icon: "star", tier: "bronze" },
  { id: "first_alert", title: "Alert Guardian", description: "Set up your first price alert", icon: "target", tier: "bronze" },
  { id: "scanner_pro", title: "Scanner Pro", description: "Ran 10 different scans", icon: "trending", tier: "silver" },
  { id: "journal_streak_3", title: "Consistent Trader", description: "3-day trade journal streak", icon: "flame", tier: "bronze" },
  { id: "journal_streak_7", title: "Week Warrior", description: "7-day trade journal streak", icon: "flame", tier: "silver" },
  { id: "journal_streak_30", title: "Trading Machine", description: "30-day trade journal streak", icon: "flame", tier: "gold" },
  { id: "multi_market", title: "Global Vision", description: "Explored all 3 market modules", icon: "trophy", tier: "silver" },
  { id: "pattern_master", title: "Pattern Master", description: "Identified 50 chart patterns", icon: "trophy", tier: "gold" },
];

export function useAchievements() {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("pulseflow_achievements");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [pendingAchievement, setPendingAchievement] = useState<Achievement | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const unlock = useCallback((achievementId: string) => {
    if (unlockedIds.has(achievementId)) return;

    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;

    setUnlockedIds(prev => {
      const next = new Set(prev);
      next.add(achievementId);
      localStorage.setItem("pulseflow_achievements", JSON.stringify([...next]));
      return next;
    });

    setPendingAchievement(achievement);
    setShowConfetti(true);
  }, [unlockedIds]);

  const dismissAchievement = useCallback(() => {
    setPendingAchievement(null);
  }, []);

  const dismissConfetti = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return {
    unlockedIds,
    unlock,
    pendingAchievement,
    showConfetti,
    dismissAchievement,
    dismissConfetti,
    totalAchievements: ACHIEVEMENTS.length,
    unlockedCount: unlockedIds.size,
  };
}

// ─── Achievement Display Component ───────────────────────────────────────────
export function AchievementOverlay() {
  const { pendingAchievement, showConfetti, dismissAchievement, dismissConfetti } = useAchievements();

  return (
    <>
      {showConfetti && <ConfettiExplosion onComplete={dismissConfetti} />}
      <AnimatePresence>
        {pendingAchievement && (
          <AchievementToast
            achievement={pendingAchievement}
            onDismiss={dismissAchievement}
          />
        )}
      </AnimatePresence>
    </>
  );
}
