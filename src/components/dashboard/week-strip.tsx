"use client";

import { Check } from "lucide-react";
import type { DailyHistoryEntry } from "@/lib/review/types";
import { cn } from "@/lib/utils";
import { DashCard } from "./stat-cards";

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

function weekdayLabel(date: string) {
  return WEEKDAY.format(new Date(`${date}T12:00:00Z`)).slice(0, 2);
}

/** Last seven days of XP as small bars; days that met the goal get a check. */
export function WeekStrip({ history, goal }: { history: DailyHistoryEntry[] | null; goal: number }) {
  const max = Math.max(goal, ...(history ?? []).map((entry) => entry.xp), 1);
  const activeDays = (history ?? []).filter((entry) => entry.xp > 0).length;

  return (
    <DashCard labelledBy="week-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="week-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Last 7 days
        </h2>
        {history && <p className="text-sm font-semibold text-slate-600">{activeDays}/7 active days</p>}
      </div>
      {history ? (
        <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="XP per day">
          {history.map((entry, index) => {
            const isToday = index === history.length - 1;
            const height = entry.xp === 0 ? 6 : Math.max(14, Math.round((entry.xp / max) * 64));
            return (
              <li key={entry.date} className="flex flex-col items-center gap-1" aria-label={`${entry.date}: ${entry.xp} XP${entry.goalMet ? ", goal met" : ""}`}>
                <div className="flex h-16 w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-[2rem] rounded-lg",
                      entry.goalMet ? "bg-gradient-to-t from-emerald-500 to-lime-400" : entry.xp > 0 ? "bg-indigo-400" : "bg-slate-200"
                    )}
                    style={{ height }}
                  />
                </div>
                <span className={cn("text-[11px] font-bold", isToday ? "text-indigo-600" : "text-slate-500")}>
                  {isToday ? "Today" : weekdayLabel(entry.date)}
                </span>
                <span className="flex h-4 items-center text-[10px] tabular-nums text-slate-400">
                  {entry.goalMet ? <Check aria-hidden className="h-3.5 w-3.5 text-emerald-600" /> : entry.xp > 0 ? entry.xp : ""}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-3 h-24 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
      )}
    </DashCard>
  );
}
