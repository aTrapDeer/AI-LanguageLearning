"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const GOAL_NAMES: Record<number, string> = { 10: "Casual", 20: "Regular", 30: "Serious", 50: "Intense" };

/** Segmented choice of daily XP goal. Saving closes it from the parent. */
export function GoalPicker({
  options,
  current,
  saving,
  onPick,
}: {
  options: number[];
  current: number;
  saving: boolean;
  onPick: (goal: number) => void;
}) {
  return (
    <div className="mt-4 border-t border-ink-900/[0.07] pt-4">
      <p id="goal-picker-label" className="text-sm font-semibold text-ink-900">
        How much a day?
      </p>
      <div role="radiogroup" aria-labelledby="goal-picker-label" className="mt-2 grid grid-cols-2 gap-2 min-[440px]:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const active = option === current;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => onPick(option)}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 disabled:opacity-60",
                active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-900/10 bg-paper text-ink-900 hover:border-ink-900/30"
              )}
            >
              <span className="text-sm font-bold">{GOAL_NAMES[option] ?? "Custom"}</span>
              <span className={cn("font-mono text-[11px] tabular-nums", active ? "text-white/70" : "text-ink-500")}>{option} XP/day</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 flex h-5 items-center gap-1.5 text-xs text-ink-500">
        {saving && (
          <>
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Saving…
          </>
        )}
      </p>
    </div>
  );
}
