"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Map } from "lucide-react";
import { InkBackdrop } from "@/components/landing/ink-backdrop";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { cn } from "@/lib/utils";

export interface ContinueCardProps {
  summary: LearnerSummary;
  isNewLearner: boolean;
  onChangeLevel: () => void;
  className?: string;
}

/** The unit's medallion, drawn like the current stop on the path so the two screens feel like one place. */
function UnitMedallion({ emoji }: { emoji: string }) {
  return (
    <div aria-hidden className="relative shrink-0">
      <span className="absolute inset-0 rounded-full bg-white/40 motion-safe:animate-soft-ping" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-b-[5px] border-ink-200 bg-white text-[2rem] shadow-xl shadow-ink-950/40 sm:h-24 sm:w-24 sm:border-b-[7px] sm:text-5xl">
        {emoji}
      </span>
    </div>
  );
}

/** The one primary action on the dashboard: the next unit on the learner's path. */
export function ContinueCard({ summary, isNewLearner, onChangeLevel, className }: ContinueCardProps) {
  const reduceMotion = usePrefersReducedMotion();
  const lang = encodeURIComponent(summary.language);
  const unit = summary.nextUnit;
  const href = unit ? `/learn/journey?lang=${lang}&unit=${encodeURIComponent(unit.id)}` : `/learn/journey?lang=${lang}`;
  const { completed, total, ratio } = summary.levelProgress;

  let eyebrow = unit ? `Up next · Unit ${unit.order} of ${total}` : "Your path";
  let cta = unit ? `Continue: ${unit.title}` : "Open your path";
  if (isNewLearner && unit) {
    eyebrow = "Your first lesson";
    cta = `Start: ${unit.title}`;
  } else if (!unit) {
    eyebrow = summary.isMaxLevel ? "You've finished the path" : "Level complete";
  }

  return (
    <section
      aria-labelledby="continue-title"
      className={cn(
        "relative isolate flex flex-col overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_28px_60px_-28px_rgb(24_18_63/0.7)] sm:p-8",
        className
      )}
    >
      <InkBackdrop glow className="-z-10" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ember-300">{eyebrow}</p>
          <h2
            id="continue-title"
            className="mt-2 text-balance font-display text-[2.1rem] font-extrabold leading-[0.98] tracking-[-0.02em] [font-stretch:92%] sm:text-5xl"
          >
            {unit ? unit.title : summary.isMaxLevel ? "Every unit, done." : `Level ${summary.level} complete!`}
          </h2>
          <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-white/75 sm:text-base">
            {unit
              ? unit.goal
              : summary.isMaxLevel
                ? "Keep your words fresh with review and keep talking with your tutor."
                : "Replay units for more stars, or open your path to move up."}
          </p>
        </div>
        {unit && <UnitMedallion emoji={unit.emoji} />}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={href}
          className="group inline-flex h-14 min-w-0 items-center justify-center gap-2 rounded-2xl bg-ember-400 px-6 text-[17px] font-bold text-ink-950 shadow-[0_10px_30px_-8px_rgb(255_159_46/0.65)] transition hover:bg-ember-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:px-7"
        >
          {unit ? null : <Map aria-hidden className="h-5 w-5 shrink-0" />}
          <span className="truncate">{cta}</span>
          <ArrowRight aria-hidden className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
        {isNewLearner && (
          <button
            type="button"
            onClick={onChangeLevel}
            className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white/75 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Not a beginner? Change your level
          </button>
        )}
      </div>

      <div className="mt-auto pt-7">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-white/85">
            Level {summary.level} <span className="text-white/40">·</span> {summary.cefr} {summary.levelLabel}
          </span>
          <span className="font-mono text-xs tabular-nums text-white/70">
            {completed}/{total} units
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Level ${summary.level} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          className="flex h-2.5 gap-1"
        >
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className="relative h-full flex-1 overflow-hidden rounded-full bg-white/15">
              {index < completed && (
                <motion.span
                  className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-ember-300 to-ember-500"
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.25 + index * 0.08, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
