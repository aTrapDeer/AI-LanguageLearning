"use client";

import { Zap } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

export interface XpPillProps {
  xp: number;
  /** Animate from this value to `xp` (e.g. the total before a lesson). Omit for no animation. */
  from?: number;
  /** Prefix with "+" (for gains). */
  showPlus?: boolean;
  /** Suffix text, default "XP". */
  unit?: string;
  surface?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}

export function XpPill({ xp, from, showPlus = false, unit = "XP", surface = "dark", size = "md", className }: XpPillProps) {
  const value = useCountUp(Math.max(0, Math.round(xp)), { from: from ?? xp, durationMs: from === undefined ? 0 : 900 });

  return (
    <span
      aria-label={`${showPlus ? "+" : ""}${Math.round(xp)} ${unit}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        surface === "dark" ? "bg-white/10 text-white" : "bg-amber-50 text-amber-700",
        className
      )}
    >
      <Zap aria-hidden className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", "fill-amber-300 text-amber-300")} />
      <span aria-hidden>
        {showPlus ? "+" : ""}
        {value.toLocaleString()} {unit}
      </span>
    </span>
  );
}
