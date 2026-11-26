"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { StarRating } from "@/components/learn";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PathUnit } from "@/lib/lesson/api-types";
import { cn } from "@/lib/utils";

export interface UnitNodeProps {
  unit: PathUnit;
  isCurrent: boolean;
  isSelected: boolean;
  offset: number;
  onSelect: () => void;
}

/** One stop on the path: emoji medallion, state ring, stars and a "Start"/"Continue" bubble when current. */
export function UnitNode({ unit, isCurrent, isSelected, offset, onSelect }: UnitNodeProps) {
  const reduceMotion = usePrefersReducedMotion();
  const locked = !unit.unlocked;
  const status = locked ? "locked" : unit.completed ? "completed" : unit.inProgress !== null ? "in progress" : "not started";

  return (
    <div className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      {isCurrent && (
        <motion.span
          aria-hidden
          className="mb-2 rounded-xl bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-indigo-700 shadow-lg"
          animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {unit.inProgress !== null ? "Continue" : unit.completed ? "Replay" : "Start"}
        </motion.span>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`${unit.title}: ${status}${unit.completed ? `, ${unit.stars} of 3 stars` : ""}`}
        className={cn(
          "relative flex h-[76px] w-[76px] items-center justify-center rounded-full border-b-[6px] text-4xl transition",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 motion-safe:active:translate-y-0.5 motion-safe:active:border-b-2",
          unit.completed && "border-orange-700 bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-900/30",
          !unit.completed && !locked && isCurrent && "border-indigo-300 bg-white shadow-xl shadow-indigo-950/40",
          !unit.completed && !locked && !isCurrent && "border-indigo-900/60 bg-indigo-400/40",
          locked && "border-black/30 bg-white/10",
          isSelected && "ring-4 ring-white/90 ring-offset-2 ring-offset-transparent"
        )}
      >
        {isCurrent && !reduceMotion && <span aria-hidden className="absolute inset-0 rounded-full ring-4 ring-white/50 motion-safe:animate-ping" />}
        <span aria-hidden className={cn(locked && "opacity-40 grayscale")}>
          {unit.emoji}
        </span>
        {locked && (
          <span aria-hidden className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white shadow">
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}
        {unit.inProgress !== null && !unit.completed && (
          <span aria-hidden className="absolute -bottom-1 -right-1 rounded-full bg-sky-400 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow">
            {Math.round(unit.inProgress * 100)}%
          </span>
        )}
      </button>
      <div className="mt-2 flex h-10 flex-col items-center">
        {unit.completed ? <StarRating stars={unit.stars} size="sm" surface="dark" /> : null}
        <span className={cn("max-w-[9rem] truncate text-center text-sm font-semibold", locked ? "text-white/50" : "text-white/90")}>{unit.title}</span>
      </div>
    </div>
  );
}
