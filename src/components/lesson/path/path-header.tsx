"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DailyGoalRing, ProgressBar, StreakBadge, XpPill } from "@/components/learn";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { getLanguageConfig } from "@/lib/language-config";
import { getLevelInfo, MAX_LEVEL, MIN_LEVEL } from "@/lib/levels";

export interface PathHeaderProps {
  language: string;
  summary: LearnerSummary;
  viewLevel: number;
  completedInView: number;
  totalInView: number;
  onLevelChange: (level: number) => void;
}

/** Language, level + CEFR, level progress, streak, XP, today's goal and the level switcher. */
export function PathHeader({ language, summary, viewLevel, completedInView, totalInView, onLevelChange }: PathHeaderProps) {
  const config = getLanguageConfig(language);
  const info = getLevelInfo(viewLevel);
  const isCurrent = viewLevel === summary.level;

  return (
    <header className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-3xl">
            {config?.flag}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold leading-tight">{config?.name ?? language}</p>
            <p className="text-xs text-white/70">Your learning path</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StreakBadge streak={summary.streak.current} todayDone={summary.streak.todayDone} atRisk={summary.streak.atRisk} size="sm" />
          <XpPill xp={summary.totalXp} size="sm" />
          <DailyGoalRing xp={summary.today.xp} goal={summary.today.goal} size={36} strokeWidth={4} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onLevelChange(viewLevel - 1)}
          disabled={viewLevel <= MIN_LEVEL}
          aria-label="Previous level"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">
            {isCurrent ? "Your level" : viewLevel < summary.level ? "Earlier level" : "Coming up"}
          </p>
          <p className="truncate text-base font-extrabold">
            Level {info.level} · <span className="text-amber-300">{info.cefr}</span> {info.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLevelChange(viewLevel + 1)}
          disabled={viewLevel >= MAX_LEVEL}
          aria-label="Next level"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={totalInView ? completedInView / totalInView : 0} label={`Level ${viewLevel} progress`} tone="success" size="sm" />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-white/80">
          {completedInView}/{totalInView} units
        </span>
      </div>
      {viewLevel > summary.level && (
        <p className="mt-2 text-center text-xs text-white/70">Just peeking — finish level {summary.level} to unlock these units.</p>
      )}
    </header>
  );
}
