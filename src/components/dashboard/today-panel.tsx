"use client";

import { Check, Flame, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DailyGoalRing } from "@/components/learn";
import { useCountUp } from "@/hooks/use-count-up";
import type { LearnerSummary } from "@/hooks/use-learn-summary";
import { nextStreakMilestone } from "@/lib/review/scoring";
import { cn } from "@/lib/utils";
import { GOAL_NAMES, GoalPicker } from "./goal-picker";
import { Eyebrow, Panel } from "./panel";

function streakMessage(streak: LearnerSummary["streak"]) {
  const days = streak.current;
  if (days === 0) return "One lesson or review today starts it.";
  if (streak.atRisk) return `Practise today to keep your ${days}-day streak.`;
  const upcoming = nextStreakMilestone(days);
  if (streak.todayDone && upcoming) return `${upcoming - days} more ${upcoming - days === 1 ? "day" : "days"} to ${upcoming}.`;
  return streak.todayDone ? "Legendary consistency." : "Keep it going today.";
}

function StreakBlock({ streak }: { streak: LearnerSummary["streak"] }) {
  const days = streak.current;
  const shown = useCountUp(days, { durationMs: 700, delayMs: 150 });
  const lit = days > 0 && streak.todayDone;

  return (
    <div className="min-w-0">
      <Eyebrow as="h3" className={cn(streak.atRisk && "text-ember-700")}>
        Streak
      </Eyebrow>
      <div className="mt-2 flex items-end gap-1.5">
        <Flame
          aria-hidden
          className={cn(
            "mb-1 h-9 w-9 shrink-0",
            lit ? "fill-ember-400 text-ember-500" : streak.atRisk ? "fill-ember-100 text-ember-500" : "text-ink-200"
          )}
        />
        <p className="font-display text-5xl font-extrabold leading-none tabular-nums tracking-tight text-ink-950">
          <span aria-hidden>{shown}</span>
          <span className="sr-only">{days}</span>
        </p>
        <p className="mb-1 text-sm font-semibold text-ink-500">{days === 1 ? "day" : "days"}</p>
      </div>
      <p className={cn("mt-3 text-sm leading-snug", streak.atRisk ? "font-semibold text-ember-800" : "text-ink-600")}>
        {lit ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <Check aria-hidden className="h-4 w-4" /> Done for today
          </span>
        ) : (
          streakMessage(streak)
        )}
      </p>
      {lit && <p className="mt-1 text-xs leading-snug text-ink-500">{streakMessage(streak)}</p>}
      {streak.longest > days && <p className="mt-1 font-mono text-[11px] text-ink-500">Best: {streak.longest} days</p>}
    </div>
  );
}

function GoalBlock({ today, editing, onToggle }: { today: LearnerSummary["today"]; editing: boolean; onToggle: () => void }) {
  const xp = useCountUp(today.xp, { durationMs: 700, delayMs: 150 });

  return (
    <div className="min-w-0">
      <Eyebrow as="h3">Daily goal</Eyebrow>
      <div className="mt-2 flex items-center gap-3">
        <DailyGoalRing
          xp={today.xp}
          goal={today.goal}
          size={76}
          strokeWidth={8}
          surface="light"
          className="shrink-0"
          center={
            today.goalReached ? (
              <Check className="h-8 w-8 text-emerald-500" strokeWidth={3} />
            ) : (
              <span className="font-display text-xl font-extrabold text-ink-950">{Math.round(today.ratio * 100)}%</span>
            )
          }
        />
      </div>
      <p className="mt-2 text-sm text-ink-600">
        <span className="font-display text-lg font-bold tabular-nums text-ink-950">{xp}</span>
        <span className="tabular-nums">/{today.goal} XP</span>
        <span className="block text-xs leading-snug text-ink-500">
          {today.goalReached ? "Reached. The rest is a bonus." : `${today.goal - today.xp} XP to go`}
        </span>
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={editing}
        aria-controls={editing ? "goal-picker" : undefined}
        className="-ml-2 mt-1 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
      >
        <Settings2 aria-hidden className="h-4 w-4" />
        <span>
          Change<span className="sr-only"> daily goal, currently {GOAL_NAMES[today.goal] ?? ""} {today.goal} XP</span>
        </span>
      </button>
    </div>
  );
}

/** Today's status: the streak and the daily goal side by side, with the goal picker tucked underneath. */
export function TodayPanel({
  summary,
  options,
  saving,
  onSetGoal,
  celebration,
  className,
}: {
  summary: LearnerSummary;
  /** Shown at the top of the panel on days worth celebrating. */
  celebration?: ReactNode;
  options: number[];
  saving: boolean;
  onSetGoal: (goal: number) => Promise<boolean>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { streak, today } = summary;

  return (
    <Panel
      labelledBy="today-title"
      className={cn(streak.atRisk && "border-ember-300 bg-gradient-to-b from-ember-50 to-white", className)}
    >
      {celebration}
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="today-title" className="font-display text-xl font-bold tracking-tight text-ink-950">
          Today
        </h2>
        {streak.atRisk && (
          <span className="rounded-full bg-ember-100 px-2.5 py-1 text-xs font-bold text-ember-800">Streak at risk</span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-5 divide-x divide-ink-900/[0.07]">
        <StreakBlock streak={streak} />
        <div className="pl-5">
          <GoalBlock today={today} editing={editing} onToggle={() => setEditing((value) => !value)} />
        </div>
      </div>
      {editing && (
        <div id="goal-picker">
          <GoalPicker
            options={options}
            current={today.goal}
            saving={saving}
            onPick={async (goal) => {
              if (await onSetGoal(goal)) setEditing(false);
            }}
          />
        </div>
      )}
    </Panel>
  );
}
