"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface DailyGoalRingProps {
  /** XP earned today. */
  xp: number;
  goal: number;
  /** Diameter in px. */
  size?: number;
  strokeWidth?: number;
  /** Show "12/30" under the ring. */
  showLabel?: boolean;
  surface?: "dark" | "light";
  /** Replaces the percentage/check in the middle (e.g. a large XP count on the dashboard). */
  center?: ReactNode;
  className?: string;
}

export function DailyGoalRing({ xp, goal, size = 48, strokeWidth = 5, showLabel = false, surface = "dark", center, className }: DailyGoalRingProps) {
  const reduceMotion = usePrefersReducedMotion();
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.min(1, Math.max(0, xp / safeGoal));
  const reached = xp >= safeGoal;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const label = reached ? `Daily goal reached: ${xp} of ${goal} XP` : `Daily goal: ${xp} of ${goal} XP`;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)} role="img" aria-label={label} title={label}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={surface === "dark" ? "stroke-white/15" : "stroke-slate-200"}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference * (1 - ratio) }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 18 }}
            className={reached ? "stroke-emerald-400" : "stroke-amber-400"}
          />
        </svg>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold tabular-nums",
            size < 56 ? "text-[10px]" : "text-xs",
            surface === "dark" ? "text-white" : "text-slate-700"
          )}
        >
          {center ?? (reached ? <Check className="h-1/2 w-1/2 text-emerald-400" /> : `${Math.round(ratio * 100)}%`)}
        </span>
      </div>
      {showLabel && (
        <span aria-hidden className={cn("text-xs tabular-nums", surface === "dark" ? "text-white/80" : "text-slate-600")}>
          {Math.min(xp, goal)}/{goal} XP
        </span>
      )}
    </div>
  );
}
