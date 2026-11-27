"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { DailyHistoryEntry } from "@/lib/review/types";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

function weekdayLabel(date: string) {
  return WEEKDAY.format(new Date(`${date}T12:00:00Z`));
}

/** Last seven days of XP as bars against a dashed goal line; days that met the goal glow ember. */
export function WeekChart({ history, goal }: { history: DailyHistoryEntry[] | null; goal: number }) {
  const reduceMotion = usePrefersReducedMotion();
  const max = Math.max(goal * 1.25, ...(history ?? []).map((entry) => entry.xp), 1);

  if (!history) {
    return (
      <div className="mt-4 h-[8.5rem] rounded-2xl bg-ink-50 motion-safe:animate-pulse lg:h-[10.5rem]" aria-busy="true" aria-label="Loading the last 7 days" />
    );
  }

  const percent = (xp: number) => Math.min(100, (xp / max) * 100);

  const empty = history.every((entry) => entry.xp === 0);

  return (
    <div className="relative">
      {empty && (
        <p className="absolute inset-x-0 top-[38%] z-10 text-center text-sm text-ink-600">
          <span className="rounded-full bg-white px-3 py-1">Your week fills up as you practise.</span>
        </p>
      )}
      <ol className="mt-4 grid grid-cols-7 gap-2" aria-label="XP per day, last 7 days">
        {history.map((entry, index) => {
          const isToday = index === history.length - 1;
          return (
            <li
              key={entry.date}
              className="relative flex flex-col items-center"
              aria-label={`${isToday ? "Today" : weekdayLabel(entry.date)}: ${entry.xp} XP${entry.goalMet ? ", goal met" : ""}`}
            >
              <div className="relative flex h-[5.5rem] w-full items-end justify-center lg:h-[7.5rem]">
                {/* Each column draws its own slice of the goal line, so the line spans the gaps too. */}
                <span aria-hidden className="absolute -inset-x-1 border-t border-dashed border-ember-400" style={{ bottom: `${percent(goal)}%` }} />
                <motion.div
                  className={cn(
                    "relative w-full max-w-[2.25rem] origin-bottom rounded-[0.6rem]",
                    entry.goalMet ? "bg-gradient-to-t from-ember-500 to-ember-300" : entry.xp > 0 ? "bg-ink-300" : "bg-ink-100",
                  )}
                  style={{ height: entry.xp === 0 ? 6 : `max(12px, ${percent(entry.xp)}%)` }}
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.1 + index * 0.05, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                />
              </div>
              <span className={cn("mt-2 text-xs font-semibold", isToday ? "text-ink-950" : "text-ink-500")}>
                {isToday ? "Today" : weekdayLabel(entry.date)}
              </span>
              <span aria-hidden className="h-4 font-mono text-[10px] tabular-nums text-ink-500">
                {entry.xp > 0 ? entry.xp : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
