"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { StarRating } from "@/components/learn";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";

type Unit = LearnerSummary["units"][number];

/** Same three looks as the path page: ember when passed, white and pulsing when next, dim when locked. */
function Station({ unit, isNext }: { unit: Unit; isNext: boolean }) {
  return (
    <span aria-hidden className="relative flex shrink-0 items-center justify-center">
      {isNext && <span className="absolute inset-0 rounded-full bg-ink-400/40 motion-safe:animate-soft-ping" />}
      <span
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full border-b-4 text-[1.4rem] transition",
          unit.completed && "border-ember-700 bg-gradient-to-br from-ember-200 to-ember-500",
          isNext && "border-ink-300 bg-white ring-2 ring-ink-900",
          !unit.completed && !isNext && unit.unlocked && "border-ink-200 bg-ink-50",
          !unit.unlocked && "border-ink-100 bg-ink-50"
        )}
      >
        <span className={cn(!unit.unlocked && "opacity-35 grayscale")}>{unit.emoji}</span>
        {!unit.unlocked && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-white">
            <Lock className="h-2.5 w-2.5" />
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * The current level's units as stops on a line: a vertical list on phones (room for titles), a single
 * row from `sm` up. Unlocked stops link straight into that unit.
 */
export function UnitsTrack({ summary }: { summary: LearnerSummary }) {
  const lang = encodeURIComponent(summary.language);
  const nextId = summary.nextUnit?.id;

  return (
    <ol className="relative mt-4 grid gap-1 sm:grid-cols-6 sm:gap-2" aria-label={`Level ${summary.level} units`}>
      {/* The line the stations sit on. */}
      <span aria-hidden className="absolute bottom-6 left-6 top-6 w-0.5 -translate-x-1/2 bg-ink-100 sm:bottom-auto sm:left-[8.33%] sm:right-[8.33%] sm:top-6 sm:h-0.5 sm:w-auto sm:translate-x-0" />
      {summary.units.map((unit) => {
        const isNext = unit.id === nextId;
        const status = unit.completed ? `${unit.stars} of 3 stars` : isNext ? "up next" : unit.unlocked ? "unlocked" : "locked";
        const content = (
          <>
            <Station unit={unit} isNext={isNext} />
            <span className="min-w-0 flex-1 sm:flex sm:flex-col sm:items-center">
              <span
                className={cn(
                  "block text-[15px] font-semibold leading-tight sm:line-clamp-2 sm:min-h-[2.5em] sm:text-center sm:text-[13px]",
                  unit.unlocked ? "text-ink-950" : "font-medium text-ink-600"
                )}
              >
                {unit.title}
              </span>
              {isNext && (
                <span className="mt-0.5 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ember-700 sm:hidden">Up next</span>
              )}
            </span>
            {unit.completed ? (
              <StarRating stars={unit.stars} size="sm" className="shrink-0 gap-0.5" />
            ) : isNext ? (
              <span className="hidden font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ember-700 sm:block">Next</span>
            ) : (
              <span className="hidden h-4 sm:block" />
            )}
          </>
        );
        const classes =
          "relative flex items-center gap-3 rounded-2xl p-1.5 pr-3 sm:flex-col sm:gap-2 sm:p-1.5 sm:pr-1.5 sm:text-center";

        return (
          <li key={unit.id}>
            {unit.unlocked ? (
              <Link
                href={`/learn/journey?lang=${lang}&unit=${encodeURIComponent(unit.id)}`}
                aria-label={`${unit.title}, ${status}`}
                className={cn(classes, "transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500")}
              >
                {content}
              </Link>
            ) : (
              <div className={classes} aria-label={`${unit.title}, ${status}`} role="group">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
