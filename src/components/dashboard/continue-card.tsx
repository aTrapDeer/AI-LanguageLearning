"use client";

import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";
import { BrandBackground, ProgressBar } from "@/components/learn";
import type { LearnerSummary } from "@/hooks/use-learn-summary";

export interface ContinueCardProps {
  summary: LearnerSummary;
  isNewLearner: boolean;
  onChangeLevel: () => void;
}

/** The one primary action on the dashboard: the next unit on the learner's path. */
export function ContinueCard({ summary, isNewLearner, onChangeLevel }: ContinueCardProps) {
  const lang = encodeURIComponent(summary.language);
  const unit = summary.nextUnit;
  const href = unit ? `/learn/journey?lang=${lang}&unit=${encodeURIComponent(unit.id)}` : `/learn/journey?lang=${lang}`;
  const { completed, total } = summary.levelProgress;

  let eyebrow = "Up next";
  let cta = unit ? `Continue: ${unit.title}` : "Open your path";
  if (isNewLearner && unit) {
    eyebrow = "Your first lesson";
    cta = `Start: ${unit.title}`;
  } else if (!unit) {
    eyebrow = summary.isMaxLevel ? "You've finished the path" : "Level complete";
  }

  return (
    <section aria-labelledby="continue-title" className="relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo-900/20 sm:p-7">
      <BrandBackground className="-z-10" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide">
          Level {summary.level} · {summary.cefr} {summary.levelLabel}
        </span>
        <button type="button" onClick={onChangeLevel} className="text-xs font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline">
          Wrong level? Change it
        </button>
      </div>

      <p className="mt-5 text-sm font-bold uppercase tracking-wide text-indigo-200">{eyebrow}</p>
      {unit ? (
        <>
          <h2 id="continue-title" className="mt-1 flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
            <span aria-hidden className="text-4xl">
              {unit.emoji}
            </span>
            {unit.title}
          </h2>
          <p className="mt-2 max-w-prose text-white/80">{unit.goal}</p>
        </>
      ) : (
        <>
          <h2 id="continue-title" className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {summary.isMaxLevel ? "Every unit, done. Incredible." : `Level ${summary.level} complete!`}
          </h2>
          <p className="mt-2 max-w-prose text-white/80">
            {summary.isMaxLevel
              ? "Keep your words fresh with review and keep talking with your tutor."
              : "Replay units for more stars, or check your path to move up."}
          </p>
        </>
      )}

      <Link
        href={href}
        className="group mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-extrabold text-indigo-700 shadow-lg transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:w-auto"
      >
        {unit ? null : <Map aria-hidden className="h-5 w-5" />}
        <span className="truncate">{cta}</span>
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs font-semibold text-white/75">
          <span>Level {summary.level} progress</span>
          <span className="tabular-nums">
            {completed}/{total} units
          </span>
        </div>
        <ProgressBar value={summary.levelProgress.ratio} label={`Level ${summary.level} progress`} tone="success" />
      </div>
    </section>
  );
}
