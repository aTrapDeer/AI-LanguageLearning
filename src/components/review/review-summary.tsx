"use client";

import { CalendarClock, Flame } from "lucide-react";
import { useMemo } from "react";
import { LessonShell, SessionSummary } from "@/components/learn";
import { getLanguageConfig } from "@/lib/language-config";
import { formatDueIn } from "@/lib/review/intervals";
import { nextStreakMilestone, streakMilestone } from "@/lib/review/scoring";
import type { SessionOutcome } from "./review-session";

export interface ReviewSummaryProps {
  outcome: SessionOutcome;
  language: string;
  onReviewMore: () => void;
}

export function ReviewSummary({ outcome, language, onReviewMore }: ReviewSummaryProps) {
  const { result, stats, cards } = outcome;
  const config = getLanguageConfig(language);
  const reviewed = result?.reviewed ?? stats.reviewed;
  const accuracy = result ? result.accuracy : reviewed > 0 ? stats.correct / reviewed : 0;
  const streak = result?.streak?.current;
  const milestone = result?.streakExtended && streak ? streakMilestone(streak) : null;
  const upcoming = streak ? nextStreakMilestone(streak) : null;
  const nextDue = useMemo(() => formatDueIn(result?.nextDueAt, new Date()), [result?.nextDueAt]);
  const struggled = stats.struggled.map((id) => cards[id]).filter(Boolean).slice(0, 5);
  const dueCount = result?.dueCount ?? 0;

  const title = reviewed === 0 ? "Session closed" : accuracy >= 0.9 ? "Sharp memory!" : accuracy >= 0.6 ? "Review complete!" : "Good work — that's how it sticks";

  return (
    <LessonShell exitHref="/dashboard" exitLabel="Back to dashboard" contentClassName="justify-center py-6">
      <SessionSummary
        title={title}
        subtitle={
          reviewed === 0
            ? "No cards were graded, so nothing changed."
            : `${reviewed} ${reviewed === 1 ? "card" : "cards"} reviewed.${
                stats.struggled.length > 0 ? " The ones you missed come back sooner." : " Each one is now scheduled further out."
              }`
        }
        accuracy={reviewed > 0 ? accuracy : undefined}
        xpGained={result?.xpGained ?? 0}
        streak={streak}
        goalJustReached={result?.goalJustReached}
        dailyXp={result?.dailyXp ?? undefined}
        dailyGoal={result?.dailyGoal ?? undefined}
        stats={[{ label: "Reviewed", value: reviewed }]}
        primaryAction={
          dueCount > 0
            ? { label: `Review ${dueCount} more`, onClick: onReviewMore }
            : { label: "Continue your path", href: `/learn/journey?lang=${encodeURIComponent(language)}` }
        }
        secondaryAction={{ label: "Back to dashboard", href: "/dashboard" }}
      >
        <div className="space-y-3">
          {milestone && (
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 p-4 text-white" role="status">
              <Flame aria-hidden className="h-8 w-8 shrink-0 fill-white/30" />
              <p className="font-bold">{milestone}-day streak! You&apos;ve shown up {milestone} days in a row.</p>
            </div>
          )}
          {!milestone && result?.streakExtended && streak && upcoming && (
            <p className="text-center text-sm text-slate-600">
              {streak === 1 ? "Day one of a new streak" : `Streak extended to ${streak} days`} — {upcoming - streak} more{" "}
              {upcoming - streak === 1 ? "day" : "days"} to reach {upcoming}.
            </p>
          )}

          {(outcome.error || outcome.failedSaves > 0) && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {outcome.error
                ? "We couldn't save this session's XP. Your reviews were saved; try again later."
                : `${outcome.failedSaves} ${outcome.failedSaves === 1 ? "grade wasn't" : "grades weren't"} saved because of a connection problem.`}
            </p>
          )}

          {nextDue && (
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
              <CalendarClock aria-hidden className="h-4 w-4 text-indigo-500" />
              {dueCount > 0 ? `${dueCount} more ${dueCount === 1 ? "card is" : "cards are"} due now` : `Next cards due ${nextDue}`}
            </p>
          )}

          {struggled.length > 0 && (
            <div className="rounded-2xl border-2 border-slate-100 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Coming back soon</p>
              <ul className="mt-2 space-y-1">
                {struggled.map((card) => (
                  <li key={card.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span dir={config?.rtl ? "rtl" : "ltr"} className="font-semibold text-slate-900">
                      {card.word}
                    </span>
                    <span className="truncate text-right text-slate-500">{card.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SessionSummary>
    </LessonShell>
  );
}
