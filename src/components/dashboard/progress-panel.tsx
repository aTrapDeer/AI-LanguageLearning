"use client";

import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import type { DailyHistoryEntry } from "@/lib/review/types";
import { cn } from "@/lib/utils";
import { CefrScale } from "./cefr-scale";
import { Eyebrow, Panel } from "./panel";
import { UnitsTrack } from "./units-track";
import { WeekChart } from "./week-chart";

/** Where the learner stands: level and CEFR band, this level's units with stars, and the last week. */
export function ProgressPanel({
  summary,
  history,
  onChangeLevel,
  className,
}: {
  summary: LearnerSummary;
  history: DailyHistoryEntry[] | null;
  onChangeLevel: () => void;
  className?: string;
}) {
  const lang = encodeURIComponent(summary.language);
  const stars = summary.units.reduce((sum, unit) => sum + unit.stars, 0);
  const activeDays = (history ?? []).filter((entry) => entry.xp > 0).length;

  return (
    <Panel labelledBy="progress-title" className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Your level</Eyebrow>
        <button
          type="button"
          onClick={onChangeLevel}
          className="-my-2 -mr-2 inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
        >
          Wrong level? Change it
        </button>
      </div>
      <h2 id="progress-title" className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-ink-950 sm:text-3xl">
        Level {summary.level} <span className="text-ink-300">·</span> {summary.levelLabel}
      </h2>
      <CefrScale current={summary.cefr} />

      <div className="mt-6 border-t border-ink-900/[0.07] pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-semibold text-ink-950">
            Level {summary.level} units
            <span className="inline-flex items-center gap-1 font-mono text-xs font-normal tabular-nums text-ink-600">
              <Star aria-hidden className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {stars}/{summary.units.length * 3} stars
            </span>
          </h3>
          <Link
            href={`/learn/journey?lang=${lang}`}
            className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          >
            Full path <ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        <UnitsTrack summary={summary} />
      </div>

      <div className="mt-6 border-t border-ink-900/[0.07] pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-950">Last 7 days</h3>
          {history && (
            <p className="flex items-center gap-3 font-mono text-xs tabular-nums text-ink-600">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t border-dashed border-ember-500" />
                Goal {summary.today.goal} XP
              </span>
              <span>
                {activeDays}/7 active {activeDays === 1 ? "day" : "days"}
              </span>
            </p>
          )}
        </div>
        <WeekChart history={history} goal={summary.today.goal} />
      </div>
    </Panel>
  );
}
