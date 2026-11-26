"use client";

import { previewIntervals } from "@/lib/review/intervals";
import { REVIEW_GRADES, type ReviewGrade, type SrsState } from "@/lib/srs";
import { cn } from "@/lib/utils";

const GRADE_META: Record<ReviewGrade, { label: string; className: string }> = {
  again: { label: "Again", className: "bg-rose-500 hover:bg-rose-400 focus-visible:ring-rose-300" },
  hard: { label: "Hard", className: "bg-amber-500 hover:bg-amber-400 focus-visible:ring-amber-200" },
  good: { label: "Good", className: "bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-emerald-200" },
  easy: { label: "Easy", className: "bg-sky-500 hover:bg-sky-400 focus-visible:ring-sky-200" },
};

export interface GradeButtonsProps {
  srs: SrsState;
  onGrade: (grade: ReviewGrade) => void;
  disabled?: boolean;
}

/** Again / Hard / Good / Easy, each showing when the card would come back. Keys 1–4. */
export function GradeButtons({ srs, onGrade, disabled = false }: GradeButtonsProps) {
  // Recomputed per render so the preview reflects the current time and card state.
  const preview = previewIntervals(srs, new Date());

  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember it?">
      {REVIEW_GRADES.map((grade, index) => {
        const meta = GRADE_META[grade];
        return (
          <button
            key={grade}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(grade)}
            aria-label={`${meta.label}, next review in ${preview[grade].label} (key ${index + 1})`}
            className={cn(
              "flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl px-1 py-2 text-white shadow-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60",
              meta.className
            )}
          >
            <span className="text-base font-extrabold leading-tight">{meta.label}</span>
            <span className="text-xs font-semibold tabular-nums text-white/85">{preview[grade].label}</span>
            <kbd aria-hidden className="mt-0.5 hidden rounded bg-black/15 px-1 text-[10px] font-bold sm:inline">
              {index + 1}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
