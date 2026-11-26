"use client";

import Link from "next/link";
import { Check, Flame, Layers, Loader2, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DailyGoalRing } from "@/components/learn";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { nextStreakMilestone } from "@/lib/review/scoring";
import { cn } from "@/lib/utils";

const GOAL_NAMES: Record<number, string> = { 10: "Casual", 20: "Regular", 30: "Serious", 50: "Intense" };

export function DashCard({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5", className)}>
      {children}
    </section>
  );
}

export function StreakCard({ streak }: { streak: LearnerSummary["streak"] }) {
  const days = streak.current;
  const upcoming = nextStreakMilestone(days);
  let message: string;
  if (days === 0) {
    message = "Practise today to start a streak.";
  } else if (streak.atRisk) {
    message = "Any lesson or review today keeps it going.";
  } else if (upcoming) {
    message = `${upcoming - days} more ${upcoming - days === 1 ? "day" : "days"} to ${upcoming}.`;
  } else {
    message = "Legendary consistency.";
  }

  return (
    <DashCard labelledBy="streak-title" className={cn(streak.atRisk && "border-amber-300 bg-amber-50/60")}>
      <h2 id="streak-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Streak
      </h2>
      <div className="mt-2 flex items-center gap-2">
        <Flame
          aria-hidden
          className={cn("h-9 w-9", streak.todayDone ? "fill-orange-400 text-orange-500" : streak.atRisk ? "text-amber-500" : "text-slate-300")}
        />
        <p className="text-3xl font-extrabold tabular-nums text-slate-900">
          {days}
          <span className="ml-1 text-base font-bold text-slate-500">{days === 1 ? "day" : "days"}</span>
        </p>
      </div>
      <p className={cn("mt-2 text-sm", streak.atRisk ? "font-semibold text-amber-800" : "text-slate-600")}>
        {streak.todayDone && days > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <Check aria-hidden className="h-4 w-4" /> Done for today
          </span>
        ) : (
          message
        )}
      </p>
      {streak.longest > days && <p className="mt-1 text-xs text-slate-400">Best: {streak.longest} days</p>}
    </DashCard>
  );
}

export function GoalCard({
  today,
  options,
  saving,
  onSetGoal,
}: {
  today: LearnerSummary["today"];
  options: number[];
  saving: boolean;
  onSetGoal: (goal: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <DashCard labelledBy="goal-title" className={cn(today.goalReached && "border-emerald-200 bg-emerald-50/60")}>
      <div className="flex items-start justify-between gap-2">
        <h2 id="goal-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Daily goal
        </h2>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
          aria-label="Change daily goal"
          className="-m-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
        <DailyGoalRing xp={today.xp} goal={today.goal} size={48} strokeWidth={5} surface="light" />
        <div>
          <p className="text-xl font-extrabold tabular-nums text-slate-900">
            {Math.min(today.xp, today.goal)}
            <span className="text-sm font-bold text-slate-500">/{today.goal} XP</span>
          </p>
          <p className="text-sm text-slate-600">{today.goalReached ? "Goal reached!" : `${today.goal - today.xp} XP to go`}</p>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Daily XP goal">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === today.goal}
              disabled={saving}
              onClick={async () => {
                if (await onSetGoal(option)) setEditing(false);
              }}
              className={cn(
                "rounded-xl border-2 px-2 py-1.5 text-left text-xs transition",
                option === today.goal ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700 hover:border-indigo-200"
              )}
            >
              <span className="block font-bold">{GOAL_NAMES[option] ?? "Custom"}</span>
              <span className="tabular-nums">{option} XP/day</span>
            </button>
          ))}
          {saving && <Loader2 aria-label="Saving" className="col-span-2 mx-auto h-4 w-4 animate-spin text-slate-400" />}
        </div>
      )}
    </DashCard>
  );
}

export function ReviewDueCard({ language, dueCount, deckSize }: { language: string; dueCount: number; deckSize: number }) {
  const hasDue = dueCount > 0;
  const href = `/flashcards?lang=${encodeURIComponent(language)}${!hasDue && deckSize > 0 ? "&tab=words" : ""}`;

  return (
    <DashCard labelledBy="review-title" className={cn(hasDue && "border-indigo-200")}>
      <h2 id="review-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Review
      </h2>
      <div className="mt-2 flex items-center gap-2">
        <Layers aria-hidden className={cn("h-8 w-8", hasDue ? "text-indigo-500" : "text-slate-300")} />
        <p className="text-3xl font-extrabold tabular-nums text-slate-900">
          {dueCount}
          <span className="ml-1 text-base font-bold text-slate-500">due</span>
        </p>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {deckSize === 0
          ? "Words from your lessons will show up here."
          : hasDue
            ? "A few minutes now saves relearning later."
            : `All ${deckSize} ${deckSize === 1 ? "word is" : "words are"} scheduled. Nice!`}
      </p>
      <Link
        href={href}
        className={cn(
          "mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold transition",
          hasDue ? "bg-indigo-600 text-white hover:bg-indigo-500" : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
        )}
      >
        {hasDue ? `Review ${dueCount} ${dueCount === 1 ? "card" : "cards"}` : deckSize === 0 ? "How review works" : "My words"}
      </Link>
    </DashCard>
  );
}
