"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface ProgressBarProps {
  /** 0..1 (values outside are clamped). */
  value: number;
  /** Accessible name, e.g. "Lesson progress". */
  label?: string;
  /** Colour of the fill. */
  tone?: "brand" | "success" | "warning";
  /** Background the bar sits on. */
  surface?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FILL: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  brand: "bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400",
  success: "bg-gradient-to-r from-emerald-400 to-lime-400",
  warning: "bg-gradient-to-r from-amber-400 to-orange-400",
};

const HEIGHT = { sm: "h-1.5", md: "h-2.5", lg: "h-4" } as const;

export function ProgressBar({ value, label = "Progress", tone = "brand", surface = "dark", size = "md", className }: ProgressBarProps) {
  const reduceMotion = usePrefersReducedMotion();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        surface === "dark" ? "bg-white/15" : "bg-slate-200",
        HEIGHT[size],
        className
      )}
    >
      <motion.div
        className={cn("h-full rounded-full", FILL[tone])}
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
