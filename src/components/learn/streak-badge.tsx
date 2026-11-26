import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StreakBadgeProps {
  /** Current streak in days. */
  streak: number;
  /** Today already counts. When false the flame is dimmed. */
  todayDone?: boolean;
  /** Streak will be lost unless the learner practises today; adds a gentle nudge style. */
  atRisk?: boolean;
  surface?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}

export function StreakBadge({ streak, todayDone = true, atRisk = false, surface = "dark", size = "md", className }: StreakBadgeProps) {
  const days = Math.max(0, Math.floor(streak));
  const lit = days > 0 && todayDone;
  const label = days === 0 ? "No streak yet" : `${days}-day streak${atRisk ? ", practise today to keep it" : ""}`;

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        surface === "dark" ? "bg-white/10 text-white" : "bg-orange-50 text-orange-700",
        atRisk && "ring-2 ring-amber-400/70",
        className
      )}
    >
      <Flame
        aria-hidden
        className={cn(
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          lit ? "fill-orange-400 text-orange-400" : surface === "dark" ? "text-white/40" : "text-orange-300"
        )}
      />
      {days}
    </span>
  );
}
