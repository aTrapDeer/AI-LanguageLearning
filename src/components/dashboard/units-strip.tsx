"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { StarRating } from "@/components/learn";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";
import { DashCard } from "./stat-cards";

/** The current level's units with stars; unlocked ones link straight into that unit. */
export function UnitsStrip({ summary }: { summary: LearnerSummary }) {
  const lang = encodeURIComponent(summary.language);
  const nextId = summary.nextUnit?.id;

  return (
    <DashCard labelledBy="units-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="units-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Level {summary.level} units
        </h2>
        <Link href={`/learn/journey?lang=${lang}`} className="text-sm font-semibold text-indigo-600 hover:underline">
          Full path
        </Link>
      </div>
      <ol className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {summary.units.map((unit) => {
          const isNext = unit.id === nextId;
          const content = (
            <>
              <span aria-hidden className={cn("text-2xl", !unit.unlocked && "grayscale")}>
                {unit.emoji}
              </span>
              <span className="mt-1 line-clamp-2 min-h-[2.5em] text-xs font-bold leading-tight text-slate-800">{unit.title}</span>
              {unit.unlocked ? (
                <StarRating stars={unit.stars} size="sm" className="mt-1" />
              ) : (
                <Lock aria-label="Locked" className="mt-1 h-3.5 w-3.5 text-slate-400" />
              )}
            </>
          );
          const classes = cn(
            "flex snap-start flex-col items-center rounded-2xl border-2 p-2 text-center transition",
            isNext ? "border-indigo-400 bg-indigo-50" : unit.completed ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-slate-50",
            unit.unlocked ? "hover:border-indigo-300" : "opacity-60"
          );

          return (
            <li key={unit.id} className="flex w-28 shrink-0 sm:w-auto sm:shrink">
              {unit.unlocked ? (
                <Link
                  href={`/learn/journey?lang=${lang}&unit=${encodeURIComponent(unit.id)}`}
                  className={cn(classes, "w-full")}
                  aria-label={`${unit.title}${unit.completed ? `, ${unit.stars} stars` : isNext ? ", up next" : ""}`}
                >
                  {content}
                </Link>
              ) : (
                <div className={cn(classes, "w-full")}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </DashCard>
  );
}
